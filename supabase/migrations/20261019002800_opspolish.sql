-- Ops polish: EM13 test submission, EM40 "view as" read-only view, EM41 scheduled sends (cron), helpers.
-- Additive: new columns/functions; existing functions are redefined with identical signatures.

-- ================================================================ EM13 — test submission
-- A test paper goes through the real author wizard as the organizer. It never leaves the 'draft' stage and never
-- gets a number, so every organizer list and count that skips drafts skips it automatically; the few that count
-- drafts are redefined below.
alter table public.submissions
  add column if not exists is_test           boolean not null default false,
  add column if not exists test_submitted_at timestamptz;
create index if not exists submissions_test_idx on public.submissions (venue_id) where is_test;

-- Authors edit while the venue is open; an organizer may also edit their own test paper before opening.
create or replace function private.can_edit_submission(p_submission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.submissions s
    where s.id = p_submission
      and s.stage in ('draft', 'submitted')
      and private.is_submission_author(s.id)
      and (private.venue_open(s.venue_id) or (s.is_test and private.is_organizer(s.venue_id)))
  )
$$;

create or replace function public.create_test_submission(p_venue uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  v_type text;
  v_track text;
  v_id uuid;
begin
  if v_me is null or not private.is_organizer(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  if (select count(*) from public.submissions s where s.venue_id = p_venue and s.is_test) >= 3 then
    raise exception 'delete an old test paper first (3 at most)' using errcode = '22023';
  end if;
  select t.name into v_type from public.submission_types t where t.venue_id = p_venue and t.enabled order by t.sort, t.name limit 1;
  select coalesce(v.details -> 'tracks' ->> 0, 'General') into v_track from public.venues v where v.id = p_venue;
  insert into public.submissions (venue_id, title, paper_type, track, stage, draft_step, created_by, is_test)
  values (p_venue, 'Untitled paper', coalesce(v_type, 'Regular paper'), v_track, 'draft', 2, v_me, true)
  returning id into v_id;
  insert into public.submission_authors (submission_id, person_id, position, is_corresponding) values (v_id, v_me, 1, true);
  perform private.log(p_venue, 'submission.test_created', 'submission', v_id);
  return v_id;
end $$;

-- Same checks as a real submission. A test paper gets no number and stays a draft; it only records that it passed.
create or replace function public.submit_paper(p_submission uuid, p_agree boolean, p_present boolean)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  v_me uuid := private.current_person_id();
  v_words int;
  v_number int;
begin
  select * into s from public.submissions where id = p_submission for update;
  if s.id is null or not private.can_edit_submission(p_submission) then raise exception 'cannot submit this paper' using errcode = '42501'; end if;
  if not coalesce(p_agree, false) or not coalesce(p_present, false) then raise exception 'confirm both statements' using errcode = '22023'; end if;
  if coalesce(btrim(s.title), '') in ('', 'Untitled paper') then raise exception 'title missing' using errcode = '22023'; end if;
  v_words := coalesce(array_length(regexp_split_to_array(btrim(coalesce(s.abstract, '')), '\s+'), 1), 0);
  if coalesce(btrim(s.abstract), '') = '' or v_words > 250 then raise exception 'abstract missing or over 250 words' using errcode = '22023'; end if;
  if s.track is null then raise exception 'track missing' using errcode = '22023'; end if;
  if not coalesce((s.declarations ->> 'original')::boolean, false) then raise exception 'originality declaration missing' using errcode = '22023'; end if;
  if cardinality(s.keywords) < 3 then raise exception 'pick at least 3 keywords' using errcode = '22023'; end if;
  if (select count(*) from public.submission_authors where submission_id = p_submission and is_corresponding) <> 1 then
    raise exception 'one corresponding author needed' using errcode = '22023';
  end if;
  if not exists (select 1 from public.submission_files f where f.submission_id = p_submission and f.role = 'paper' and f.is_current
                 and coalesce(f.check_result ->> 'status', '') <> 'failed') then
    raise exception 'upload a PDF that passes the checks' using errcode = '22023';
  end if;
  if exists (select 1 from public.submission_conflicts c where c.submission_id = p_submission and coalesce(btrim(c.reason), '') = '') then
    raise exception 'give a reason for each conflict' using errcode = '22023';
  end if;

  if s.is_test then
    update public.submissions set test_submitted_at = now(), draft_step = 7, updated_at = now(),
           confirmations = jsonb_build_object('agree', true, 'present', true, 'at', now())
     where id = p_submission;
    insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id)
    values (v_me, s.venue_id, 'submission.test_submitted', 'submission', p_submission);
    return 0;
  end if;

  if s.stage = 'draft' then
    perform 1 from public.venues where id = s.venue_id for update;   -- serialise numbering per venue
    select coalesce(max(number), 0) + 1 into v_number from public.submissions where venue_id = s.venue_id and not is_test;
    update public.submissions
       set stage = 'submitted', number = v_number, submitted_at = now(), draft_step = 7,
           stage_detail = 'Editable until the deadline', confirmations = jsonb_build_object('agree', true, 'present', true, 'at', now()),
           updated_at = now()
     where id = p_submission;
    insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id, details)
    values (v_me, s.venue_id, 'submission.submitted', 'submission', p_submission, jsonb_build_object('number', v_number));
  else
    v_number := s.number;
    update public.submissions set confirmations = jsonb_build_object('agree', true, 'present', true, 'at', now()), updated_at = now() where id = p_submission;
    insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id)
    values (v_me, s.venue_id, 'submission.updated', 'submission', p_submission);
  end if;
  return v_number;
end $$;

-- Storage objects are removed by the server action first (it lists them with the organizer's own session).
create or replace function public.delete_test_submission(p_submission uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.submissions;
begin
  select * into s from public.submissions where id = p_submission;
  if s.id is null or not s.is_test then raise exception 'not a test paper' using errcode = '22023'; end if;
  if not private.is_organizer(s.venue_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.submissions where id = p_submission;
  perform private.log(s.venue_id, 'submission.test_deleted', 'submission', p_submission,
    jsonb_build_object('passed', s.test_submitted_at is not null));
end $$;

create or replace function public.venue_test_submissions(p_venue uuid)
returns table (id uuid, title text, created_at timestamptz, test_submitted_at timestamptz, created_by_name text, files bigint)
language sql stable security definer set search_path = '' as $$
  select s.id, s.title, s.created_at, s.test_submitted_at, p.display_name,
         (select count(*) from public.submission_files f where f.submission_id = s.id)
  from public.submissions s left join public.persons p on p.id = s.created_by
  where s.venue_id = p_venue and s.is_test and private.is_organizer(p_venue)
  order by s.created_at desc
$$;

-- Go-live: test papers no longer count when deciding whether a chair has a paper here (B2). The test-submission
-- item is advisory, so it is a separate function (open_submissions blocks on every go_live_checks row).
create or replace function public.go_live_checks(p_venue uuid)
returns table (key text, ok boolean, note text)
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.venue_settings;
  v public.venues;
  v_chair_author boolean;
begin
  if not private.is_organizer(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v from public.venues where id = p_venue;
  select * into s from public.venue_settings where venue_id = p_venue;
  return query select 'basics'::text, (char_length(coalesce(v.name, '')) >= 3 and v.starts_on is not null),
    case when v.starts_on is null then 'Add the event dates' else 'Name and dates set' end;
  return query select 'dates'::text,
    (exists (select 1 from public.venue_dates d where d.venue_id = p_venue and d.key = 'paper_deadline')
     and not exists (
       select 1 from public.venue_dates a join public.venue_dates b on b.venue_id = a.venue_id
       where a.venue_id = p_venue and (a.key, b.key) in (('submissions_open','paper_deadline'), ('paper_deadline','reviews_due'),
             ('reviews_due','decisions'), ('decisions','finals'), ('finals','conference'), ('registration','conference'))
         and a.starts_at >= b.starts_at)),
    'Paper deadline set and every date in order';
  return query select 'submission_types'::text, exists (select 1 from public.submission_types t where t.venue_id = p_venue and t.enabled),
    'At least one submission type switched on';
  return query select 'review'::text, (s.min_reviews between 1 and 6 and jsonb_array_length(s.criteria) > 0), 'Review form and numbers';
  select exists (select 1 from public.venue_members m join public.submission_authors a on a.person_id = m.person_id
                 join public.submissions x on x.id = a.submission_id and x.venue_id = p_venue and not x.is_test
                 where m.venue_id = p_venue and m.role in ('owner', 'chair', 'program_chair')) into v_chair_author;
  return query select 'deputy'::text,
    (not coalesce(v_chair_author, false) or exists (select 1 from public.venue_members m where m.venue_id = p_venue and m.role = 'deputy_chair')),
    case when coalesce(v_chair_author, false) then 'A chair has a paper here: name a deputy chair' else 'No chair has a paper here' end;
  return query select 'committee'::text, exists (select 1 from public.venue_members m where m.venue_id = p_venue and m.role in ('associate_editor', 'program_chair', 'chair')),
    (select count(*) || ' committee members accepted' from public.venue_members m where m.venue_id = p_venue);
  return query select 'emails'::text, (v.contact_email is not null), case when v.contact_email is null then '[venue.contact] has no value yet' else 'Contact address set' end;
  return query select 'sections'::text,
    not exists (select 1 from public.venue_setup_sections x where x.venue_id = p_venue
                and x.key in ('basics','dates','submission_types','submission_form','pdf_rules','review','committee','conflicts','emails') and x.status <> 'ready'),
    (select count(*) filter (where x.status = 'ready') || ' of 9 required sections ready' from public.venue_setup_sections x
     where x.venue_id = p_venue and x.key in ('basics','dates','submission_types','submission_form','pdf_rules','review','committee','conflicts','emails'));
end $$;

-- Has a test paper gone through every step at this event? Stays true after the test paper is deleted.
create or replace function public.test_submission_done(p_venue uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_organizer(p_venue) and (
    exists (select 1 from public.submissions x where x.venue_id = p_venue and x.is_test and x.test_submitted_at is not null)
    or exists (select 1 from public.audit_log l where l.venue_id = p_venue and l.action = 'submission.test_submitted'))
$$;

-- EM20: drafts no longer count test papers.
create or replace function public.venue_dashboard_counts(p_venue uuid)
returns table (drafts bigint, submitted bigint, pdf_failed bigint, similarity_flags bigint, unconfirmed_coauthor_papers bigint,
               pending_invitations bigint, committee_accepted bigint, committee_total bigint, pending_extensions bigint,
               aes_over_load bigint, my_papers bigint, deputy_name text)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.submissions s where s.venue_id = p_venue and s.stage = 'draft' and not s.is_test),
    (select count(*) from public.submissions s where s.venue_id = p_venue and s.stage not in ('draft', 'withdrawn')),
    (select count(*) from public.submissions s where s.venue_id = p_venue and s.stage not in ('draft', 'withdrawn') and coalesce(s.pdf_check::text, '') = 'need'),
    (select count(*) from public.submissions s where s.venue_id = p_venue and s.stage not in ('draft', 'withdrawn') and s.similarity_pct >= 30),
    (select count(distinct a.submission_id) from public.submission_authors a join public.submissions s on s.id = a.submission_id
      where s.venue_id = p_venue and s.stage not in ('draft', 'withdrawn') and a.confirmation = 'pending'),
    (select count(*) from public.invitations i where i.venue_id = p_venue and i.status = 'pending' and i.expires_at > now()),
    (select count(distinct m.person_id) from public.venue_members m where m.venue_id = p_venue and m.role not in ('author', 'reviewer')),
    (select count(distinct m.person_id) from public.venue_members m where m.venue_id = p_venue and m.role not in ('author', 'reviewer'))
      + (select count(*) from public.invitations i where i.venue_id = p_venue and i.status = 'pending' and i.expires_at > now()),
    (select count(*) from public.extension_requests e join public.review_assignments r on r.id = e.assignment_id
      join public.submissions s on s.id = r.submission_id where s.venue_id = p_venue and e.status = 'pending'),
    (select count(*) from (select s.handling_ae, count(*) n from public.submissions s where s.venue_id = p_venue and s.handling_ae is not null
      and s.stage not in ('withdrawn', 'rejected') group by s.handling_ae) x
      where x.n > coalesce((select max(m.load_cap) from public.venue_members m where m.venue_id = p_venue and m.person_id = x.handling_ae),
                           (select st.ae_cap from public.venue_settings st where st.venue_id = p_venue))),
    (select count(*) from public.submission_authors a join public.submissions s on s.id = a.submission_id
      where s.venue_id = p_venue and s.stage <> 'draft' and a.person_id = private.current_person_id()),
    (select p.display_name from public.venue_members m join public.persons p on p.id = m.person_id
      where m.venue_id = p_venue and m.role = 'deputy_chair' limit 1)
  where private.is_organizer(p_venue)
$$;

-- ================================================================ EM40 — view as (read-only)
-- The People table sends {person}; earlier code read {target}. Accept both so view_as_sessions is filled.
create or replace function public.log_organizer_event(p_venue uuid, p_action text, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare v_target uuid;
begin
  if not private.is_organizer(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_action not in ('data.export', 'view_as.started', 'view_as.ended') then raise exception 'bad action' using errcode = '22023'; end if;
  perform private.log(p_venue, p_action, 'venue', p_venue, coalesce(p_details, '{}'));
  begin
    v_target := coalesce(nullif(p_details ->> 'target', ''), nullif(p_details ->> 'person', ''))::uuid;
  exception when invalid_text_representation then v_target := null;
  end;
  if p_action = 'view_as.started' and v_target is not null then
    update public.view_as_sessions set ended_at = now()
    where venue_id = p_venue and actor_id = private.current_person_id() and ended_at is null;
    insert into public.view_as_sessions (venue_id, actor_id, target_id) values (p_venue, private.current_person_id(), v_target);
  elsif p_action = 'view_as.ended' then
    update public.view_as_sessions set ended_at = now()
    where venue_id = p_venue and actor_id = private.current_person_id() and ended_at is null;
  end if;
end $$;

-- What one person sees at this event: their papers, reviews and sessions. Chairs only; the conflict firewall (B1)
-- still applies — papers the viewer may not manage (e.g. their own) are left out.
create or replace function public.view_as_snapshot(p_venue uuid, p_person uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_out jsonb;
begin
  if not private.is_venue_chair(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.venue_members m where m.venue_id = p_venue and m.person_id = p_person)
     and not exists (select 1 from public.submission_authors a join public.submissions s on s.id = a.submission_id
                     where a.person_id = p_person and s.venue_id = p_venue and not s.is_test)
     and not exists (select 1 from public.review_assignments r join public.submissions s on s.id = r.submission_id
                     where r.reviewer_id = p_person and s.venue_id = p_venue) then
    raise exception 'this person has no role at this event' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'person', (select jsonb_build_object('id', p.id, 'name', p.display_name, 'plenary_id', p.plenary_id,
                 'affiliation', (select f.institution from public.affiliations f where f.person_id = p.id order by f.ends_on nulls first, f.created_at desc limit 1))
               from public.persons p where p.id = p_person),
    'roles', coalesce((select jsonb_agg(distinct m.role::text) from public.venue_members m where m.venue_id = p_venue and m.person_id = p_person), '[]'::jsonb),
    'papers', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'number', s.number, 'title', s.title, 'stage', s.stage,
                 'stage_detail', s.stage_detail, 'pdf', s.pdf_check, 'copyright', s.copyright_check, 'registration', s.registration_check,
                 'corresponding', a.is_corresponding, 'updated_at', s.updated_at) order by s.number nulls last)
               from public.submission_authors a join public.submissions s on s.id = a.submission_id
               where a.person_id = p_person and s.venue_id = p_venue and not s.is_test and s.stage <> 'draft'
                 and private.manages_paper(s.id)), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'number', s.number, 'title', s.title, 'status', r.status,
                 'round', r.round, 'due_at', r.due_at, 'submitted_at', r.submitted_at) order by r.due_at nulls last)
               from public.review_assignments r join public.submissions s on s.id = r.submission_id
               where r.reviewer_id = p_person and s.venue_id = p_venue and private.manages_paper(s.id)), '[]'::jsonb),
    'handling', (select count(*) from public.submissions s where s.venue_id = p_venue and s.handling_ae = p_person and s.stage not in ('withdrawn', 'rejected')),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('code', se.code, 'title', se.title, 'starts_at', se.starts_at,
                 'role', case when se.chair_id = p_person then 'chair' else 'co-chair' end) order by se.starts_at)
               from public.sessions se where se.venue_id = p_venue and (se.chair_id = p_person or se.cochair_id = p_person)), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

-- ================================================================ EM41 — scheduled sends
alter table public.email_campaigns drop constraint if exists email_campaigns_status_check;
alter table public.email_campaigns add constraint email_campaigns_status_check check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed'));
alter table public.email_campaigns add column if not exists send_error text check (char_length(send_error) <= 500);

-- finals_overview without the caller check (the cron job has no person); the public RPC keeps its role check.
create or replace function private.finals_rows(p_venue uuid)
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
    where s.venue_id = p_venue and s.stage in ('final', 'done') and not s.is_test
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

create or replace function public.finals_overview(p_venue uuid)
returns table (submission_id uuid, number integer, title text, decision text, stage text, presenter text, pdf boolean, copyright text,
               registered boolean, extra_pages smallint, extra_paid boolean, locked boolean, status text, missing text[],
               corresponding uuid[])
language sql stable security definer set search_path = '' as $$
  select * from private.finals_rows(p_venue)
  where private.has_venue_role(p_venue, array['owner', 'chair', 'program_chair', 'deputy_chair', 'publication_chair', 'registration_chair']::public.venue_role[])
$$;

-- Audience rows without the caller check, shared by the organizer RPC and the cron job. Same rules as the data
-- slice's campaign_audience (20261019002400), plus test papers left out.
create or replace function private.campaign_audience_rows(p_venue uuid, p_roles text[], p_conditions text[])
returns table (person_id uuid, submission_id uuid, paper_number integer, paper_title text, missing text)
language plpgsql stable security definer set search_path = '' as $$
declare
  c_acc boolean := 'acc' = any (coalesce(p_conditions, '{}'));
  c_inc boolean := 'inc' = any (coalesce(p_conditions, '{}'));
  c_late boolean := 'late' = any (coalesce(p_conditions, '{}'));
  -- data slice (UN01): optional mail always skips unsubscribed people unless it is about their own paper/review
  c_unsub boolean := 'unsub' = any (coalesce(p_conditions, '{}')) or not (c_acc or c_inc or c_late);
begin
  return query
  with fin as (
    select f.submission_id fsid, f.status fstatus, array_to_string(f.missing, ', ') fmiss
    from private.finals_rows(p_venue) f
  ), rows as (
    select a.person_id pid, s.id sid, s.number num, s.title ttl, (select fin.fmiss from fin where fin.fsid = s.id) miss
    from public.submission_authors a join public.submissions s on s.id = a.submission_id
    where 'authors' = any (p_roles) and s.venue_id = p_venue and s.stage not in ('draft', 'withdrawn') and not s.is_test
      and (not c_acc or s.stage in ('final', 'done'))
      and (not c_inc or exists (select 1 from fin where fin.fsid = s.id and fin.fstatus in ('in_progress', 'incomplete')))
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

create or replace function public.campaign_audience(p_venue uuid, p_roles text[], p_conditions text[])
returns table (person_id uuid, submission_id uuid, paper_number integer, paper_title text, missing text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_venue_chair(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select * from private.campaign_audience_rows(p_venue, p_roles, p_conditions);
end $$;

-- Cron (service role only). Claims due campaigns so two overlapping runs never send the same one twice.
create or replace function public.cron_claim_campaigns(p_limit integer default 5)
returns setof public.email_campaigns language sql security definer set search_path = '' as $$
  update public.email_campaigns c set status = 'sending'
  where c.id in (select x.id from public.email_campaigns x where x.status = 'scheduled' and x.scheduled_at <= now()
                 order by x.scheduled_at limit greatest(1, least(coalesce(p_limit, 5), 20)) for update skip locked)
  returning c.*
$$;

-- Recipients of one campaign with their primary email and name; unsubscribe rules come from the audience (I4, UN01).
create or replace function public.cron_campaign_recipients(p_campaign uuid)
returns table (person_id uuid, email text, given_name text, display_name text, submission_id uuid, paper_number integer, paper_title text, missing text)
language plpgsql stable security definer set search_path = '' as $$
declare c public.email_campaigns;
begin
  select * into c from public.email_campaigns where id = p_campaign;
  if c.id is null then return; end if;
  return query
  select r.person_id, (select e.email::text from public.person_emails e where e.person_id = r.person_id and e.is_primary limit 1),
         p.given_name, p.display_name, r.submission_id, r.paper_number, r.paper_title, r.missing
  from private.campaign_audience_rows(c.venue_id, c.roles, c.conditions) r
  join public.persons p on p.id = r.person_id;
end $$;

-- Inbox copy for one recipient (I2) and the final counts + audit entry (J4).
create or replace function public.cron_campaign_inbox(p_campaign uuid, p_person uuid, p_subject text, p_body text, p_submission uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.email_campaigns;
begin
  select * into c from public.email_campaigns where id = p_campaign;
  if c.id is null then return; end if;
  perform private.notify(array[p_person], 'venue', p_subject, p_body, c.venue_id, p_submission, null, null,
    (select coalesce(v.short_name, v.name) from public.venues v where v.id = c.venue_id), false);
end $$;

create or replace function public.cron_finish_campaign(p_campaign uuid, p_recipients integer, p_delivered integer, p_bounced integer, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.email_campaigns;
begin
  update public.email_campaigns
     set status = case when p_error is null then 'sent' else 'failed' end, sent_at = now(),
         recipients = coalesce(p_recipients, recipients), delivered = coalesce(p_delivered, 0), bounced = coalesce(p_bounced, 0),
         send_error = left(p_error, 500)
   where id = p_campaign returning * into c;
  if c.id is null then return; end if;
  insert into public.audit_log (venue_id, action, entity, entity_id, details)
  values (c.venue_id, 'email.campaign.' || c.status, 'email_campaign', c.id,
          jsonb_build_object('scheduled_at', c.scheduled_at, 'recipients', c.recipients, 'delivered', c.delivered, 'bounced', c.bounced, 'by', 'schedule', 'error', c.send_error));
end $$;

-- ================================================================ grants
revoke all on function public.create_test_submission(uuid), public.delete_test_submission(uuid), public.venue_test_submissions(uuid),
  public.view_as_snapshot(uuid, uuid), public.test_submission_done(uuid) from public, anon;
grant execute on function public.create_test_submission(uuid), public.delete_test_submission(uuid), public.venue_test_submissions(uuid),
  public.view_as_snapshot(uuid, uuid), public.test_submission_done(uuid) to authenticated;
revoke all on function private.finals_rows(uuid), private.campaign_audience_rows(uuid, text[], text[]) from public, anon, authenticated;
revoke all on function public.cron_claim_campaigns(integer), public.cron_campaign_recipients(uuid),
  public.cron_campaign_inbox(uuid, uuid, text, text, uuid), public.cron_finish_campaign(uuid, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.cron_claim_campaigns(integer), public.cron_campaign_recipients(uuid),
  public.cron_campaign_inbox(uuid, uuid, text, text, uuid), public.cron_finish_campaign(uuid, integer, integer, integer, text) to service_role;
