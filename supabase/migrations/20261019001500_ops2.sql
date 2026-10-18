-- Organizer operations, part 2 (canvas EM28 finals, EM29 program, EM31 event day, EM32 proceedings, EM41 email centre).
-- Read models only: writes go through the existing tables' RLS (registrations, sessions, session_talks, announcements,
-- proceedings_exports, email_campaigns) and RPCs (final_admin, publish_program, check_in, notify_people).

-- ---------------------------------------------------------------- EM28: accepted papers with their final-version ticks
create or replace function public.finals_overview(p_venue uuid)
returns table (submission_id uuid, number integer, title text, decision text, stage text, presenter text, pdf boolean, copyright text,
               registered boolean, extra_pages smallint, extra_paid boolean, locked boolean, status text, missing text[],
               corresponding uuid[])
language sql stable security definer set search_path = '' as $$
  with base as (
    select s.id, s.number, coalesce(f.final_title, s.title) title, d.decision, s.stage::text stage,
           pp.display_name presenter,
           exists (select 1 from public.submission_files x where x.submission_id = s.id and x.role = 'final' and x.is_current) pdf,
           coalesce(f.copyright_status, 'not_started') copyright,
           exists (select 1 from public.registration_papers rp where rp.submission_id = s.id) registered,
           coalesce(f.extra_pages, 0)::smallint extra_pages, coalesce(f.extra_paid, false) extra_paid,
           f.title_locked_at is not null locked, f.status fstatus,
           array(select a.person_id from public.submission_authors a where a.submission_id = s.id and a.is_corresponding) corresponding
    from public.submissions s
    left join public.decisions d on d.submission_id = s.id
    left join public.final_versions f on f.submission_id = s.id
    left join public.persons pp on pp.id = f.presenter_id
    where s.venue_id = p_venue and s.stage in ('final', 'done')
      and private.has_venue_role(p_venue, array['owner', 'chair', 'program_chair', 'deputy_chair', 'publication_chair', 'registration_chair']::public.venue_role[])
  )
  select b.id, b.number, b.title, b.decision, b.stage, b.presenter, b.pdf, b.copyright, b.registered, b.extra_pages, b.extra_paid, b.locked,
         case when b.fstatus = 'dropped' then 'dropped'
              when b.pdf and b.copyright = 'signed' and b.registered and b.locked and (b.extra_pages = 0 or b.extra_paid) then 'complete'
              when exists (select 1 from public.venue_dates vd where vd.venue_id = p_venue and vd.key = 'finals' and vd.starts_at < now()) then 'incomplete'
              else 'in_progress' end,
         array_remove(array[
           case when not b.pdf then 'final PDF' end,
           case when b.copyright <> 'signed' then 'copyright form' end,
           case when not b.registered then 'registration' end,
           case when b.extra_pages > 0 and not b.extra_paid then 'extra-page payment' end,
           case when not b.locked then 'title and authors lock' end], null),
         b.corresponding
  from base b order by b.number
$$;

-- ---------------------------------------------------------------- EM29: accepted papers not yet placed in a session
create or replace function public.program_pool(p_venue uuid)
returns table (submission_id uuid, number integer, title text, topic text, decision text, presenter_id uuid, presenter text, complete boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.number, coalesce(f.final_title, s.title), coalesce(s.topic, s.track), d.decision,
         coalesce(f.presenter_id, (select a.person_id from public.submission_authors a where a.submission_id = s.id order by a.is_corresponding desc, a.position limit 1)),
         coalesce(pp.display_name, (select p2.display_name from public.submission_authors a join public.persons p2 on p2.id = a.person_id
                                     where a.submission_id = s.id order by a.is_corresponding desc, a.position limit 1)),
         coalesce(f.status = 'complete', false)
  from public.submissions s
  left join public.decisions d on d.submission_id = s.id
  left join public.final_versions f on f.submission_id = s.id
  left join public.persons pp on pp.id = f.presenter_id
  where s.venue_id = p_venue and s.stage in ('final', 'done') and coalesce(f.status, '') <> 'dropped'
    and not exists (select 1 from public.session_talks t where t.submission_id = s.id)
    and private.is_organizer(p_venue)
  order by s.number
$$;

-- ---------------------------------------------------------------- EM32: papers going into the proceedings + statistics
create or replace function public.proceedings_papers(p_venue uuid)
returns table (submission_id uuid, number integer, title text, locked_title text, abstract text, pages integer, file_path text,
               authors jsonb, attendance text, noshow_decision text, noshow_note text, session_code text, title_matches boolean, locked boolean,
               final_status text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.number, s.title, f.final_title, s.abstract,
         (select x.pages from public.submission_files x where x.submission_id = s.id and x.role = 'final' and x.is_current limit 1),
         (select x.storage_path from public.submission_files x where x.submission_id = s.id and x.role = 'final' and x.is_current limit 1),
         coalesce((select jsonb_agg(jsonb_build_object('name', p.display_name, 'given', p.given_name, 'family', p.family_name,
                     'affiliation', coalesce(a.affiliation, (select af.institution from public.affiliations af where af.person_id = p.id and af.ends_on is null order by af.created_at desc limit 1)),
                     'orcid', p.orcid) order by a.position)
                   from public.submission_authors a join public.persons p on p.id = a.person_id where a.submission_id = s.id), '[]'::jsonb),
         t.attendance, t.noshow_decision, t.noshow_note, se.code,
         f.final_title is null or btrim(lower(f.final_title)) = btrim(lower(s.title)),
         f.title_locked_at is not null, f.status
  from public.submissions s
  left join public.final_versions f on f.submission_id = s.id
  left join public.session_talks t on t.submission_id = s.id
  left join public.sessions se on se.id = t.session_id
  where s.venue_id = p_venue and s.stage in ('final', 'done')
    and private.has_venue_role(p_venue, array['owner', 'chair', 'program_chair', 'deputy_chair', 'publication_chair']::public.venue_role[])
  order by s.number
$$;

create or replace function public.proceedings_stats(p_venue uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when not private.is_organizer(p_venue) then null else jsonb_build_object(
    'submissions', (select count(*) from public.submissions s where s.venue_id = p_venue and s.stage not in ('draft')),
    'accepted', (select count(*) from public.submissions s where s.venue_id = p_venue and s.stage in ('final', 'done')),
    'withdrawn_after', (select count(*) from public.submissions s join public.decisions d on d.submission_id = s.id
                        where s.venue_id = p_venue and s.stage = 'withdrawn' and d.decision in ('accept_oral', 'accept_poster', 'conditional')),
    'reviews', (select count(*) from public.review_assignments r join public.submissions s on s.id = r.submission_id where s.venue_id = p_venue and r.status = 'submitted'),
    'on_time', (select round(100.0 * count(*) filter (where r.submitted_at <= r.due_at) / nullif(count(*), 0))
                from public.review_assignments r join public.submissions s on s.id = r.submission_id where s.venue_id = p_venue and r.status = 'submitted'),
    'countries', (select count(distinct p.country) from public.submission_authors a join public.submissions s on s.id = a.submission_id
                  join public.persons p on p.id = a.person_id where s.venue_id = p_venue and s.stage <> 'draft' and p.country is not null),
    'registered', (select count(*) from public.registrations g where g.venue_id = p_venue),
    'attendees', (select count(*) from public.registrations g where g.venue_id = p_venue and g.checked_in_at is not null),
    'presented', (select count(*) from public.session_talks t join public.sessions se on se.id = t.session_id where se.venue_id = p_venue and t.attendance = 'presented'),
    'no_shows', (select count(*) from public.session_talks t join public.sessions se on se.id = t.session_id where se.venue_id = p_venue and t.attendance = 'no_show'),
    'topics', coalesce((select jsonb_agg(x order by x.submitted desc) from (
        select coalesce(s.topic, s.track, 'Other') topic, count(*) submitted, count(*) filter (where s.stage in ('final', 'done')) accepted
        from public.submissions s where s.venue_id = p_venue and s.stage <> 'draft' group by 1) x), '[]'::jsonb),
    'by_country', coalesce((select jsonb_agg(x order by x.n desc) from (
        select p.country, count(distinct s.id) n from public.submission_authors a join public.submissions s on s.id = a.submission_id
        join public.persons p on p.id = a.person_id where s.venue_id = p_venue and s.stage <> 'draft' and p.country is not null group by 1) x), '[]'::jsonb),
    'by_ae', coalesce((select jsonb_agg(x order by x.ae) from (
        select ae.display_name ae, count(r.*) filter (where r.status = 'submitted') done,
               count(r.*) filter (where r.status = 'submitted' and r.submitted_at <= r.due_at) on_time,
               count(r.*) filter (where r.status = 'accepted' and r.due_at < now()) overdue
        from public.submissions s join public.persons ae on ae.id = s.handling_ae
        left join public.review_assignments r on r.submission_id = s.id
        where s.venue_id = p_venue group by ae.display_name) x), '[]'::jsonb)
  ) end
$$;

-- ---------------------------------------------------------------- EM41: deduplicated audience for a bulk email
-- roles: authors, reviewers, aes, session_chairs, committee
-- conditions: acc (paper accepted), inc (final version incomplete), late (review overdue), unsub (exclude unsubscribed)
create or replace function public.campaign_audience(p_venue uuid, p_roles text[], p_conditions text[])
returns table (person_id uuid, submission_id uuid, paper_number integer, paper_title text, missing text)
language plpgsql stable security definer set search_path = '' as $$
declare
  c_acc boolean := 'acc' = any (coalesce(p_conditions, '{}'));
  c_inc boolean := 'inc' = any (coalesce(p_conditions, '{}'));
  c_late boolean := 'late' = any (coalesce(p_conditions, '{}'));
  c_unsub boolean := 'unsub' = any (coalesce(p_conditions, '{}'));
begin
  if not private.is_venue_chair(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  with rows as (
    -- authors (one row per author × paper)
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

-- ---------------------------------------------------------------- EM31: who is affected by an announcement
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
$$;

revoke all on function public.finals_overview(uuid), public.program_pool(uuid), public.proceedings_papers(uuid), public.proceedings_stats(uuid),
  public.campaign_audience(uuid, text[], text[]), public.announcement_audience(uuid, uuid) from public, anon;
grant execute on function public.finals_overview(uuid), public.program_pool(uuid), public.proceedings_papers(uuid), public.proceedings_stats(uuid),
  public.campaign_audience(uuid, text[], text[]), public.announcement_audience(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- EM32 archive + EM41 audit entry (J1, J4)
create or replace function public.archive_event(p_venue uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_venue_role(p_venue, array['owner', 'chair']::public.venue_role[]) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.venues set status = 'archived' where id = p_venue;
  perform private.log(p_venue, 'event.archived', 'venue', p_venue);
end $$;

create or replace function public.log_campaign(p_campaign uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.email_campaigns;
begin
  select * into c from public.email_campaigns where id = p_campaign;
  if c.id is null or not private.is_venue_chair(c.venue_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  perform private.log(c.venue_id, 'email.campaign.' || c.status, 'email_campaign', c.id,
    jsonb_build_object('roles', c.roles, 'conditions', c.conditions, 'subject', c.subject, 'body', c.body, 'recipients', c.recipients, 'scheduled_at', c.scheduled_at));
end $$;

revoke all on function public.archive_event(uuid), public.log_campaign(uuid) from public, anon;
grant execute on function public.archive_event(uuid), public.log_campaign(uuid) to authenticated;
