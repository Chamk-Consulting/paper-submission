-- Program screens (PG01–PG03, CH01, M05, M07): what the session-chair pages need beyond the program RPCs.

-- is the signed-in person the chair or co-chair of this session (or an organizer of its event)?
create or replace function private.chairs_session(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session
      and (coalesce(s.chair_id = private.current_person_id(), false)
           or coalesce(s.cochair_id = private.current_person_id(), false)
           or private.is_organizer(s.venue_id))
  )
$$;
grant execute on function private.chairs_session(uuid) to authenticated;

-- One session as its chair sees it (CH01, M05): room facts, co-chair, talks with readiness and attendance.
create or replace function public.chair_session(p_session uuid)
returns table (session_id uuid, venue_id uuid, venue_name text, venue_short text, venue_slug text, timezone text, code text, title text, kind text,
               starts_at timestamptz, ends_at timestamptz, live_status text, delay_min smallint, live_note text,
               room text, room_level text, room_seats integer, room_equipment text, room_technician text, room_step_free boolean,
               chair text, cochair text, i_chair boolean, talks jsonb)
language sql stable security definer set search_path = '' as $$
  select s.id, v.id, v.name, coalesce(v.short_name, v.name), v.slug::text, v.timezone, s.code, s.title, s.kind,
         s.starts_at, s.ends_at, s.live_status, s.delay_min, s.live_note,
         r.name, r.level, r.seats, r.equipment, r.technician, coalesce(r.step_free, true),
         c.display_name, cc.display_name,
         coalesce(s.chair_id = private.current_person_id(), false) or coalesce(s.cochair_id = private.current_person_id(), false),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'id', t.id, 'position', t.position, 'starts_at', t.starts_at, 'talk_min', t.talk_min, 'qa_min', t.qa_min,
                     'number', x.number, 'title', coalesce(t.title, x.title), 'presenter', pp.display_name, 'presenter_id', t.presenter_id,
                     'remote', t.is_remote, 'attendance', t.attendance, 'noshow_note', t.noshow_note,
                     'slides', t.slides_path is not null, 'slides_path', t.slides_path, 'bio', t.presenter_bio,
                     'registered', exists (select 1 from public.registrations g where g.venue_id = v.id and g.person_id = t.presenter_id))
                   order by t.position)
                   from public.session_talks t
                   left join public.submissions x on x.id = t.submission_id
                   left join public.persons pp on pp.id = t.presenter_id
                   where t.session_id = s.id), '[]'::jsonb)
  from public.sessions s
  join public.venues v on v.id = s.venue_id
  left join public.rooms r on r.id = s.room_id
  left join public.persons c on c.id = s.chair_id
  left join public.persons cc on cc.id = s.cochair_id
  where s.id = p_session and private.chairs_session(p_session)
$$;

-- "Message all presenters" (CH01): a reply-able inbox thread with the chair and every presenter of the session.
create or replace function public.message_session_presenters(p_session uuid, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.sessions;
  v_me uuid := private.current_person_id();
  v_to uuid[];
  v_thread uuid;
begin
  select * into s from public.sessions where id = p_session;
  if s.id is null or v_me is null or not private.chairs_session(p_session) then raise exception 'not your session' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_subject, ''))) < 2 or char_length(btrim(coalesce(p_body, ''))) < 2 then
    raise exception 'write a subject and a message' using errcode = '22023';
  end if;
  v_to := array(select distinct t.presenter_id from public.session_talks t where t.session_id = p_session and t.presenter_id is not null and t.presenter_id <> v_me);
  if cardinality(v_to) = 0 then raise exception 'no presenters in this session yet' using errcode = '22023'; end if;
  insert into public.inbox_threads (venue_id, kind, subject, reply_allowed)
  values (s.venue_id, 'message', left(btrim(p_subject), 300), true) returning id into v_thread;
  insert into public.inbox_messages (thread_id, sender_id, sender_label, body, cta_label, cta_url)
  values (v_thread, v_me, 'Session chair · ' || s.code, btrim(p_body), 'Open program',
          '/program/' || (select slug::text from public.venues where id = s.venue_id) || '/sessions/' || s.code);
  insert into public.inbox_participants (thread_id, person_id, read_at) values (v_thread, v_me, now()) on conflict do nothing;
  insert into public.inbox_participants (thread_id, person_id) select v_thread, x from unnest(v_to) x on conflict do nothing;
  perform private.log(s.venue_id, 'session.message', 'session', s.id, jsonb_build_object('recipients', cardinality(v_to)));
  return v_thread;
end $$;

revoke all on function public.chair_session(uuid), public.message_session_presenters(uuid, text, text) from public, anon;
grant execute on function public.chair_session(uuid), public.message_session_presenters(uuid, text, text) to authenticated;

-- Session chairs may download the slides of the talks in their sessions ("Download all slides").
create policy papers_select_session_slides on storage.objects for select to authenticated
  using (bucket_id = 'papers' and exists (
    select 1 from public.session_talks t
    where t.slides_path = storage.objects.name and (select private.chairs_session(t.session_id))));
