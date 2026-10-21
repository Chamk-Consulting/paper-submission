-- Identity+ (ST01 / ST02 extension): richer names, research identifiers, extra verified emails,
-- sign-in email changes kept in sync, sign-in with a Plenary ID, ROR on affiliations.

-- ---------------------------------------------------------------- names
alter table public.persons
  add column if not exists middle_name        text check (char_length(middle_name) <= 120),
  add column if not exists name_order         text not null default 'given_first' check (name_order in ('given_first', 'family_first')),
  add column if not exists citation_name      text check (char_length(citation_name) <= 160),
  add column if not exists badge_name         text check (char_length(badge_name) <= 80),
  add column if not exists name_pronunciation text check (char_length(name_pronunciation) <= 120),
  add column if not exists former_names       text[] not null default '{}' check (cardinality(former_names) <= 6);
comment on column public.persons.name_scripts is 'Names in other scripts: [{"lang":"zh","name":"王伟","latin":"Wang Wei"}] (max 6)';
comment on column public.persons.other_names is 'Other spellings used on papers (max 6); matched in conflict checks.';

-- display name follows the person's name order ("Wang Wei" for family-name-first)
alter table public.persons drop column if exists display_name;
alter table public.persons add column display_name text generated always as (
  btrim(case when name_order = 'family_first' then family_name || ' ' || given_name else given_name || ' ' || family_name end)
) stored;

-- ---------------------------------------------------------------- identifiers
alter table public.persons
  add column if not exists orcid_verified_at   timestamptz,
  add column if not exists scopus_id           text check (scopus_id ~ '^\d{6,12}$'),
  add column if not exists researcher_id       text check (researcher_id ~ '^[A-Z]{1,3}-\d{4}-\d{4}$'),
  add column if not exists dblp_url            text check (dblp_url ~ '^https://dblp\.org/pid/[0-9a-z/-]+(\.html)?$'),
  add column if not exists semantic_scholar_id text check (semantic_scholar_id ~ '^\d{1,12}$'),
  add column if not exists xplore_author_id    text check (xplore_author_id ~ '^\d{4,14}$'),
  add column if not exists website_url         text check (website_url ~ '^https://\S+$' and char_length(website_url) <= 300);

grant update (middle_name, name_order, citation_name, badge_name, name_pronunciation, former_names, other_names,
              scopus_id, researcher_id, dblp_url, semantic_scholar_id, xplore_author_id, website_url)
  on public.persons to authenticated;

-- ORCID typed by hand: allowed until it is verified by "Connect ORCID"; never takes one another account uses.
create or replace function public.set_my_orcid(p_orcid text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  v_new text := nullif(upper(btrim(coalesce(p_orcid, ''))), '');
  v_sum int := 0; v_d int; i int; v_check text;
begin
  if v_me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if exists (select 1 from public.persons where id = v_me and orcid_verified_at is not null) then
    raise exception 'your ORCID is verified — disconnect it before changing it' using errcode = '22023';
  end if;
  if v_new is not null then
    if v_new !~ '^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$' then raise exception 'ORCID format is 0000-0000-0000-0000' using errcode = '22023'; end if;
    -- ISO 7064 11,2 check digit
    for i in 1..15 loop
      v_d := substr(replace(v_new, '-', ''), i, 1)::int;
      v_sum := (v_sum + v_d) * 2;
    end loop;
    v_check := case (12 - v_sum % 11) % 11 when 10 then 'X' else ((12 - v_sum % 11) % 11)::text end;
    if right(v_new, 1) <> v_check then raise exception 'that ORCID iD has a typo (check digit)' using errcode = '22023'; end if;
    if exists (select 1 from public.persons where orcid = v_new and id <> v_me) then
      raise exception 'that ORCID iD is already linked to another Plenary account' using errcode = '23505';
    end if;
  end if;
  update public.persons set orcid = v_new, orcid_verified_at = null where id = v_me;
  return v_new;
end $$;
revoke all on function public.set_my_orcid(text) from public, anon;
grant execute on function public.set_my_orcid(text) to authenticated;

-- ---------------------------------------------------------------- affiliations: ROR
alter table public.affiliations
  add column if not exists ror_id text check (ror_id ~ '^https://ror\.org/0[a-z0-9]{8}$');
grant insert (ror_id), update (ror_id) on public.affiliations to authenticated;

-- ---------------------------------------------------------------- signing secret shared with the web app
-- Codes for extra emails and Plenary-ID sign-in are created and checked by the web app; the database only
-- accepts results the app signed with this secret (same value as PLENARY_SIGNING_SECRET in Vercel).
create table if not exists private.app_secrets (key text primary key, value text not null);
revoke all on private.app_secrets from public, anon, authenticated;

create or replace function private.signed(p_msg text, p_expires bigint, p_sig text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_secret text;
begin
  select value into v_secret from private.app_secrets where key = 'signing';
  if v_secret is null or p_sig is null or p_expires < extract(epoch from now()) or p_expires > extract(epoch from now()) + 3600 then
    return false;
  end if;
  return encode(extensions.hmac(p_msg || '|' || p_expires::text, v_secret, 'sha256'), 'hex') = lower(p_sig);
end $$;

-- ---------------------------------------------------------------- extra (secondary) emails
create or replace function public.add_verified_email(p_email text, p_expires bigint, p_sig text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not private.signed('email|' || v_me::text || '|' || v_email, p_expires, p_sig) then
    raise exception 'that code has expired — ask for a new one' using errcode = '22023';
  end if;
  if exists (select 1 from public.person_emails where email = v_email and person_id <> v_me) then
    raise exception 'that email belongs to another Plenary account — use Account help › Merge' using errcode = '23505';
  end if;
  if (select count(*) from public.person_emails where person_id = v_me) >= 8 then
    raise exception 'you can keep up to 8 email addresses' using errcode = '22023';
  end if;
  insert into public.person_emails (person_id, email, is_primary, verified_at)
  values (v_me, v_email, false, now())
  on conflict (email) do update set verified_at = coalesce(public.person_emails.verified_at, now());
  insert into public.audit_log (actor_person_id, action, entity, entity_id, details)
  values (v_me, 'account.email_added', 'person', v_me, jsonb_build_object('domain', split_part(v_email, '@', 2)));
end $$;

create or replace function public.remove_my_email(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id();
begin
  if v_me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if exists (select 1 from public.person_emails where person_id = v_me and email = lower(btrim(p_email)) and is_primary) then
    raise exception 'your sign-in email can''t be removed — change it instead' using errcode = '22023';
  end if;
  delete from public.person_emails where person_id = v_me and email = lower(btrim(p_email)) and not is_primary;
  insert into public.audit_log (actor_person_id, action, entity, entity_id)
  values (v_me, 'account.email_removed', 'person', v_me);
end $$;

revoke all on function public.add_verified_email(text, bigint, text), public.remove_my_email(text) from public, anon;
grant execute on function public.add_verified_email(text, bigint, text), public.remove_my_email(text) to authenticated;

-- ---------------------------------------------------------------- sign-in email changed in Supabase Auth -> primary email
create or replace function private.sync_auth_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_person uuid;
begin
  if new.email is null or new.email is not distinct from old.email or new.email_confirmed_at is null then return new; end if;
  select id into v_person from public.persons where user_id = new.id;
  if v_person is null then return new; end if;
  update public.person_emails set is_primary = false where person_id = v_person and is_primary;
  insert into public.person_emails (person_id, email, is_primary, verified_at)
  values (v_person, lower(new.email), true, now())
  on conflict (email) do update set is_primary = true, verified_at = coalesce(public.person_emails.verified_at, now())
    where public.person_emails.person_id = v_person;
  insert into public.audit_log (actor_user_id, actor_person_id, action, entity, entity_id)
  values (new.id, v_person, 'account.email_changed', 'person', v_person);
  return new;
end $$;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function private.sync_auth_email();

-- ---------------------------------------------------------------- sign in with a Plenary ID
-- Returns the sign-in email for a Plenary ID only when the web app signed the request (no email harvesting).
create or replace function public.email_for_plenary_id(p_plenary_id text, p_expires bigint, p_sig text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_pid text := upper(btrim(coalesce(p_plenary_id, '')));
begin
  if not private.signed('pid|' || v_pid, p_expires, p_sig) then return null; end if;
  return (select e.email::text from public.persons p join public.person_emails e on e.person_id = p.id and e.is_primary
          where p.plenary_id = v_pid and p.user_id is not null and p.deleted_at is null limit 1);
end $$;
revoke all on function public.email_for_plenary_id(text, bigint, text) from public;
grant execute on function public.email_for_plenary_id(text, bigint, text) to anon, authenticated;
