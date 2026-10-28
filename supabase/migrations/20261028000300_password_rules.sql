-- Password rules (28 Oct 2026), set by admins on Admin › Venues: shortest length, required mix, the "long phrase"
-- exception and the leaked-password check. Defaults: 8 characters, letters and a number, or a 12+ character phrase,
-- leaked passwords refused. Read by everyone through public.site_flags() (the forms show the rules live).

alter table public.platform_settings
  add column if not exists pw_min_length int not null default 8,
  add column if not exists pw_mix text not null default 'letters_number',
  add column if not exists pw_phrase_length int not null default 12,
  add column if not exists pw_check_leaks boolean not null default true;
alter table public.platform_settings drop constraint if exists platform_settings_pw_rules_check;
alter table public.platform_settings add constraint platform_settings_pw_rules_check check (
  pw_min_length between 6 and 64 and pw_mix in ('none', 'letters_number', 'three_kinds') and pw_phrase_length between 0 and 128);

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
    'signin_google', s.signin_google,
    'languages', s.languages,
    'pw_min_length', s.pw_min_length,
    'pw_mix', s.pw_mix,
    'pw_phrase_length', s.pw_phrase_length,
    'pw_check_leaks', s.pw_check_leaks)
  from public.platform_settings s limit 1
$$;
grant execute on function public.site_flags() to anon, authenticated;

create or replace function public.admin_set_password_rules(p_min_length int, p_mix text, p_phrase_length int, p_check_leaks boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_min_length is null or p_min_length < 6 or p_min_length > 64 then raise exception 'Shortest length must be 6 to 64 characters.'; end if;
  if p_mix is null or p_mix not in ('none', 'letters_number', 'three_kinds') then raise exception 'Unknown mix rule.'; end if;
  if p_phrase_length is null or p_phrase_length < 0 or p_phrase_length > 128 then raise exception 'Phrase length must be 0 to 128.'; end if;
  update public.platform_settings set pw_min_length = p_min_length, pw_mix = p_mix, pw_phrase_length = p_phrase_length,
    pw_check_leaks = coalesce(p_check_leaks, true), updated_at = now() where id;
  perform private.admin_log('settings.password_rules', null, null, null, null, jsonb_build_object(
    'min_length', p_min_length, 'mix', p_mix, 'phrase_length', p_phrase_length, 'check_leaks', p_check_leaks));
end $$;
revoke all on function public.admin_set_password_rules(int, text, int, boolean) from public, anon;
grant execute on function public.admin_set_password_rules(int, text, int, boolean) to authenticated;
