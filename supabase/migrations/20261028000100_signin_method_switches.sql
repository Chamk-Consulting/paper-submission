-- Sign-in method switches (28 Oct 2026). Which ways in the sign-in page offers. Defaults: password, email code/link
-- and ORCID on; passkey, institution (SSO) and Google off. At least one of password and email code stays on.

alter table public.platform_settings
  add column if not exists signin_password boolean not null default true,
  add column if not exists signin_passkey boolean not null default false,
  add column if not exists signin_orcid boolean not null default true,
  add column if not exists signin_institution boolean not null default false,
  add column if not exists signin_google boolean not null default false;

create or replace function public.site_flags()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'home_event', s.home_event,
    'single_event', s.single_event and s.home_event is not null
      and exists (select 1 from public.venues v where v.slug = s.home_event and v.is_published),
    'signin_email_code', s.signin_email_code,
    'signup_email_code', s.signup_email_code,
    'signin_password', s.signin_password,
    'signin_passkey', s.signin_passkey,
    'signin_orcid', s.signin_orcid,
    'signin_institution', s.signin_institution,
    'signin_google', s.signin_google)
  from public.platform_settings s limit 1
$$;
grant execute on function public.site_flags() to anon, authenticated;

drop function if exists public.admin_set_site_flags(text, boolean, boolean, boolean);
create or replace function public.admin_set_site_flags(
  p_home_event text, p_single_event boolean, p_signin_email_code boolean, p_signup_email_code boolean,
  p_signin_password boolean default true, p_signin_passkey boolean default false, p_signin_orcid boolean default true,
  p_signin_institution boolean default false, p_signin_google boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_home_event is not null and not exists (select 1 from public.venues v where v.slug = p_home_event) then
    raise exception 'unknown event %', p_home_event;
  end if;
  if not coalesce(p_signin_password, false) and not coalesce(p_signin_email_code, false) then
    raise exception 'Keep password or email code sign-in on, so everyone can still get in.';
  end if;
  update public.platform_settings set
    home_event = nullif(btrim(coalesce(p_home_event, '')), ''),
    single_event = coalesce(p_single_event, false),
    signin_email_code = coalesce(p_signin_email_code, true),
    signup_email_code = coalesce(p_signup_email_code, true),
    signin_password = coalesce(p_signin_password, true),
    signin_passkey = coalesce(p_signin_passkey, false),
    signin_orcid = coalesce(p_signin_orcid, false),
    signin_institution = coalesce(p_signin_institution, false),
    signin_google = coalesce(p_signin_google, false),
    updated_at = now()
  where id;
  perform private.admin_log('settings.site_flags', null, null, null, null, jsonb_build_object(
    'home_event', p_home_event, 'single_event', p_single_event, 'signin_email_code', p_signin_email_code,
    'signup_email_code', p_signup_email_code, 'signin_password', p_signin_password, 'signin_passkey', p_signin_passkey,
    'signin_orcid', p_signin_orcid, 'signin_institution', p_signin_institution, 'signin_google', p_signin_google));
end $$;
revoke all on function public.admin_set_site_flags(text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_set_site_flags(text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- ORCID sign-in for someone with no account linked to that ORCID iD: Supabase makes a new user with no email. The web
-- server signs the user out and removes that empty user here (signed by the server; only brand-new users with no
-- email, no person and nothing else).
create or replace function public.discard_unlinked_oauth_user(p_user uuid, p_expires bigint, p_sig text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if not private.signed('oauth-unlinked|' || p_user::text, p_expires, p_sig) then return false; end if;
  delete from auth.users u
  where u.id = p_user and coalesce(u.email, '') = '' and u.created_at > now() - interval '15 minutes'
    and not exists (select 1 from public.persons p where p.user_id = u.id);
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;
revoke all on function public.discard_unlinked_oauth_user(uuid, bigint, text) from public;
grant execute on function public.discard_unlinked_oauth_user(uuid, bigint, text) to anon, authenticated;
