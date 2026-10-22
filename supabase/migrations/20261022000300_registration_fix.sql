-- Registration fix plan (Phases A, C, E). Safe to run more than once. Includes 20261022000200_auth_attempts.sql,
-- so that file does not need to be run separately.

-- ---------------------------------------------------------------- per-visitor attempt counter (A3, A4, C2)
create table if not exists private.auth_attempts (
  id bigint generated always as identity primary key,
  kind text not null,
  key_hash text not null,
  at timestamptz not null default now()
);
create index if not exists auth_attempts_lookup on private.auth_attempts (kind, key_hash, at desc);
revoke all on private.auth_attempts from public, anon, authenticated;

create or replace function public.note_auth_attempt(p_kind text, p_key_hash text, p_window_minutes integer default 60)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if p_kind not in ('signup', 'lost_email', 'signup_status') or p_key_hash !~ '^[0-9a-f]{32}$' or p_window_minutes not between 1 and 1440 then
    raise exception 'bad request' using errcode = '22023';
  end if;
  delete from private.auth_attempts where at < now() - interval '2 days' and random() < 0.05;
  insert into private.auth_attempts (kind, key_hash) values (p_kind, p_key_hash);
  select count(*) into v_n from private.auth_attempts
   where kind = p_kind and key_hash = p_key_hash and at > now() - make_interval(mins => p_window_minutes);
  return v_n;
end $$;
revoke all on function public.note_auth_attempt(text, text, integer) from public;
grant execute on function public.note_auth_attempt(text, text, integer) to anon, authenticated;

-- ---------------------------------------------------------------- A1: no unconfirmed addresses on real accounts
-- An address on an account (a person with a sign-in) counts only once it was confirmed by code or link.
-- Addresses on co-author placeholders (no account yet) stay unconfirmed: that is how invitations find people.
create or replace function private.person_emails_verified_only()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.verified_at is null and exists (select 1 from public.persons p where p.id = new.person_id and p.user_id is not null) then
    return null; -- silently ignored: the address must go through Settings › Emails (code check)
  end if;
  return new;
end $$;
drop trigger if exists person_emails_verified_only on public.person_emails;
create trigger person_emails_verified_only before insert or update on public.person_emails
  for each row execute function private.person_emails_verified_only();

-- Remove "other emails" saved before this fix without a code check.
delete from public.person_emails e
 using public.persons p
 where p.id = e.person_id and p.user_id is not null and e.verified_at is null and not e.is_primary;

-- complete_profile no longer saves an "other email" (the argument stays so older app versions keep working).
create or replace function public.complete_profile(
  p_paper_name   text,
  p_name_scripts jsonb,
  p_institution  text,
  p_ror_id       text,
  p_department   text,
  p_country      text,
  p_other_email  text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_person uuid := private.current_person_id();
  v_domain text;
  v_id     text;
begin
  if v_person is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if coalesce(btrim(p_paper_name), '') = '' or char_length(p_paper_name) > 200 then
    raise exception 'name required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_institution), '') = '' or char_length(p_institution) > 200 then
    raise exception 'affiliation required' using errcode = '22023';
  end if;
  if p_country is not null and p_country !~ '^[A-Z]{2}$' then
    raise exception 'bad country' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_name_scripts, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_name_scripts, '[]'::jsonb)) > 6 then
    raise exception 'bad scripts' using errcode = '22023';
  end if;

  update public.persons
     set paper_name = btrim(p_paper_name),
         name_scripts = coalesce(p_name_scripts, '[]'::jsonb),
         country = p_country,
         profile_completed_at = coalesce(profile_completed_at, now())
   where id = v_person
  returning plenary_id into v_id;

  select split_part(e.email::text, '@', 2) into v_domain
    from public.person_emails e where e.person_id = v_person and e.is_primary limit 1;

  delete from public.affiliations where person_id = v_person and ends_on is null;
  insert into public.affiliations (person_id, institution, department, country, email_domain)
  values (v_person, btrim(p_institution), nullif(btrim(coalesce(p_department, '')), ''), p_country,
          case when p_institution = 'Independent researcher' then null else v_domain end);

  insert into public.audit_log (actor_person_id, action, entity, entity_id, details)
  values (v_person, 'profile.completed', 'person', v_person, jsonb_build_object('ror', p_ror_id));
  return v_id;
end $$;
revoke all on function public.complete_profile(text, jsonb, text, text, text, text, text) from public, anon;
grant execute on function public.complete_profile(text, jsonb, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------- A2: two-step protects data, not only pages
-- An account with an authenticator app is "nobody" to the database until the session has passed the second step (aal2).
create or replace function private.current_person_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.persons p
  where p.user_id = (select auth.uid()) and p.locked_at is null and p.deleted_at is null and p.merged_into is null
    and (coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
         or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified'))
$$;

-- ---------------------------------------------------------------- C1: account record missing after confirming
-- Creates the person record for the signed-in, confirmed user when the sign-up trigger did not (same rules as the trigger).
create or replace function public.ensure_my_person()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  u        auth.users;
  v_person uuid;
  v_meta   jsonb;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select id into v_person from public.persons where user_id = v_uid;
  if v_person is not null then return v_person; end if;
  select * into u from auth.users where id = v_uid;
  if u.id is null or u.email_confirmed_at is null or u.email is null then return null; end if;
  v_meta := coalesce(u.raw_user_meta_data, '{}');

  select e.person_id into v_person
    from public.person_emails e join public.persons p on p.id = e.person_id
   where e.email = u.email::extensions.citext and p.user_id is null
   limit 1;
  if v_person is not null then
    update public.persons set user_id = v_uid where id = v_person;
    update public.person_emails set verified_at = coalesce(verified_at, now()) where person_id = v_person and email = u.email::extensions.citext;
  else
    insert into public.persons (user_id, given_name, family_name)
    values (v_uid,
            left(coalesce(v_meta ->> 'given_name', v_meta ->> 'first_name', ''), 120),
            left(coalesce(v_meta ->> 'family_name', v_meta ->> 'last_name', ''), 120))
    returning id into v_person;
    insert into public.person_emails (person_id, email, is_primary, verified_at)
    values (v_person, u.email, true, now())
    on conflict (email) do nothing;
  end if;
  insert into public.audit_log (actor_user_id, actor_person_id, action, entity, entity_id)
  values (v_uid, v_person, 'account.linked', 'person', v_person);
  return v_person;
end $$;
revoke all on function public.ensure_my_person() from public, anon;
grant execute on function public.ensure_my_person() to authenticated;

-- ---------------------------------------------------------------- C2: confirmed on another device?
-- Answers only for accounts created in the last 24 hours (the sign-up still open on another screen), so it can't be
-- used to check whether older addresses have accounts. The app also limits how often one visitor may ask.
create or replace function public.signup_confirmed(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.email_confirmed_at is not null from auth.users u
                    where lower(u.email) = lower(btrim(p_email)) and u.created_at > now() - interval '24 hours'
                    limit 1), false)
$$;
revoke all on function public.signup_confirmed(text) from public;
grant execute on function public.signup_confirmed(text) to anon, authenticated;

-- ---------------------------------------------------------------- C3: pending email change
create or replace function public.my_pending_email()
returns text language sql stable security definer set search_path = '' as $$
  select nullif(u.email_change, '') from auth.users u where u.id = auth.uid()
$$;
create or replace function public.cancel_my_email_change()
returns void language sql security definer set search_path = '' as $$
  update auth.users
     set email_change = '', email_change_token_new = '', email_change_token_current = '', email_change_confirm_status = 0,
         email_change_sent_at = null
   where id = auth.uid()
$$;
revoke all on function public.my_pending_email(), public.cancel_my_email_change() from public, anon;
grant execute on function public.my_pending_email(), public.cancel_my_email_change() to authenticated;

-- ---------------------------------------------------------------- C5: unconfirmed accounts
create table if not exists private.signup_reminders (user_id uuid primary key, sent_at timestamptz not null default now());
revoke all on private.signup_reminders from public, anon, authenticated;

-- Addresses to remind once (unconfirmed for 1–3 days). Marks them as reminded. Secret-key (service) use only.
create or replace function public.due_signup_reminders()
returns setof text language plpgsql security definer set search_path = '' as $$
begin
  return query
  with due as (
    select u.id, u.email from auth.users u
     where u.email_confirmed_at is null and u.email is not null
       and u.created_at < now() - interval '1 day' and u.created_at > now() - interval '3 days'
       and not exists (select 1 from private.signup_reminders r where r.user_id = u.id)
     limit 200
  ), marked as (
    insert into private.signup_reminders (user_id) select id from due on conflict do nothing returning user_id
  )
  select d.email::text from due d join marked m on m.user_id = d.id;
end $$;
revoke all on function public.due_signup_reminders() from public, anon, authenticated;
grant execute on function public.due_signup_reminders() to service_role;

-- Deletes accounts never confirmed after 30 days (frees the address). No person record exists for them.
create or replace function private.cleanup_unconfirmed()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  with gone as (
    delete from auth.users u
     where u.email_confirmed_at is null and u.created_at < now() - interval '30 days'
       and not exists (select 1 from public.persons p where p.user_id = u.id)
    returning u.id
  ) select count(*) into v_n from gone;
  delete from private.signup_reminders r where not exists (select 1 from auth.users u where u.id = r.user_id);
  return v_n;
end $$;
create or replace function public.cleanup_unconfirmed_accounts()
returns integer language sql security definer set search_path = '' as $$ select private.cleanup_unconfirmed() $$;
revoke all on function private.cleanup_unconfirmed(), public.cleanup_unconfirmed_accounts() from public, anon, authenticated;
grant execute on function public.cleanup_unconfirmed_accounts() to service_role;

-- Nightly inside the database too, when pg_cron is switched on (Database › Extensions › pg_cron).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'plenary-cleanup-unconfirmed';
    perform cron.schedule('plenary-cleanup-unconfirmed', '15 3 * * *', 'select private.cleanup_unconfirmed()');
  end if;
end $$;

-- ---------------------------------------------------------------- E1: sign-up funnel (no personal data)
create table if not exists private.signup_funnel (
  id bigint generated always as identity primary key,
  step text not null,
  at timestamptz not null default now()
);
create index if not exists signup_funnel_at on private.signup_funnel (at desc, step);
revoke all on private.signup_funnel from public, anon, authenticated;

create or replace function public.note_signup_step(p_step text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_step not in ('started', 'code_sent', 'confirmed', 'returning', 'password', 'profile', 'email_failed', 'code_failed') then
    raise exception 'bad step' using errcode = '22023';
  end if;
  insert into private.signup_funnel (step) values (p_step);
end $$;
revoke all on function public.note_signup_step(text) from public;
grant execute on function public.note_signup_step(text) to anon, authenticated;

create or replace function public.admin_signup_funnel(p_days integer default 30)
returns table (step text, n bigint) language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query select f.step, count(*) from private.signup_funnel f
    where f.at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
    group by f.step;
end $$;
revoke all on function public.admin_signup_funnel(integer) from public, anon;
grant execute on function public.admin_signup_funnel(integer) to authenticated;

-- E3: daily check (service use only): step counts for the last p_hours.
create or replace function public.signup_funnel_counts(p_hours integer default 24)
returns table (step text, n bigint) language sql stable security definer set search_path = '' as $$
  select f.step, count(*) from private.signup_funnel f
   where f.at > now() - make_interval(hours => greatest(1, least(coalesce(p_hours, 24), 720)))
   group by f.step
$$;
revoke all on function public.signup_funnel_counts(integer) from public, anon, authenticated;
grant execute on function public.signup_funnel_counts(integer) to service_role;

-- ---------------------------------------------------------------- step 1: what to do with this email (review 22 Oct, problem 4)
-- Answers only when the web app signed the request (after its robot check and per-connection limit), so the API
-- can't be used to check emails in bulk. Returns one word:
--   none · unconfirmed · no_password · no_profile · complete · locked · secondary (a confirmed extra email of an account)
create or replace function public.signup_email_status(p_email text, p_expires bigint, p_sig text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  u auth.users;
  p public.persons;
begin
  if not private.signed('signup-status|' || v_email, p_expires, p_sig) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into u from auth.users where lower(email) = v_email limit 1;
  if u.id is null then
    if exists (select 1 from public.person_emails e join public.persons x on x.id = e.person_id
                where e.email = v_email::extensions.citext and e.verified_at is not null and x.user_id is not null) then
      return 'secondary';
    end if;
    return 'none';
  end if;
  select * into p from public.persons where user_id = u.id;
  if (u.banned_until is not null and u.banned_until > now()) or p.locked_at is not null or p.merged_into is not null then
    return 'locked';
  end if;
  if u.email_confirmed_at is null then return 'unconfirmed'; end if;
  if coalesce(u.raw_user_meta_data ->> 'password_set_at', '') = '' and u.raw_user_meta_data ->> 'onb' = 'password' then
    return 'no_password';
  end if;
  if p.id is null or p.profile_completed_at is null then return 'no_profile'; end if;
  return 'complete';
end $$;
revoke all on function public.signup_email_status(text, bigint, text) from public;
grant execute on function public.signup_email_status(text, bigint, text) to anon, authenticated;
