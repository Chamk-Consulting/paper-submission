-- Site switches, PINs, sign-up without an email code (27 Oct 2026).

-- 1. Site switches (platform_settings, one row). Read by everyone through public.site_flags(); changed by admins.
alter table public.platform_settings
  add column if not exists home_event text,
  add column if not exists single_event boolean not null default false,
  add column if not exists signin_email_code boolean not null default true,
  add column if not exists signup_email_code boolean not null default true;

update public.platform_settings set home_event = 'codit-2027', single_event = true, signin_email_code = true, signup_email_code = false, updated_at = now() where id;

create or replace function public.site_flags()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'home_event', s.home_event,
    'single_event', s.single_event and s.home_event is not null
      and exists (select 1 from public.venues v where v.slug = s.home_event and v.is_published),
    'signin_email_code', s.signin_email_code,
    'signup_email_code', s.signup_email_code)
  from public.platform_settings s limit 1
$$;
grant execute on function public.site_flags() to anon, authenticated;

create or replace function public.admin_set_site_flags(p_home_event text, p_single_event boolean, p_signin_email_code boolean, p_signup_email_code boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_home_event is not null and not exists (select 1 from public.venues v where v.slug = p_home_event) then
    raise exception 'unknown event %', p_home_event;
  end if;
  update public.platform_settings set
    home_event = nullif(btrim(coalesce(p_home_event, '')), ''),
    single_event = coalesce(p_single_event, false),
    signin_email_code = coalesce(p_signin_email_code, true),
    signup_email_code = coalesce(p_signup_email_code, true),
    updated_at = now()
  where id;
  perform private.admin_log('settings.site_flags', null, null, null, null, jsonb_build_object(
    'home_event', p_home_event, 'single_event', p_single_event, 'signin_email_code', p_signin_email_code, 'signup_email_code', p_signup_email_code));
end $$;
revoke all on function public.admin_set_site_flags(text, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_set_site_flags(text, boolean, boolean, boolean) to authenticated;

-- 2. PIN: a person's public number (like PaperCept), from 1000 up, replaces the PL-XXXX-XXXX ID.
--    The column keeps its name (plenary_id) so nothing else in the schema changes.
alter table public.persons drop constraint if exists persons_plenary_id_check;
create sequence if not exists private.pin_seq start with 1000 minvalue 1000;
with ordered as (select id, row_number() over (order by created_at, id) as rn from public.persons)
update public.persons p set plenary_id = (999 + o.rn)::text from ordered o where o.id = p.id;
select setval('private.pin_seq', greatest(1000, (select coalesce(max(plenary_id::int), 999) + 1 from public.persons)), false);
alter table public.persons add constraint persons_plenary_id_check check (plenary_id ~ '^[1-9][0-9]{3,8}$');
comment on column public.persons.plenary_id is 'PIN: public number from 1000 up. Finds a person and can be typed to sign in; never a secret.';

create or replace function private.new_plenary_id()
returns text language sql set search_path = '' as $$
  select nextval('private.pin_seq')::text
$$;

create or replace function public.find_person(p_query text)
returns table(person_id uuid, display_name text, institution text, plenary_id text)
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(btrim(coalesce(p_query, '')));
begin
  if private.current_person_id() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  q := regexp_replace(q, '^pin[\s:#-]*', '');
  if q ~ '^[1-9][0-9]{3,8}$' then
    return query select p.id, p.display_name,
      (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1), p.plenary_id
      from public.persons p where p.plenary_id = q and p.deleted_at is null and p.merged_into is null;
  elsif q ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return query select p.id,
      btrim(upper(left(coalesce(p.given_name, ''), 1)) || '. ' || upper(left(coalesce(p.family_name, ''), 1)) || '.'),
      null::text, null::text
      from public.person_emails e join public.persons p on p.id = e.person_id
      where e.email = q::extensions.citext and p.deleted_at is null and p.merged_into is null;
  end if;
end $$;

-- 3. Sign-up without an email code (when signup_email_code is off): the web server, after creating the account with
--    a password, confirms it here. Signed by the server, only for accounts made in the last 15 minutes, never when the
--    switch is on.
create or replace function public.confirm_signup_without_code(p_email text, p_expires bigint, p_sig text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_n int;
begin
  if (select s.signup_email_code from public.platform_settings s limit 1) then return false; end if;
  if not private.signed('signup-noconfirm|' || v_email, p_expires, p_sig) then return false; end if;
  update auth.users set email_confirmed_at = now(), confirmation_token = '', updated_at = now()
  where lower(email) = v_email and email_confirmed_at is null and created_at > now() - interval '15 minutes';
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;
revoke all on function public.confirm_signup_without_code(text, bigint, text) from public;
grant execute on function public.confirm_signup_without_code(text, bigint, text) to anon, authenticated;
