-- Account pages (ST01–ST04, CL01), inbox (IN01) and search (SR01).

-- ST01: the role at an affiliation ("Senior lecturer") and names in other scripts are edited by their owner.
alter table public.affiliations add column if not exists position_title text check (char_length(position_title) <= 120);
grant update (name_scripts) on public.persons to authenticated;

-- ST01: my declared conflicts with the other person's name (persons RLS would hide most of them).
create or replace function public.my_conflicts()
returns table (id uuid, other_person uuid, other_name text, other_plenary_id text, institution text, reason text, until_year smallint)
language sql stable security definer set search_path = '' as $$
  select c.id, c.other_person, p.display_name, p.plenary_id, c.institution, c.reason, c.until_year
  from public.declared_conflicts c left join public.persons p on p.id = c.other_person
  where c.person_id = private.current_person_id()
  order by c.created_at
$$;
revoke all on function public.my_conflicts() from public, anon;
grant execute on function public.my_conflicts() to authenticated;

-- IN01: messages of a thread with sender names, for its participants only (persons RLS would hide most senders).
create or replace function public.thread_messages(p_thread uuid)
returns table (id uuid, sender text, is_me boolean, body text, cta_label text, cta_url text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, coalesce(m.sender_label, p.display_name, 'Plenary'), m.sender_id is not null and m.sender_id = private.current_person_id(),
         m.body, m.cta_label, m.cta_url, m.created_at
  from public.inbox_messages m left join public.persons p on p.id = m.sender_id
  where m.thread_id = p_thread and private.in_thread(p_thread)
  order by m.created_at
$$;
revoke all on function public.thread_messages(uuid) from public, anon;
grant execute on function public.thread_messages(uuid) to authenticated;

-- SR01: one search over what the caller may see. SECURITY INVOKER, so every table's RLS applies.
create or replace function public.search_everything(p_q text)
returns table (kind text, id uuid, title text, meta text, href text)
language sql stable set search_path = '' as $$
  with q as (select '%' || replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat)
  select 'paper', s.id, s.title,
         '#' || lpad(coalesce(s.number, 0)::text, 4, '0') || ' · ' || coalesce(v.short_name, v.name) || ' · ' || coalesce(s.stage_detail, s.stage::text),
         '/submissions/' || s.id
  from public.submission_authors a
  join public.submissions s on s.id = a.submission_id
  join public.venues v on v.id = s.venue_id, q
  where a.person_id = private.current_person_id()
    and (s.title ilike q.pat or s.abstract ilike q.pat or array_to_string(s.keywords, ' ') ilike q.pat or coalesce(s.number::text, '') = btrim(p_q, ' #'))
  union all
  select 'venue', v.id, coalesce(v.short_name || ' — ', '') || v.name,
         concat_ws(' · ', nullif(v.society, ''), nullif(v.location, ''), to_char(v.starts_on, 'DD Mon YYYY')),
         '/venues/' || v.slug::text
  from public.venues v, q
  where v.is_published and (v.name ilike q.pat or v.short_name ilike q.pat or v.society ilike q.pat or v.field ilike q.pat
        or v.location ilike q.pat or v.city ilike q.pat or v.country ilike q.pat)
  union all
  select 'person', p.id, p.display_name,
         concat_ws(' · ', (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1),
                   'Plenary ID ' || p.plenary_id),
         null::text
  from public.persons p, q
  where p.id <> coalesce(private.current_person_id(), '00000000-0000-0000-0000-000000000000'::uuid)
    and (p.display_name ilike q.pat or p.plenary_id ilike q.pat
         or exists (select 1 from public.person_topics t where t.person_id = p.id and t.topic ilike q.pat))
  union all
  select 'review', r.id, '#' || lpad(coalesce(s.number, 0)::text, 4, '0') || ' · ' || s.title,
         'Your review · ' || coalesce(v.short_name, v.name) || ' · ' || r.status,
         '/reviews/' || r.id
  from public.review_assignments r
  join public.submissions s on s.id = r.submission_id
  join public.venues v on v.id = s.venue_id, q
  where r.reviewer_id = private.current_person_id() and (s.title ilike q.pat or s.abstract ilike q.pat)
  limit 120
$$;
revoke all on function public.search_everything(text) from public, anon;
grant execute on function public.search_everything(text) to authenticated;

-- ST02: sign-in activity, written by the app right after a sign-in attempt for the signed-in person.
create or replace function public.record_sign_in(p_method text, p_place text, p_user_agent text, p_result text default 'ok')
returns void language sql security definer set search_path = '' as $$
  insert into public.sign_in_events (person_id, method, place, user_agent, result)
  select private.current_person_id(), left(coalesce(p_method, 'password'), 30), left(p_place, 120), left(p_user_agent, 300), left(coalesce(p_result, 'ok'), 120)
  where private.current_person_id() is not null
$$;
revoke all on function public.record_sign_in(text, text, text, text) from public, anon;
grant execute on function public.record_sign_in(text, text, text, text) to authenticated;

-- CL01: latest feed of the caller (the token itself is never stored, only its hash).
create or replace function public.my_calendar_feed()
returns table (id uuid, flags jsonb, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.id, f.flags, f.created_at from public.calendar_feeds f
  where f.person_id = private.current_person_id() and f.revoked_at is null
  order by f.created_at desc limit 1
$$;
revoke all on function public.my_calendar_feed() from public, anon;
grant execute on function public.my_calendar_feed() to authenticated;

-- CL01: what the caller's feed would hold with these flags (preview, counts, one-off .ics download).
create or replace function public.my_calendar_items(p_flags jsonb default null)
returns table (category text, uid text, title text, starts_at timestamptz, ends_at timestamptz, location text, description text, url text)
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id();
        v_flags jsonb := coalesce(p_flags, '{"submissions":true,"reviews":true,"sessions":true,"followed":false}'::jsonb);
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if coalesce((v_flags ->> 'submissions')::boolean, true) then
    return query select 'submissions'::text, 'sub-' || s.id || '-' || d.id, coalesce(v.short_name, v.name) || ' · ' || d.label || ' · #' || lpad(coalesce(s.number, 0)::text, 4, '0'),
      d.starts_at, d.starts_at + interval '30 minutes', null::text, s.title, '/submissions/' || s.id
    from public.submission_authors a join public.submissions s on s.id = a.submission_id join public.venues v on v.id = s.venue_id
    join public.venue_dates d on d.venue_id = v.id and d.kind in ('submission', 'final', 'registration', 'rebuttal')
    where a.person_id = v_me and s.stage not in ('withdrawn', 'rejected') and d.starts_at > now() - interval '30 days';
  end if;
  if coalesce((v_flags ->> 'reviews')::boolean, true) then
    return query select 'reviews'::text, 'rev-' || r.id, 'Review due · #' || lpad(coalesce(s.number, 0)::text, 4, '0') || ' · ' || coalesce(v.short_name, v.name),
      r.due_at, r.due_at + interval '30 minutes', null::text, s.title, '/reviews/' || r.id
    from public.review_assignments r join public.submissions s on s.id = r.submission_id join public.venues v on v.id = s.venue_id
    where r.reviewer_id = v_me and r.status = 'accepted';
  end if;
  if coalesce((v_flags ->> 'sessions')::boolean, true) then
    return query select 'sessions'::text, 'ses-' || s.id, s.code || ' · ' || s.title, s.starts_at, s.ends_at, rm.name, coalesce(v.short_name, v.name), '/program/' || v.slug::text
    from public.sessions s join public.venues v on v.id = s.venue_id left join public.rooms rm on rm.id = s.room_id
    where private.program_published(v.id) and (coalesce(v_me = s.chair_id, false) or coalesce(v_me = s.cochair_id, false)
          or exists (select 1 from public.session_talks t where t.session_id = s.id and t.presenter_id = v_me)
          or exists (select 1 from public.schedule_items i where i.session_id = s.id and i.person_id = v_me));
  end if;
  if coalesce((v_flags ->> 'followed')::boolean, false) then
    return query select 'followed'::text, 'ven-' || d.id, coalesce(v.short_name, v.name) || ' · ' || d.label, d.starts_at, coalesce(d.ends_at, d.starts_at + interval '30 minutes'),
      v.location, v.name, '/venues/' || v.slug::text
    from public.venue_follows w join public.venues v on v.id = w.venue_id join public.venue_dates d on d.venue_id = v.id
    where w.person_id = v_me and d.kind <> 'internal' and d.starts_at > now() - interval '30 days';
  end if;
end $$;
revoke all on function public.my_calendar_items(jsonb) from public, anon;
grant execute on function public.my_calendar_items(jsonb) to authenticated;
