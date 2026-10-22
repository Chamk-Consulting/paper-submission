-- Settings › Preferences (display, workspace, follow device) and Settings › Notifications "Off".

-- How Plenary looks and behaves for this person. Keys (all optional, defaults in lib/account/ui-prefs.ts):
-- textSize normal|large · motion auto|reduce · contrast normal|high · sidebar auto|folded ·
-- start home|submissions|reviews|events · followDevice true|false
alter table public.persons
  add column if not exists ui_prefs jsonb not null default '{}'::jsonb
    check (jsonb_typeof(ui_prefs) = 'object' and pg_column_size(ui_prefs) < 2000);
grant select (ui_prefs) on public.persons to authenticated;
grant update (ui_prefs) on public.persons to authenticated;

-- Which of these addresses asked for no email of this kind (Notifications › Off). Senders call it before
-- emailing people; it reveals nothing but "skip these", and only for addresses the caller already has.
create or replace function public.email_optouts(p_emails text[], p_kind text)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct lower(e.email::text)), '{}')
  from public.person_emails e
  join public.notification_prefs n on n.person_id = e.person_id
  where lower(e.email::text) = any (select lower(x) from unnest(p_emails) x)
    and n.modes ->> p_kind = 'off'
$$;
revoke all on function public.email_optouts(text[], text) from public, anon;
grant execute on function public.email_optouts(text[], text) to authenticated, service_role;
