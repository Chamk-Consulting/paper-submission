-- AD01 platform admin + AH02 account help (lost email, merge accounts, claim a paper).
-- Additive only. Nobody is a platform admin by default; to make yourself one, run in the SQL editor:
--   insert into public.platform_admins (person_id) select id from public.persons where plenary_id = 'PL-XXXX-XXXX';

-- ---------------------------------------------------------------- tables
create table if not exists public.platform_admins (
  person_id  uuid primary key references public.persons (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id                     boolean primary key default true check (id),
  require_venue_approval boolean not null default false,
  updated_at             timestamptz not null default now()
);
insert into public.platform_settings (id) values (true) on conflict do nothing;

create table if not exists public.admin_audit (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  admin_person  uuid references public.persons (id) on delete set null,
  action        text not null check (char_length(action) <= 60),
  target_person uuid references public.persons (id) on delete set null,
  target_venue  uuid references public.venues (id) on delete set null,
  target_ref    text check (char_length(target_ref) <= 60),
  reason        text check (char_length(reason) <= 1000),
  details       jsonb not null default '{}'::jsonb
);
create index if not exists admin_audit_person_idx on public.admin_audit (target_person, at desc);
create index if not exists admin_audit_at_idx on public.admin_audit (at desc);

alter table public.venues
  add column if not exists approved_at   timestamptz,
  add column if not exists approved_by   uuid references public.persons (id) on delete set null,
  add column if not exists approval_note text check (char_length(approval_note) <= 1000);

alter table public.persons
  add column if not exists locked_at     timestamptz,
  add column if not exists locked_reason text check (char_length(locked_reason) <= 300),
  add column if not exists merged_into   uuid references public.persons (id) on delete set null;

create table if not exists public.account_help_requests (
  id          uuid primary key default gen_random_uuid(),
  reference   text not null unique,
  kind        text not null check (kind in ('lost_email', 'merge', 'claim')),
  name        text check (char_length(name) <= 200),
  plenary_id  text check (char_length(plenary_id) <= 20),
  old_email   extensions.citext check (old_email is null or old_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  new_email   extensions.citext check (new_email is null or new_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  proof       text check (proof in ('orcid', 'coauthor', 'organizer')),
  note        text check (char_length(note) <= 2000),
  person_id   uuid references public.persons (id) on delete set null,
  status      text not null default 'new' check (status in ('new', 'open', 'closed')),
  created_at  timestamptz not null default now()
);
create index if not exists account_help_new_email_idx on public.account_help_requests (new_email, created_at desc);

create table if not exists public.support_replies (
  id            uuid primary key default gen_random_uuid(),
  source        text not null check (source in ('contact', 'help')),
  item_id       uuid not null,
  admin_person  uuid references public.persons (id) on delete set null,
  body          text not null check (char_length(body) between 2 and 8000),
  emailed       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists support_replies_item_idx on public.support_replies (item_id, created_at);

create table if not exists public.merge_tokens (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique check (char_length(token_hash) = 64),
  keeper_person uuid not null references public.persons (id) on delete cascade,
  expires_at    timestamptz not null default now() + interval '30 minutes',
  used_at       timestamptz,
  merged_person uuid references public.persons (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.paper_claims (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  claimant      uuid not null references public.persons (id) on delete cascade,
  placeholder   uuid not null references public.persons (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  decided_by    uuid references public.persons (id) on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (submission_id, claimant, placeholder)
);

create table if not exists public.claim_lookups (
  id         bigint generated always as identity primary key,
  person_id  uuid not null references public.persons (id) on delete cascade,
  at         timestamptz not null default now()
);
create index if not exists claim_lookups_person_idx on public.claim_lookups (person_id, at desc);

-- ---------------------------------------------------------------- RLS: no direct access; everything goes through the RPCs below
alter table public.platform_admins       enable row level security;
alter table public.platform_settings     enable row level security;
alter table public.admin_audit           enable row level security;
alter table public.account_help_requests enable row level security;
alter table public.support_replies       enable row level security;
alter table public.merge_tokens          enable row level security;
alter table public.paper_claims          enable row level security;
alter table public.claim_lookups         enable row level security;
revoke all on public.platform_admins, public.platform_settings, public.admin_audit, public.account_help_requests,
  public.support_replies, public.merge_tokens, public.paper_claims, public.claim_lookups from anon, authenticated;

-- ---------------------------------------------------------------- helpers
create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins a where a.person_id = (select private.current_person_id()))
$$;
grant execute on function private.is_platform_admin() to authenticated;

create or replace function private.require_admin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id();
begin
  if v_me is null or not exists (select 1 from public.platform_admins where person_id = v_me) then
    raise exception 'platform admins only' using errcode = '42501';
  end if;
  return v_me;
end $$;

create or replace function private.admin_log(p_action text, p_person uuid, p_venue uuid, p_ref text, p_reason text, p_details jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_audit (admin_person, action, target_person, target_venue, target_ref, reason, details)
  values (private.current_person_id(), p_action, p_person, p_venue, p_ref, p_reason, coalesce(p_details, '{}'))
$$;

create or replace function private.support_ref()
returns text language sql volatile set search_path = '' as $$
  select 'SUP-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5))
$$;

create or replace function private.mask_email(p text)
returns text language sql immutable set search_path = '' as $$
  select case when p is null or position('@' in p) = 0 then null
    else left(p, 1) || '***@' || split_part(p, '@', 2) end
$$;

-- ---------------------------------------------------------------- RPC: who am I / lock check (sign-in)
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin()
$$;

-- called right after a successful sign-in; locked or merged accounts are signed out again
create or replace function public.my_lock()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((
    select jsonb_build_object('locked', p.locked_at is not null or p.merged_into is not null, 'reason', p.locked_reason,
             'merged_into', (select k.plenary_id from public.persons k where k.id = p.merged_into))
    from public.persons p where p.user_id = (select auth.uid())), jsonb_build_object('locked', false))
$$;

-- what admins did to my account (visible to the person concerned)
create or replace function public.my_admin_actions()
returns table (at timestamptz, action text, reason text)
language sql stable security definer set search_path = '' as $$
  select a.at, a.action, a.reason from public.admin_audit a
  where a.target_person = private.current_person_id() order by a.at desc limit 50
$$;

-- ---------------------------------------------------------------- RPC: admin overview + settings
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'support_new', (select count(*) from public.contact_messages where status = 'new') + (select count(*) from public.account_help_requests where status = 'new'),
    'venues_pending', (select count(*) from public.venues where approved_at is null and approval_note is null),
    'require_venue_approval', (select require_venue_approval from public.platform_settings where id));
end $$;

create or replace function public.admin_set_require_approval(p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.platform_settings set require_venue_approval = coalesce(p_on, false), updated_at = now() where id;
  perform private.admin_log('settings.require_venue_approval', null, null, null, null, jsonb_build_object('on', coalesce(p_on, false)));
end $$;

-- ---------------------------------------------------------------- RPC: support inbox
create or replace function public.admin_support_list()
returns table (source text, id uuid, reference text, topic text, subject text, name text, email text, person_id uuid,
               plenary_id text, body text, allow_access boolean, status text, details jsonb, created_at timestamptz, replies jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select x.* from (
    select 'contact'::text, c.id, c.reference, c.kind || coalesce(' · ' || c.topic, ''), coalesce(c.subject, left(c.body, 80)), c.name, c.email::text,
           c.person_id, (select p.plenary_id from public.persons p where p.id = c.person_id), c.body, c.allow_access, c.status, c.details, c.created_at,
           coalesce((select jsonb_agg(jsonb_build_object('body', r.body, 'at', r.created_at, 'emailed', r.emailed) order by r.created_at)
                     from public.support_replies r where r.item_id = c.id), '[]'::jsonb)
    from public.contact_messages c
    union all
    select 'help'::text, h.id, h.reference, 'account help · ' || replace(h.kind, '_', ' '),
           case h.kind when 'lost_email' then 'Move account to ' || coalesce(h.new_email::text, 'a new email') else replace(h.kind, '_', ' ') end,
           h.name, coalesce(h.new_email::text, (select e.email::text from public.person_emails e where e.person_id = h.person_id and e.is_primary)),
           h.person_id, coalesce(h.plenary_id, (select p.plenary_id from public.persons p where p.id = h.person_id)),
           concat_ws(E'\n', 'Old email: ' || h.old_email::text, 'New email: ' || h.new_email::text, 'Proof offered: ' || h.proof, h.note),
           true, h.status, jsonb_build_object('kind', h.kind, 'proof', h.proof, 'old_email', h.old_email), h.created_at,
           coalesce((select jsonb_agg(jsonb_build_object('body', r.body, 'at', r.created_at, 'emailed', r.emailed) order by r.created_at)
                     from public.support_replies r where r.item_id = h.id), '[]'::jsonb)
    from public.account_help_requests h
  ) x order by (x.status = 'closed'), x.created_at desc
  limit 200;
end $$;

create or replace function public.admin_support_reply(p_source text, p_id uuid, p_body text, p_emailed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ref text;
begin
  perform private.require_admin();
  if char_length(btrim(coalesce(p_body, ''))) < 2 then raise exception 'write a reply' using errcode = '22023'; end if;
  if p_source = 'contact' then
    update public.contact_messages set status = case when status = 'closed' then status else 'open' end where id = p_id returning reference into v_ref;
  elsif p_source = 'help' then
    update public.account_help_requests set status = case when status = 'closed' then status else 'open' end where id = p_id returning reference into v_ref;
  else raise exception 'bad source' using errcode = '22023'; end if;
  if v_ref is null then raise exception 'not found' using errcode = 'P0002'; end if;
  insert into public.support_replies (source, item_id, admin_person, body, emailed) values (p_source, p_id, private.current_person_id(), btrim(p_body), coalesce(p_emailed, false));
  perform private.admin_log('support.reply', null, null, v_ref, null, jsonb_build_object('emailed', coalesce(p_emailed, false)));
end $$;

create or replace function public.admin_support_close(p_source text, p_id uuid, p_reopen boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ref text; v_status text := case when coalesce(p_reopen, false) then 'open' else 'closed' end;
begin
  perform private.require_admin();
  if p_source = 'contact' then update public.contact_messages set status = v_status where id = p_id returning reference into v_ref;
  elsif p_source = 'help' then update public.account_help_requests set status = v_status where id = p_id returning reference into v_ref;
  else raise exception 'bad source' using errcode = '22023'; end if;
  if v_ref is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform private.admin_log(case when coalesce(p_reopen, false) then 'support.reopen' else 'support.solved' end, null, null, v_ref, null);
end $$;

-- ---------------------------------------------------------------- RPC: venue approvals
create or replace function public.admin_venues()
returns table (id uuid, slug text, name text, short_name text, kind text, starts_on date, location text, website text, created_at timestamptz,
               approved_at timestamptz, approval_note text, status text, owner_name text, owner_email text, personal_email boolean, papers bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select v.id, v.slug::text, v.name, v.short_name, v.kind::text, v.starts_on, v.location, v.website, v.created_at, v.approved_at, v.approval_note,
         case when v.approved_at is not null then 'approved' when v.approval_note is not null then 'info' else 'pending' end,
         o.display_name, o.email,
         coalesce(split_part(o.email, '@', 2) in ('gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com', 'proton.me', 'protonmail.com', 'gmx.de', 'gmx.net', 'web.de', 'yandex.ru', 'qq.com', '163.com'), false),
         (select count(*) from public.submissions s where s.venue_id = v.id)
  from public.venues v
  left join lateral (
    select p.display_name, (select e.email::text from public.person_emails e where e.person_id = p.id and e.is_primary) email
    from public.venue_members m join public.persons p on p.id = m.person_id
    where m.venue_id = v.id and m.role = 'owner' order by m.created_at limit 1
  ) o on true
  order by (v.approved_at is not null), v.created_at desc
  limit 300;
end $$;

create or replace function public.admin_approve_venue(p_venue uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := private.require_admin(); v_name text; v_owners uuid[];
begin
  update public.venues set approved_at = now(), approved_by = v_me, approval_note = nullif(btrim(coalesce(p_note, '')), '') where id = p_venue returning name into v_name;
  if v_name is null then raise exception 'not found' using errcode = 'P0002'; end if;
  v_owners := array(select person_id from public.venue_members where venue_id = p_venue and role = 'owner');
  perform private.notify(v_owners, 'system', 'Your event is approved', v_name || ' is approved. You can open submissions when your setup checklist is complete.', p_venue, null, 'Open setup', '/manage');
  perform private.admin_log('venue.approved', null, p_venue, null, p_note);
end $$;

create or replace function public.admin_request_venue_info(p_venue uuid, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text; v_owners uuid[];
begin
  perform private.require_admin();
  if char_length(btrim(coalesce(p_message, ''))) < 5 then raise exception 'write what you need to know' using errcode = '22023'; end if;
  update public.venues set approval_note = btrim(p_message), approved_at = null, approved_by = null where id = p_venue returning name into v_name;
  if v_name is null then raise exception 'not found' using errcode = 'P0002'; end if;
  v_owners := array(select person_id from public.venue_members where venue_id = p_venue and role = 'owner');
  perform private.notify(v_owners, 'system', 'Plenary needs more information about ' || v_name, btrim(p_message) || E'\n\nReply to this message and we will continue the check.', p_venue, null, null, null, 'Plenary support', false);
  perform private.admin_log('venue.info_requested', null, p_venue, null, p_message);
end $$;

-- opening submissions waits for approval only when the platform setting is on
create or replace function public.open_submissions(p_venue uuid, p_ack boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_venue_role(p_venue, array['owner', 'program_chair']::public.venue_role[]) then
    raise exception 'only owners and program chairs open submissions' using errcode = '42501';
  end if;
  if not coalesce(p_ack, false) then raise exception 'confirm that settings lock' using errcode = '22023'; end if;
  if coalesce((select require_venue_approval from public.platform_settings where id), false)
     and (select approved_at from public.venues where id = p_venue) is null then
    raise exception 'waiting for Plenary to approve this event' using errcode = '42501';
  end if;
  if exists (select 1 from public.go_live_checks(p_venue) c where not c.ok) then
    raise exception 'go-live checks not passed' using errcode = '22023';
  end if;
  update public.venues set is_published = true, status = 'open', opened_at = now() where id = p_venue;
  update public.venue_settings set locked_at = now() where venue_id = p_venue;
  perform private.log(p_venue, 'event.opened', 'venue', p_venue);
end $$;
grant execute on function public.open_submissions(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------- RPC: find a person, lock / unlock
create or replace function public.admin_find_person(p_query text)
returns table (person_id uuid, display_name text, plenary_id text, orcid text, created_at timestamptz, has_login boolean,
               locked_at timestamptz, locked_reason text, merged_into text, emails jsonb, roles jsonb, last_sign_in jsonb, recent_admin jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare q text := btrim(coalesce(p_query, ''));
begin
  perform private.require_admin();
  if char_length(q) < 3 then return; end if;
  return query
  select p.id, p.display_name, p.plenary_id, p.orcid, p.created_at, p.user_id is not null, p.locked_at, p.locked_reason,
         (select k.plenary_id from public.persons k where k.id = p.merged_into),
         coalesce((select jsonb_agg(jsonb_build_object('email', e.email, 'primary', e.is_primary, 'verified', e.verified_at is not null) order by e.is_primary desc, e.created_at)
                   from public.person_emails e where e.person_id = p.id), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('venue', coalesce(v.short_name, v.name), 'role', m.role) order by v.starts_on desc nulls last)
                   from public.venue_members m join public.venues v on v.id = m.venue_id where m.person_id = p.id), '[]'::jsonb)
         || coalesce((select jsonb_agg(jsonb_build_object('venue', coalesce(v.short_name, v.name), 'role', 'author'))
                   from public.submission_authors a join public.submissions s on s.id = a.submission_id join public.venues v on v.id = s.venue_id where a.person_id = p.id), '[]'::jsonb),
         (select jsonb_build_object('at', si.at, 'method', si.method, 'place', si.place, 'result', si.result)
          from public.sign_in_events si where si.person_id = p.id order by si.at desc limit 1),
         coalesce((select jsonb_agg(jsonb_build_object('at', a.at, 'action', a.action, 'reason', a.reason) order by a.at desc)
                   from (select * from public.admin_audit a2 where a2.target_person = p.id order by a2.at desc limit 5) a), '[]'::jsonb)
  from public.persons p
  where p.id in (
    select e.person_id from public.person_emails e where e.email = q::extensions.citext
    union select p2.id from public.persons p2 where p2.plenary_id = upper(q) or p2.orcid = q
  )
  limit 10;
end $$;

create or replace function public.admin_lock_person(p_person uuid, p_reason text, p_lock boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_me uuid := private.require_admin();
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'give a reason' using errcode = '22023'; end if;
  if p_person = v_me then raise exception 'you cannot lock your own account' using errcode = '22023'; end if;
  if coalesce(p_lock, true) then
    update public.persons set locked_at = now(), locked_reason = left(btrim(p_reason), 300) where id = p_person returning user_id into v_user;
    if not found then raise exception 'not found' using errcode = 'P0002'; end if;
    -- end existing sessions where the auth schema allows it
    if v_user is not null and to_regclass('auth.sessions') is not null then
      begin
        execute 'delete from auth.sessions where user_id = $1' using v_user;
      exception when others then null;
      end;
    end if;
  else
    update public.persons set locked_at = null, locked_reason = null where id = p_person and merged_into is null;
    if not found then raise exception 'not found or merged' using errcode = 'P0002'; end if;
  end if;
  perform private.admin_log(case when coalesce(p_lock, true) then 'person.locked' else 'person.unlocked' end, p_person, null, null, btrim(p_reason));
end $$;

create or replace function public.admin_note(p_action text, p_person uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_action not in ('verification.resent', 'person.signed_out', 'merge.started_by_support') then raise exception 'bad action' using errcode = '22023'; end if;
  if p_action = 'person.signed_out' and to_regclass('auth.sessions') is not null then
    begin
      execute 'delete from auth.sessions where user_id = (select user_id from public.persons where id = $1)' using p_person;
    exception when others then null;
    end;
  end if;
  perform private.admin_log(p_action, p_person, null, null, p_reason);
end $$;

-- ---------------------------------------------------------------- RPC: system status / maintenance
create or replace function public.admin_maintenance()
returns table (id bigint, starts_at timestamptz, ends_at timestamptz, message text, shift_minutes smallint, near_deadlines jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select w.id, w.starts_at, w.ends_at, w.message, w.shift_minutes,
         coalesce((select jsonb_agg(jsonb_build_object('venue', coalesce(v.short_name, v.name), 'label', d.label, 'at', d.starts_at) order by d.starts_at)
                   from public.venue_dates d join public.venues v on v.id = d.venue_id
                   where d.starts_at between w.starts_at - interval '24 hours' and w.ends_at + interval '24 hours'), '[]'::jsonb)
  from public.maintenance_windows w where w.ends_at > now() - interval '7 days' order by w.starts_at;
end $$;

create or replace function public.admin_schedule_maintenance(p_starts timestamptz, p_ends timestamptz, p_message text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  perform private.require_admin();
  if p_starts is null or p_ends is null or p_ends <= p_starts then raise exception 'the end must be after the start' using errcode = '22023'; end if;
  if p_starts < now() then raise exception 'pick a time in the future' using errcode = '22023'; end if;
  if p_ends - p_starts > interval '12 hours' then raise exception 'keep a window under 12 hours' using errcode = '22023'; end if;
  insert into public.maintenance_windows (starts_at, ends_at, message) values (p_starts, p_ends, nullif(left(btrim(coalesce(p_message, '')), 500), '')) returning id into v_id;
  perform private.admin_log('maintenance.scheduled', null, null, v_id::text, null, jsonb_build_object('starts', p_starts, 'ends', p_ends));
  return v_id;
end $$;

create or replace function public.admin_delete_maintenance(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  delete from public.maintenance_windows where id = p_id;
  perform private.admin_log('maintenance.cancelled', null, null, p_id::text, null);
end $$;

create or replace function public.admin_audit_recent(p_limit integer default 30)
returns table (at timestamptz, action text, admin_name text, target text, reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select a.at, a.action, (select p.display_name from public.persons p where p.id = a.admin_person),
         coalesce((select p.display_name || coalesce(' · ' || p.plenary_id, '') from public.persons p where p.id = a.target_person),
                  (select v.name from public.venues v where v.id = a.target_venue), a.target_ref),
         a.reason
  from public.admin_audit a order by a.at desc limit least(greatest(coalesce(p_limit, 30), 1), 200);
end $$;

-- ---------------------------------------------------------------- RPC: AH02 lost email (anonymous allowed, rate limited)
create or replace function public.submit_account_help(p_name text, p_plenary_id text, p_old_email text, p_new_email text, p_proof text, p_note text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_ref text;
begin
  if p_proof not in ('orcid', 'coauthor', 'organizer') then raise exception 'choose how we can confirm it is you' using errcode = '22023'; end if;
  if coalesce(btrim(p_new_email), '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'enter the new email' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'enter your name' using errcode = '22023'; end if;
  if (select count(*) from public.account_help_requests
      where (new_email = p_new_email::extensions.citext or (p_old_email is not null and old_email = p_old_email::extensions.citext))
        and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many requests — try again later' using errcode = '53400';
  end if;
  v_ref := private.support_ref();
  insert into public.account_help_requests (reference, kind, name, plenary_id, old_email, new_email, proof, note, person_id)
  values (v_ref, 'lost_email', left(btrim(p_name), 200), nullif(upper(btrim(coalesce(p_plenary_id, ''))), ''),
          nullif(btrim(coalesce(p_old_email, '')), '')::extensions.citext, btrim(p_new_email)::extensions.citext, p_proof,
          nullif(left(btrim(coalesce(p_note, '')), 2000), ''), private.current_person_id());
  return v_ref;
end $$;

-- ---------------------------------------------------------------- RPC: AH02 merge two accounts
-- 1. signed in to the account to KEEP: start_merge(hash of a random token kept in an http-only cookie)
create or replace function public.start_merge(p_token_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id();
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if (select merged_into from public.persons where id = v_me) is not null then raise exception 'this account was already merged' using errcode = '22023'; end if;
  update public.merge_tokens set expires_at = now() where keeper_person = v_me and used_at is null and expires_at > now();
  insert into public.merge_tokens (token_hash, keeper_person) values (p_token_hash, v_me);
end $$;

-- 2. whoever holds the token: who is the keeper, and is the caller the keeper or the account to merge in
create or replace function public.merge_status(p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare t public.merge_tokens; v_me uuid := private.current_person_id(); k public.persons;
begin
  select * into t from public.merge_tokens where token_hash = p_token_hash;
  if t.id is null then return jsonb_build_object('state', 'none'); end if;
  select * into k from public.persons where id = t.keeper_person;
  return jsonb_build_object(
    'state', case when t.used_at is not null then 'done' when t.expires_at < now() then 'expired' when v_me is null then 'signed_out'
                  when v_me = t.keeper_person then 'keeper' else 'second' end,
    'keeper', jsonb_build_object('name', k.display_name, 'plenary_id', k.plenary_id,
                                 'email', (select e.email::text from public.person_emails e where e.person_id = k.id and e.is_primary)),
    'expires_at', t.expires_at);
end $$;

-- 3. signed in to the SECOND account: what would move
create or replace function public.merge_preview(p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare t public.merge_tokens; v_me uuid := private.current_person_id();
begin
  select * into t from public.merge_tokens where token_hash = p_token_hash and used_at is null and expires_at > now();
  if t.id is null or v_me is null or v_me = t.keeper_person then raise exception 'merge link expired' using errcode = '42501'; end if;
  return jsonb_build_object(
    'papers', (select count(*) from public.submission_authors where person_id = v_me),
    'reviews', (select count(*) from public.review_assignments where reviewer_id = v_me),
    'roles', (select count(*) from public.venue_members where person_id = v_me),
    'threads', (select count(*) from public.inbox_participants where person_id = v_me),
    'follows', (select count(*) from public.venue_follows where person_id = v_me),
    'emails', coalesce((select jsonb_agg(e.email::text) from public.person_emails e where e.person_id = v_me), '[]'::jsonb),
    'shared_venues', coalesce((select jsonb_agg(distinct coalesce(v.short_name, v.name)) from public.venue_members a
                               join public.venue_members b on b.venue_id = a.venue_id and b.person_id = t.keeper_person
                               join public.venues v on v.id = a.venue_id where a.person_id = v_me), '[]'::jsonb),
    'me', (select jsonb_build_object('name', p.display_name, 'plenary_id', p.plenary_id) from public.persons p where p.id = v_me));
end $$;

-- 4. signed in to the SECOND account: move everything into the keeper. The caller proves the second account by
--    being signed in to it; the keeper proved theirs by creating the token.
create or replace function public.merge_accounts(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.merge_tokens; v_me uuid := private.current_person_id(); v_keep uuid; v_user uuid; v_orcid text;
  v_moved_papers int := 0; v_moved_reviews int := 0; v_conflicts jsonb := '[]'::jsonb; v_chairs uuid[];
begin
  select * into t from public.merge_tokens where token_hash = p_token_hash for update;
  if t.id is null or t.used_at is not null or t.expires_at < now() then raise exception 'merge link expired — start again' using errcode = '42501'; end if;
  if v_me is null then raise exception 'sign in to the other account first' using errcode = '42501'; end if;
  v_keep := t.keeper_person;
  if v_me = v_keep then raise exception 'sign in to the OTHER account to confirm' using errcode = '42501'; end if;
  if (select merged_into from public.persons where id = v_me) is not null then raise exception 'this account was already merged' using errcode = '22023'; end if;

  -- venues where both accounts hold a role or authorship: chairs must check conflicts
  v_conflicts := coalesce((
    select jsonb_agg(distinct x.venue_id) from (
      select a.venue_id from public.venue_members a join public.venue_members b on b.venue_id = a.venue_id and b.person_id = v_keep where a.person_id = v_me
      union select s.venue_id from public.review_assignments r join public.submissions s on s.id = r.submission_id
            where r.reviewer_id = v_me and exists (select 1 from public.submission_authors sa where sa.submission_id = s.id and sa.person_id = v_keep)
      union select s.venue_id from public.review_assignments r join public.submissions s on s.id = r.submission_id
            where r.reviewer_id = v_keep and exists (select 1 from public.submission_authors sa where sa.submission_id = s.id and sa.person_id = v_me)
    ) x), '[]'::jsonb);

  -- papers (skip any paper where the keeper is already an author; those stay flagged)
  update public.submission_authors a set person_id = v_keep
  where a.person_id = v_me and not exists (select 1 from public.submission_authors b where b.submission_id = a.submission_id and b.person_id = v_keep);
  get diagnostics v_moved_papers = row_count;
  -- reviews
  update public.review_assignments r set reviewer_id = v_keep
  where r.reviewer_id = v_me and not exists (select 1 from public.review_assignments q where q.submission_id = r.submission_id and q.reviewer_id = v_keep);
  get diagnostics v_moved_reviews = row_count;
  -- roles, inbox, follows
  insert into public.venue_members (venue_id, person_id, role, created_at) select venue_id, v_keep, role, created_at from public.venue_members where person_id = v_me on conflict do nothing;
  delete from public.venue_members where person_id = v_me;
  insert into public.inbox_participants (thread_id, person_id, read_at, archived_at) select thread_id, v_keep, read_at, archived_at from public.inbox_participants where person_id = v_me on conflict do nothing;
  delete from public.inbox_participants where person_id = v_me;
  insert into public.venue_follows (person_id, venue_id, created_at) select v_keep, venue_id, created_at from public.venue_follows where person_id = v_me on conflict do nothing;
  delete from public.venue_follows where person_id = v_me;
  -- emails become extra emails of the keeper
  update public.person_emails set person_id = v_keep, is_primary = false where person_id = v_me;
  -- ORCID moves if the keeper has none
  select orcid into v_orcid from public.persons where id = v_me;
  if v_orcid is not null and (select orcid from public.persons where id = v_keep) is null then
    update public.persons set orcid = null where id = v_me;
    update public.persons set orcid = v_orcid where id = v_keep;
  end if;
  update public.persons set merged_into = v_keep, locked_at = now(),
         locked_reason = 'Merged into ' || coalesce((select plenary_id from public.persons where id = v_keep), 'another account')
  where id = v_me returning user_id into v_user;
  update public.merge_tokens set used_at = now(), merged_person = v_me where id = t.id;
  insert into public.admin_audit (admin_person, action, target_person, details)
  values (v_me, 'account.merged_into', v_keep, jsonb_build_object('merged_person', v_me, 'papers', v_moved_papers, 'reviews', v_moved_reviews, 'conflict_venues', v_conflicts)),
         (v_me, 'account.merged', v_me, jsonb_build_object('into', v_keep));

  if jsonb_array_length(v_conflicts) > 0 then
    v_chairs := array(select distinct m.person_id from public.venue_members m
                      where m.venue_id in (select (jsonb_array_elements_text(v_conflicts))::uuid)
                        and m.role in ('owner', 'chair', 'program_chair') and m.person_id <> v_keep);
    perform private.notify(v_chairs, 'system', 'Two accounts were merged — please check conflicts',
      'Two Plenary accounts of ' || coalesce((select display_name from public.persons where id = v_keep), 'a researcher') ||
      ' (' || coalesce((select plenary_id from public.persons where id = v_keep), '') || ') were merged. Both held roles or papers in your event. Check review assignments and conflicts.',
      null, null, 'Open my roles & conflicts', '/manage/roles');
  end if;

  -- the second login is removed so it can't be used any more (falls back to the lock if not permitted)
  if v_user is not null then
    begin
      delete from auth.users where id = v_user;
    exception when others then null;
    end;
  end if;
  return jsonb_build_object('papers', v_moved_papers, 'reviews', v_moved_reviews, 'conflict_venues', jsonb_array_length(v_conflicts),
                            'keeper_email', (select e.email::text from public.person_emails e where e.person_id = v_keep and e.is_primary));
end $$;

-- ---------------------------------------------------------------- RPC: AH02 claim a paper
-- Signed-in researchers look up a paper by number + venue. To protect double-blind review, only unlinked authors whose
-- family name matches the caller's are shown (masked email), reviewers/editors of the paper are refused, 10 lookups/hour.
create or replace function public.find_claimable_paper(p_number integer, p_venue text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id(); s public.submissions; v_family text; v_venue public.venues;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if (select count(*) from public.claim_lookups where person_id = v_me and at > now() - interval '1 hour') >= 10 then
    raise exception 'too many lookups — try again later' using errcode = '53400';
  end if;
  insert into public.claim_lookups (person_id) values (v_me);
  select * into v_venue from public.venues v
  where v.slug = lower(btrim(coalesce(p_venue, '')))::extensions.citext or lower(v.short_name) = lower(btrim(coalesce(p_venue, ''))) or lower(v.name) = lower(btrim(coalesce(p_venue, '')))
  order by v.starts_on desc nulls last limit 1;
  if v_venue.id is null then return jsonb_build_object('found', false); end if;
  select * into s from public.submissions where venue_id = v_venue.id and number = p_number and stage <> 'draft';
  if s.id is null then return jsonb_build_object('found', false); end if;
  if private.is_reviewer_of(s.id) or private.manages_paper(s.id) then raise exception 'you review or manage this paper' using errcode = '42501'; end if;
  select lower(btrim(family_name)) into v_family from public.persons where id = v_me;
  return jsonb_build_object(
    'found', true, 'submission_id', s.id, 'number', s.number, 'title', s.title, 'venue', coalesce(v_venue.short_name, v_venue.name),
    'already_author', exists (select 1 from public.submission_authors a where a.submission_id = s.id and a.person_id = v_me),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object('person_id', p.id, 'position', a.position, 'name', p.display_name,
               'email', private.mask_email((select e.email::text from public.person_emails e where e.person_id = p.id order by e.is_primary desc limit 1))) order by a.position)
      from public.submission_authors a join public.persons p on p.id = a.person_id
      where a.submission_id = s.id and p.user_id is null and coalesce(v_family, '') <> '' and lower(btrim(p.family_name)) = v_family), '[]'::jsonb),
    'authors', (select count(*) from public.submission_authors a where a.submission_id = s.id),
    'pending', exists (select 1 from public.paper_claims c where c.submission_id = s.id and c.claimant = v_me and c.status = 'pending'));
end $$;

create or replace function public.request_paper_claim(p_submission uuid, p_placeholder uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id(); v_id uuid; v_corr uuid[]; v_title text; v_no int; v_venue uuid;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.submission_authors a join public.persons p on p.id = a.person_id
                 where a.submission_id = p_submission and a.person_id = p_placeholder and p.user_id is null) then
    raise exception 'that author is already linked to an account' using errcode = '22023';
  end if;
  if exists (select 1 from public.submission_authors where submission_id = p_submission and person_id = v_me) then
    raise exception 'you are already an author of this paper' using errcode = '22023';
  end if;
  if lower(btrim((select family_name from public.persons where id = v_me))) <> lower(btrim((select family_name from public.persons where id = p_placeholder))) then
    raise exception 'the name does not match' using errcode = '42501';
  end if;
  insert into public.paper_claims (submission_id, claimant, placeholder) values (p_submission, v_me, p_placeholder)
  on conflict (submission_id, claimant, placeholder) do update set status = case when public.paper_claims.status = 'declined' then 'pending' else public.paper_claims.status end
  returning id into v_id;
  select title, number, venue_id into v_title, v_no, v_venue from public.submissions where id = p_submission;
  v_corr := array(select a.person_id from public.submission_authors a join public.persons p on p.id = a.person_id
                  where a.submission_id = p_submission and a.is_corresponding and p.user_id is not null);
  if cardinality(v_corr) = 0 then
    v_corr := array(select a.person_id from public.submission_authors a join public.persons p on p.id = a.person_id
                    where a.submission_id = p_submission and p.user_id is not null order by a.position limit 1);
  end if;
  perform private.notify(v_corr, 'coauthor', 'Is this your co-author? #' || lpad(coalesce(v_no, 0)::text, 4, '0'),
    coalesce((select display_name from public.persons where id = v_me), 'A researcher') || ' (' || coalesce((select plenary_id from public.persons where id = v_me), '') ||
    ') asks to be linked to the author "' || coalesce((select display_name from public.persons where id = p_placeholder), '') || '" on "' || coalesce(v_title, '') || '". Please confirm or decline.',
    v_venue, p_submission, 'Confirm or decline', '/account-help/claim/' || v_id::text);
  return v_id;
end $$;

create or replace function public.paper_claim(p_claim uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.paper_claims; v_me uuid := private.current_person_id(); v_can boolean;
begin
  select * into c from public.paper_claims where id = p_claim;
  if c.id is null or v_me is null then raise exception 'not found' using errcode = 'P0002'; end if;
  v_can := exists (select 1 from public.submission_authors a where a.submission_id = c.submission_id and a.person_id = v_me and a.is_corresponding)
           or (not exists (select 1 from public.submission_authors a join public.persons p on p.id = a.person_id where a.submission_id = c.submission_id and a.is_corresponding and p.user_id is not null)
               and exists (select 1 from public.submission_authors a where a.submission_id = c.submission_id and a.person_id = v_me));
  if not v_can and v_me <> c.claimant then raise exception 'not found' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', c.id, 'status', c.status, 'can_decide', v_can and c.status = 'pending', 'is_claimant', v_me = c.claimant,
    'paper', (select jsonb_build_object('number', s.number, 'title', s.title) from public.submissions s where s.id = c.submission_id),
    'claimant', (select jsonb_build_object('name', p.display_name, 'plenary_id', p.plenary_id,
                   'affiliation', (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1))
                 from public.persons p where p.id = c.claimant),
    'placeholder', (select jsonb_build_object('name', p.display_name, 'email', private.mask_email((select e.email::text from public.person_emails e where e.person_id = p.id order by e.is_primary desc limit 1)))
                    from public.persons p where p.id = c.placeholder),
    'submission_id', c.submission_id);
end $$;

create or replace function public.respond_paper_claim(p_claim uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.paper_claims; v_me uuid := private.current_person_id(); v_ok boolean; v_title text;
begin
  select * into c from public.paper_claims where id = p_claim for update;
  if c.id is null or c.status <> 'pending' then raise exception 'this request was already answered' using errcode = '22023'; end if;
  v_ok := exists (select 1 from public.submission_authors a where a.submission_id = c.submission_id and a.person_id = v_me and a.is_corresponding)
          or (not exists (select 1 from public.submission_authors a join public.persons p on p.id = a.person_id where a.submission_id = c.submission_id and a.is_corresponding and p.user_id is not null)
              and exists (select 1 from public.submission_authors a where a.submission_id = c.submission_id and a.person_id = v_me));
  if not v_ok or v_me = c.claimant then raise exception 'only the corresponding author can answer' using errcode = '42501'; end if;
  if coalesce(p_accept, false) then
    if exists (select 1 from public.submission_authors where submission_id = c.submission_id and person_id = c.claimant) then
      raise exception 'already an author' using errcode = '22023';
    end if;
    update public.submission_authors set person_id = c.claimant where submission_id = c.submission_id and person_id = c.placeholder;
  end if;
  update public.paper_claims set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end, decided_by = v_me, decided_at = now() where id = c.id;
  select title into v_title from public.submissions where id = c.submission_id;
  perform private.notify(array[c.claimant], 'coauthor',
    case when coalesce(p_accept, false) then 'You are now linked to a paper' else 'Your paper claim was declined' end,
    case when coalesce(p_accept, false) then '"' || coalesce(v_title, '') || '" is now in My submissions.'
         else 'The corresponding author of "' || coalesce(v_title, '') || '" did not confirm. If this is a mistake, write to them or to Plenary support.' end,
    null, c.submission_id, case when coalesce(p_accept, false) then 'Open paper' end,
    case when coalesce(p_accept, false) then '/submissions/' || c.submission_id::text end);
end $$;

-- ---------------------------------------------------------------- grants
revoke all on function private.require_admin(), private.admin_log(text, uuid, uuid, text, text, jsonb), private.support_ref(), private.mask_email(text) from public, anon;
revoke all on function public.is_platform_admin(), public.my_lock(), public.my_admin_actions(), public.admin_overview(), public.admin_set_require_approval(boolean),
  public.admin_support_list(), public.admin_support_reply(text, uuid, text, boolean), public.admin_support_close(text, uuid, boolean),
  public.admin_venues(), public.admin_approve_venue(uuid, text), public.admin_request_venue_info(uuid, text),
  public.admin_find_person(text), public.admin_lock_person(uuid, text, boolean), public.admin_note(text, uuid, text),
  public.admin_maintenance(), public.admin_schedule_maintenance(timestamptz, timestamptz, text), public.admin_delete_maintenance(bigint), public.admin_audit_recent(integer),
  public.start_merge(text), public.merge_status(text), public.merge_preview(text), public.merge_accounts(text),
  public.find_claimable_paper(integer, text), public.request_paper_claim(uuid, uuid), public.paper_claim(uuid), public.respond_paper_claim(uuid, boolean),
  public.submit_account_help(text, text, text, text, text, text) from public, anon;
grant execute on function public.is_platform_admin(), public.my_lock(), public.my_admin_actions(), public.admin_overview(), public.admin_set_require_approval(boolean),
  public.admin_support_list(), public.admin_support_reply(text, uuid, text, boolean), public.admin_support_close(text, uuid, boolean),
  public.admin_venues(), public.admin_approve_venue(uuid, text), public.admin_request_venue_info(uuid, text),
  public.admin_find_person(text), public.admin_lock_person(uuid, text, boolean), public.admin_note(text, uuid, text),
  public.admin_maintenance(), public.admin_schedule_maintenance(timestamptz, timestamptz, text), public.admin_delete_maintenance(bigint), public.admin_audit_recent(integer),
  public.start_merge(text), public.merge_status(text), public.merge_preview(text), public.merge_accounts(text),
  public.find_claimable_paper(integer, text), public.request_paper_claim(uuid, uuid), public.paper_claim(uuid), public.respond_paper_claim(uuid, boolean) to authenticated;
grant execute on function public.submit_account_help(text, text, text, text, text, text) to anon, authenticated;
