-- Data slice: UN01 one-click unsubscribe (no sign-in) and ST05 data export + account deletion processing.
-- Additive. Tokens are stored as sha256 hashes only (lib/tokens.ts); the raw token only exists in the email link.

-- ---------------------------------------------------------------- UN01: unsubscribe links
create table public.email_unsub_tokens (
  token_hash  text primary key check (char_length(token_hash) = 64),
  person_id   uuid not null references public.persons (id) on delete cascade,
  venue_id    uuid references public.venues (id) on delete cascade,
  category    text not null check (category in ('review_invitations', 'announcements')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '1 year'
);
create index email_unsub_tokens_person_idx on public.email_unsub_tokens (person_id);
alter table public.email_unsub_tokens enable row level security;
revoke all on public.email_unsub_tokens from anon, authenticated;   -- only the functions below touch it

-- Senders (organizers and AEs of the venue, or the person themself) register the hashes of the links they mail.
create or replace function public.issue_unsub_tokens(p_venue uuid, p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if private.current_person_id() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_venue is not null and not (private.is_organizer(p_venue)
      or private.has_venue_role(p_venue, array['associate_editor']::public.venue_role[])) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.email_unsub_tokens (token_hash, person_id, venue_id, category)
  select i->>'token_hash', (i->>'person_id')::uuid, p_venue, coalesce(i->>'category', 'announcements')
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  where (p_venue is not null or (i->>'person_id')::uuid = private.current_person_id())
  on conflict (token_hash) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Same helper as the admin migration (same parameter name, so either order works).
create or replace function private.mask_email(p text)
returns text language sql immutable set search_path = '' as $$
  select case when p is null or position('@' in p) < 2 then null
              else left(p, 1) || '***' || substr(p, position('@' in p)) end
$$;

-- What the unsubscribe page shows. Null when the link is unknown or expired.
create or replace function public.unsub_info(p_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'venue', coalesce(v.short_name, v.name),
    'venue_year', null,
    'category', t.category,
    'email', private.mask_email((select e.email::text from public.person_emails e where e.person_id = t.person_id order by e.is_primary desc, e.created_at limit 1)),
    'main', exists (select 1 from public.email_unsubscribes u where u.person_id = t.person_id and u.category = t.category
                    and u.venue_id is not distinct from t.venue_id),
    'all_announcements', exists (select 1 from public.email_unsubscribes u where u.person_id = t.person_id and u.venue_id is null
                                 and u.category in ('announcements', 'all_optional')),
    'review_invitations', exists (select 1 from public.email_unsubscribes u where u.person_id = t.person_id and u.category = 'review_invitations'
                                  and (u.venue_id is null or u.venue_id is not distinct from t.venue_id)),
    'product_news', not coalesce((select c.granted from public.consents c where c.person_id = t.person_id and c.kind = 'product_news'), false))
  from public.email_unsub_tokens t left join public.venues v on v.id = t.venue_id
  where t.token_hash = p_hash and t.expires_at > now()
$$;

-- p_what: main (the link's own list), all_announcements, review_invitations (this venue), product_news. p_stop = stop sending.
create or replace function public.unsub_set(p_hash text, p_what text, p_stop boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.email_unsub_tokens;
begin
  select * into t from public.email_unsub_tokens where token_hash = p_hash and expires_at > now();
  if t.token_hash is null then raise exception 'link not valid' using errcode = '22023'; end if;
  if p_what = 'main' then
    if p_stop then
      insert into public.email_unsubscribes (person_id, venue_id, category) values (t.person_id, t.venue_id, t.category) on conflict do nothing;
    else
      delete from public.email_unsubscribes where person_id = t.person_id and category = t.category and venue_id is not distinct from t.venue_id;
    end if;
  elsif p_what = 'all_announcements' then
    if p_stop then
      insert into public.email_unsubscribes (person_id, venue_id, category) values (t.person_id, null, 'announcements') on conflict do nothing;
    else
      delete from public.email_unsubscribes where person_id = t.person_id and venue_id is null and category in ('announcements', 'all_optional');
    end if;
  elsif p_what = 'review_invitations' then
    if p_stop then
      insert into public.email_unsubscribes (person_id, venue_id, category) values (t.person_id, t.venue_id, 'review_invitations') on conflict do nothing;
    else
      delete from public.email_unsubscribes where person_id = t.person_id and category = 'review_invitations' and venue_id is not distinct from t.venue_id;
    end if;
  elsif p_what = 'product_news' then
    insert into public.consents (person_id, kind, granted, recorded_at) values (t.person_id, 'product_news', not p_stop, now())
    on conflict (person_id, kind) do update set granted = excluded.granted, recorded_at = excluded.recorded_at;
  else
    raise exception 'bad choice' using errcode = '22023';
  end if;
  return public.unsub_info(p_hash);
end $$;

revoke all on function public.issue_unsub_tokens(uuid, jsonb), public.unsub_info(text), public.unsub_set(text, text, boolean) from public;
grant execute on function public.issue_unsub_tokens(uuid, jsonb) to authenticated;
grant execute on function public.unsub_info(text), public.unsub_set(text, text, boolean) to anon, authenticated;

-- Optional mail (campaigns not tied to the person's own paper or review) always skips people who unsubscribed (UN01).
-- Same as ops2's version, except that 'unsub' is forced on unless the message is about the person's own paper/review.
create or replace function public.campaign_audience(p_venue uuid, p_roles text[], p_conditions text[])
returns table (person_id uuid, submission_id uuid, paper_number integer, paper_title text, missing text)
language plpgsql stable security definer set search_path = '' as $$
declare
  c_acc boolean := 'acc' = any (coalesce(p_conditions, '{}'));
  c_inc boolean := 'inc' = any (coalesce(p_conditions, '{}'));
  c_late boolean := 'late' = any (coalesce(p_conditions, '{}'));
  c_unsub boolean := 'unsub' = any (coalesce(p_conditions, '{}')) or not (c_acc or c_inc or c_late);
begin
  if not private.is_venue_chair(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  with rows as (
    select a.person_id pid, s.id sid, s.number num, s.title ttl,
           (select array_to_string(f.missing, ', ') from public.finals_overview(p_venue) f where f.submission_id = s.id) miss
    from public.submission_authors a join public.submissions s on s.id = a.submission_id
    where 'authors' = any (p_roles) and s.venue_id = p_venue and s.stage not in ('draft', 'withdrawn')
      and (not c_acc or s.stage in ('final', 'done'))
      and (not c_inc or exists (select 1 from public.finals_overview(p_venue) f where f.submission_id = s.id and f.status in ('in_progress', 'incomplete')))
    union all
    select r.reviewer_id, s.id, s.number, s.title, null
    from public.review_assignments r join public.submissions s on s.id = r.submission_id
    where 'reviewers' = any (p_roles) and s.venue_id = p_venue and r.reviewer_id is not null and r.status in ('accepted', 'submitted')
      and (not c_late or (r.status = 'accepted' and r.due_at < now()))
    union all
    select m.person_id, null::uuid, null::integer, null::text, null from public.venue_members m
    where 'aes' = any (p_roles) and m.venue_id = p_venue and m.role = 'associate_editor' and not c_late
    union all
    select x.pid, null::uuid, null::integer, null::text, null from (
      select se.chair_id pid from public.sessions se where se.venue_id = p_venue and se.chair_id is not null
      union select se.cochair_id from public.sessions se where se.venue_id = p_venue and se.cochair_id is not null
      union select m.person_id from public.venue_members m where m.venue_id = p_venue and m.role = 'session_chair') x
    where 'session_chairs' = any (p_roles) and not c_late
    union all
    select m.person_id, null::uuid, null::integer, null::text, null from public.venue_members m
    where 'committee' = any (p_roles) and m.venue_id = p_venue and not c_late
      and m.role in ('owner', 'chair', 'program_chair', 'deputy_chair', 'ceb_chair', 'publication_chair', 'registration_chair', 'staff', 'associate_editor')
  )
  select distinct on (r.pid) r.pid, r.sid, r.num, r.ttl, r.miss
  from rows r
  where r.pid is not null
    and (not c_unsub or not exists (select 1 from public.email_unsubscribes u where u.person_id = r.pid
         and (u.venue_id is null or u.venue_id = p_venue) and u.category in ('announcements', 'all_optional')))
  order by r.pid, r.num nulls last;
end $$;

-- Venue-wide announcements skip people who unsubscribed; announcements about a session they are in still reach them.
create or replace function public.announcement_audience(p_venue uuid, p_session uuid default null)
returns table (person_id uuid)
language sql stable security definer set search_path = '' as $$
  select distinct x.pid from (
    select g.person_id pid from public.registrations g where g.venue_id = p_venue and p_session is null
    union select i.person_id from public.schedule_items i where i.session_id = p_session
    union select t.presenter_id from public.session_talks t where t.session_id = p_session
    union select se.chair_id from public.sessions se where se.id = p_session
    union select se.cochair_id from public.sessions se where se.id = p_session
  ) x where x.pid is not null and private.is_organizer(p_venue)
    and (p_session is not null or not exists (select 1 from public.email_unsubscribes u where u.person_id = x.pid
         and (u.venue_id is null or u.venue_id = p_venue) and u.category in ('announcements', 'all_optional')))
$$;
revoke all on function public.campaign_audience(uuid, text[], text[]), public.announcement_audience(uuid, uuid) from public, anon;
grant execute on function public.campaign_audience(uuid, text[], text[]), public.announcement_audience(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- ST05: export files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exports', 'exports', false, 52428800, array['application/zip'])
on conflict (id) do nothing;

-- Path: {person_id}/{request_id}.zip — only the owner reads, writes or removes it.
create policy exports_select on storage.objects for select to authenticated
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = (select private.current_person_id())::text);
create policy exports_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'exports' and (storage.foldername(name))[1] = (select private.current_person_id())::text);
create policy exports_delete on storage.objects for delete to authenticated
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = (select private.current_person_id())::text);

alter table public.persons add column if not exists deleted_at timestamptz;

-- Opens an export request (or returns the one already being prepared). At most 5 a day.
create or replace function public.start_export()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id(); v_id uuid;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select id into v_id from public.data_requests where person_id = v_me and kind = 'export' and status in ('requested', 'preparing')
    and created_at > now() - interval '15 minutes' order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  if (select count(*) from public.data_requests where person_id = v_me and kind = 'export' and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many exports today — try again tomorrow' using errcode = '53400';
  end if;
  insert into public.data_requests (person_id, kind, status) values (v_me, 'export', 'preparing') returning id into v_id;
  return v_id;
end $$;

create or replace function public.finish_export(p_id uuid, p_path text, p_bytes bigint, p_note jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id();
begin
  if p_path is null or p_path <> v_me::text || '/' || p_id::text || '.zip' then raise exception 'bad path' using errcode = '22023'; end if;
  update public.data_requests
     set status = 'ready', file_path = p_path, updated_at = now(),
         detail = coalesce(p_note, '{}'::jsonb) || jsonb_build_object('bytes', p_bytes, 'expires_at', now() + interval '7 days')
   where id = p_id and person_id = v_me and kind = 'export' and status in ('requested', 'preparing');
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;
end $$;

create or replace function public.fail_export(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.data_requests set status = 'blocked', blocked_reason = left(coalesce(p_reason, 'export failed'), 300), updated_at = now()
   where id = p_id and person_id = private.current_person_id() and kind = 'export' and status in ('requested', 'preparing');
end $$;

-- Everything Plenary holds about the caller, as one JSON document (reviews they wrote, never other people's reviews of their papers).
create or replace function public.my_export_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id();
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  return jsonb_build_object(
    'generated_at', now(),
    'profile', (select to_jsonb(p) - 'user_id' from public.persons p where p.id = v_me),
    'emails', coalesce((select jsonb_agg(jsonb_build_object('email', e.email, 'primary', e.is_primary, 'verified_at', e.verified_at, 'added_at', e.created_at) order by e.created_at)
                        from public.person_emails e where e.person_id = v_me), '[]'),
    'affiliations', coalesce((select jsonb_agg(to_jsonb(a) - 'person_id') from public.affiliations a where a.person_id = v_me), '[]'),
    'topics', coalesce((select jsonb_agg(t.topic order by t.topic) from public.person_topics t where t.person_id = v_me), '[]'),
    'notification_prefs', (select to_jsonb(n) - 'person_id' from public.notification_prefs n where n.person_id = v_me),
    'papers', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'number', s.number, 'title', s.title, 'abstract', s.abstract, 'keywords', s.keywords, 'paper_type', s.paper_type,
        'stage', s.stage, 'venue', coalesce(v.short_name, v.name), 'submitted_at', s.submitted_at, 'created_at', s.created_at,
        'my_position', a.position, 'corresponding', a.is_corresponding,
        'authors', (select jsonb_agg(p2.display_name order by a2.position) from public.submission_authors a2 join public.persons p2 on p2.id = a2.person_id where a2.submission_id = s.id),
        'files', coalesce((select jsonb_agg(jsonb_build_object('role', f.role, 'file_name', f.file_name, 'version', f.version, 'current', f.is_current,
                    'bytes', f.size_bytes, 'storage_path', f.storage_path, 'uploaded_at', f.created_at) order by f.created_at)
                  from public.submission_files f where f.submission_id = s.id), '[]')) order by s.created_at)
      from public.submission_authors a join public.submissions s on s.id = a.submission_id join public.venues v on v.id = s.venue_id
      where a.person_id = v_me), '[]'),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
        'paper_number', s.number, 'paper_title', s.title, 'venue', coalesce(v.short_name, v.name), 'round', r.round, 'status', r.status,
        'due_at', r.due_at, 'scores', w.scores, 'recommendation', w.recommendation, 'confidence', w.confidence,
        'to_authors', w.to_authors, 'to_editor', w.to_editor, 'submitted_at', w.submitted_at) order by r.due_at)
      from public.review_assignments r join public.submissions s on s.id = r.submission_id join public.venues v on v.id = s.venue_id
      left join public.reviews w on w.assignment_id = r.id
      where r.reviewer_id = v_me), '[]'),
    'inbox', coalesce((select jsonb_agg(jsonb_build_object('subject', t.subject, 'kind', t.kind, 'created_at', t.created_at,
        'messages', (select jsonb_agg(jsonb_build_object('from', case when m.sender_id = v_me then 'me' else coalesce(m.sender_label, sp.display_name, 'Plenary') end,
                       'body', m.body, 'at', m.created_at) order by m.created_at)
                     from public.inbox_messages m left join public.persons sp on sp.id = m.sender_id where m.thread_id = t.id)) order by t.created_at)
      from public.inbox_participants pa join public.inbox_threads t on t.id = pa.thread_id where pa.person_id = v_me), '[]'),
    'sign_ins', coalesce((select jsonb_agg(jsonb_build_object('at', e.at, 'method', e.method, 'place', e.place, 'device', e.user_agent, 'result', e.result) order by e.at desc)
      from public.sign_in_events e where e.person_id = v_me), '[]'),
    'consents', coalesce((select jsonb_agg(jsonb_build_object('kind', c.kind, 'granted', c.granted, 'recorded_at', c.recorded_at)) from public.consents c where c.person_id = v_me), '[]'),
    'registrations', coalesce((select jsonb_agg(jsonb_build_object('venue', coalesce(v.short_name, v.name), 'number', g.number, 'type', g.reg_type,
        'paid_at', g.paid_at, 'checked_in_at', g.checked_in_at)) from public.registrations g join public.venues v on v.id = g.venue_id where g.person_id = v_me), '[]'),
    'followed_venues', coalesce((select jsonb_agg(coalesce(v.short_name, v.name)) from public.venue_follows f join public.venues v on v.id = f.venue_id where f.person_id = v_me), '[]'),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('kind', d.kind, 'status', d.status, 'created_at', d.created_at) order by d.created_at)
      from public.data_requests d where d.person_id = v_me), '[]'));
end $$;

-- ---------------------------------------------------------------- ST04/ST05: account deletion
create or replace function public.cancel_deletion(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.data_requests set status = 'cancelled', updated_at = now()
   where id = p_id and person_id = private.current_person_id() and kind = 'delete' and status = 'requested';
  if not found then raise exception 'nothing to cancel' using errcode = '22023'; end if;
end $$;

-- Why a deletion can't run yet (null = it can).
create or replace function private.deletion_blocker(p_person uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when (select count(*) from public.review_assignments where reviewer_id = p_person and status = 'accepted') > 0
      or (select count(*) from public.submission_authors a join public.submissions s on s.id = a.submission_id
          where a.person_id = p_person and s.stage in ('submitted', 'review', 'decision', 'revise')) > 0
      then (select count(*) from public.review_assignments where reviewer_id = p_person and status = 'accepted') || ' reviews in progress and '
        || (select count(*) from public.submission_authors a join public.submissions s on s.id = a.submission_id
            where a.person_id = p_person and s.stage in ('submitted', 'review', 'decision', 'revise')) || ' papers under review'
    when exists (select 1 from public.venue_members m join public.venues v on v.id = m.venue_id
                 where m.person_id = p_person and m.role = 'owner' and v.status <> 'archived'
                   and not exists (select 1 from public.venue_members o where o.venue_id = m.venue_id and o.role = 'owner' and o.person_id <> p_person))
      then 'you are the only owner of an event — hand it over first'
  end
$$;

-- Removes the profile; keeps published papers and submitted reviews, now attributed to "Deleted user" (ST04).
create or replace function private.delete_person(p_person uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  select user_id into v_uid from public.persons where id = p_person;
  -- drafts only this person worked on
  delete from public.submissions s where s.stage = 'draft'
    and exists (select 1 from public.submission_authors a where a.submission_id = s.id and a.person_id = p_person)
    and not exists (select 1 from public.submission_authors a where a.submission_id = s.id and a.person_id <> p_person);
  -- open invitations and bids go; submitted reviews stay
  update public.review_assignments set status = 'cancelled' where reviewer_id = p_person and status in ('invited');
  delete from public.bids where person_id = p_person;
  delete from public.person_emails where person_id = p_person;
  delete from public.affiliations where person_id = p_person;
  delete from public.person_topics where person_id = p_person;
  delete from public.notification_prefs where person_id = p_person;
  delete from public.calendar_feeds where person_id = p_person;
  delete from public.consents where person_id = p_person;
  delete from public.sign_in_events where person_id = p_person;
  delete from public.email_unsubscribes where person_id = p_person;
  delete from public.email_unsub_tokens where person_id = p_person;
  delete from public.venue_follows where person_id = p_person;
  delete from public.inbox_participants where person_id = p_person;
  update public.registrations set full_name = null, email = null, affiliation = null where person_id = p_person;
  update public.persons set user_id = null, given_name = 'Deleted', family_name = 'user', other_names = '{}', orcid = null, country = null,
         is_public = false, paper_name = null, name_scripts = '[]'::jsonb, pronouns = null, ieee_member = null, scholar_url = null,
         timezone = null, locale = null, visibility = 'venues_only', availability = 'off', deleted_at = now()
   where id = p_person;
  if v_uid is not null then delete from auth.users where id = v_uid; end if;
end $$;

-- Run by the scheduled job (service role only): due deletions + expired exports. Returns export files to remove from storage.
create or replace function public.run_due_data_requests()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_block text; v_done int := 0; v_blocked int := 0; v_files text[] := '{}';
begin
  for r in select id, person_id from public.data_requests where kind = 'delete' and status = 'requested' and scheduled_for <= now() order by scheduled_for loop
    v_block := private.deletion_blocker(r.person_id);
    if v_block is not null then
      update public.data_requests set status = 'blocked', blocked_reason = v_block, updated_at = now() where id = r.id;
      v_blocked := v_blocked + 1;
    else
      perform private.delete_person(r.person_id);
      update public.data_requests set status = 'done', updated_at = now() where id = r.id;
      v_done := v_done + 1;
    end if;
  end loop;
  with x as (
    update public.data_requests set status = 'done', updated_at = now(), detail = detail || '{"expired":true}'::jsonb
     where kind = 'export' and status = 'ready' and (detail->>'expires_at')::timestamptz < now()
    returning file_path)
  select coalesce(array_agg(file_path) filter (where file_path is not null), '{}') into v_files from x;
  return jsonb_build_object('deleted', v_done, 'blocked', v_blocked, 'expired_files', to_jsonb(v_files));
end $$;

revoke all on function public.start_export(), public.finish_export(uuid, text, bigint, jsonb), public.fail_export(uuid, text),
  public.my_export_data(), public.cancel_deletion(uuid), public.run_due_data_requests() from public, anon;
grant execute on function public.start_export(), public.finish_export(uuid, text, bigint, jsonb), public.fail_export(uuid, text),
  public.my_export_data(), public.cancel_deletion(uuid) to authenticated;
revoke execute on function public.run_due_data_requests() from authenticated;
grant execute on function public.run_due_data_requests() to service_role;
revoke all on function private.delete_person(uuid), private.deletion_blocker(uuid), private.mask_email(text) from public, anon, authenticated;
