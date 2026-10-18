-- Organizer operations part 1 (canvas EM20–EM27): read models for papers/authors/invitations/conflicts,
-- reviewer suggestions, conflict overrides (B5), reminders log, extension requests, letter delivery stats.
-- Additive only. Chair checks reuse private.is_venue_chair / manages_paper (B1: never your own paper).

-- ---------------------------------------------------------------- authors of every paper (EM21 meta, EM27 letters, desk reject)
create or replace function public.venue_paper_authors(p_venue uuid)
returns table (submission_id uuid, person_id uuid, display_name text, given_name text, email text, author_position smallint,
               is_corresponding boolean, confirmation text, country text, institution text)
language sql stable security definer set search_path = '' as $$
  select a.submission_id, p.id, p.display_name, p.given_name,
         (select e.email::text from public.person_emails e where e.person_id = p.id and e.is_primary limit 1),
         a.position, a.is_corresponding, a.confirmation, p.country,
         coalesce(a.affiliation, (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1))
  from public.submission_authors a
  join public.submissions s on s.id = a.submission_id
  join public.persons p on p.id = a.person_id
  where s.venue_id = p_venue and s.stage <> 'draft'
    and private.is_venue_chair(p_venue)
    and not private.is_submission_author(s.id)
  order by s.number, a.position
$$;

-- what an AE may know about the authors of a paper they handle (EM23 header): count + affiliations, no names
create or replace function public.paper_author_summary(p_submission uuid)
returns table (author_count integer, institutions text[], countries text[])
language sql stable security definer set search_path = '' as $$
  select count(*)::int,
         array_remove(array_agg(distinct coalesce(a.affiliation, (select f.institution from public.affiliations f where f.person_id = a.person_id and f.ends_on is null order by f.created_at desc limit 1))), null),
         array_remove(array_agg(distinct p.country), null)
  from public.submission_authors a join public.persons p on p.id = a.person_id
  where a.submission_id = p_submission and private.manages_paper(p_submission)
$$;

-- ---------------------------------------------------------------- conflicts of AE/reviewer candidates with papers (EM22, EM23)
-- author of the paper, conflict declared by the authors (SB06), conflict declared by the person (ST01) against an author,
-- or a "conflict" bid. Chairs and the paper's AE only.
create or replace function public.venue_conflict_pairs(p_venue uuid)
returns table (submission_id uuid, person_id uuid, reason text)
language sql stable security definer set search_path = '' as $$
  select a.submission_id, a.person_id, 'author'
  from public.submission_authors a join public.submissions s on s.id = a.submission_id
  where s.venue_id = p_venue and s.stage <> 'draft' and private.is_venue_chair(p_venue)
  union
  select c.submission_id, c.person_id, 'declared by the authors'
  from public.submission_conflicts c join public.submissions s on s.id = c.submission_id
  where s.venue_id = p_venue and c.person_id is not null and private.is_venue_chair(p_venue)
  union
  select a.submission_id, d.person_id, coalesce(d.reason, 'declared')
  from public.declared_conflicts d
  join public.submission_authors a on a.person_id = d.other_person
  join public.submissions s on s.id = a.submission_id
  where s.venue_id = p_venue and private.is_venue_chair(p_venue)
  union
  select b.submission_id, b.person_id, 'conflict bid'
  from public.bids b join public.submissions s on s.id = b.submission_id
  where s.venue_id = p_venue and b.level = 'conflict' and private.is_venue_chair(p_venue)
$$;

-- ---------------------------------------------------------------- invitations of one paper, for its managers (EM23)
create or replace function public.paper_invitations(p_submission uuid)
returns table (assignment_id uuid, reviewer_id uuid, name text, email text, status text, round smallint, reply_by timestamptz,
               due_at timestamptz, responded_at timestamptz, decline_reason text, decline_suggestion text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.reviewer_id, coalesce(p.display_name, r.invited_email::text),
         coalesce(r.invited_email::text, (select e.email::text from public.person_emails e where e.person_id = r.reviewer_id and e.is_primary limit 1)),
         case when r.status = 'invited' and r.reply_by < now() then 'expired' else r.status end,
         r.round, r.reply_by, r.due_at, r.responded_at, r.decline_reason, r.decline_suggestion, r.created_at
  from public.review_assignments r left join public.persons p on p.id = r.reviewer_id
  where r.submission_id = p_submission and private.manages_paper(p_submission)
  order by r.created_at
$$;

-- ---------------------------------------------------------------- reviewer suggestions (EM23, E4, B6)
-- members of the venue who review (reviewer / AE / committee), with topic match against the paper's keywords,
-- load in the last 30 days against the lower of their own and the venue limit, on-time rate, conflict flag.
create or replace function public.suggest_reviewers(p_submission uuid)
returns table (person_id uuid, display_name text, institution text, topics text[], match integer, load integer, cap integer,
               on_time integer, conflict text, override_status text, already boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.submissions;
  v_words text[];
begin
  select * into s from public.submissions where id = p_submission;
  if s.id is null or not private.manages_paper(p_submission) then return; end if;
  v_words := array(select lower(x) from unnest(coalesce(s.keywords, '{}') || coalesce(s.own_keywords, '{}') || array[coalesce(s.topic, s.track, '')]) x where btrim(x) <> '');
  return query
  with cand as (
    select distinct m.person_id from public.venue_members m
    where m.venue_id = s.venue_id and m.role in ('reviewer', 'associate_editor', 'program_chair', 'chair', 'deputy_chair')
      and m.person_id is distinct from s.handling_ae
  )
  select p.id, p.display_name,
         (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1),
         array(select t.topic from public.person_topics t where t.person_id = p.id order by t.topic),
         coalesce((select (100 * count(*) / greatest(cardinality(v_words), 1))::int from public.person_topics t
                   where t.person_id = p.id and exists (select 1 from unnest(v_words) w where w <> '' and (position(lower(t.topic) in w) > 0 or position(w in lower(t.topic)) > 0))), 0),
         (select count(*)::int from public.review_assignments r where r.reviewer_id = p.id and r.status in ('accepted', 'submitted') and r.created_at > now() - interval '30 days'),
         least(case when p.availability = 'off' and (p.available_from is null or p.available_from > current_date) then 0
                    when p.availability = 'low' then 1 else p.monthly_limit end, 8)::int,
         coalesce((select (100 * count(*) filter (where r.submitted_at <= r.due_at) / nullif(count(*) filter (where r.submitted_at is not null), 0))::int
                   from public.review_assignments r where r.reviewer_id = p.id), 100),
         (select string_agg(distinct x.reason, ', ') from (
            select 'author' reason from public.submission_authors a where a.submission_id = p_submission and a.person_id = p.id
            union all select 'declared by the authors' from public.submission_conflicts c where c.submission_id = p_submission and c.person_id = p.id
            union all select coalesce(d.reason, 'declared') from public.declared_conflicts d join public.submission_authors a on a.person_id = d.other_person
                      where a.submission_id = p_submission and d.person_id = p.id
            union all select 'conflict bid' from public.bids b where b.submission_id = p_submission and b.person_id = p.id and b.level = 'conflict'
          ) x),
         (select o.status from public.conflict_overrides o where o.submission_id = p_submission and o.person_id = p.id order by o.created_at desc limit 1),
         exists (select 1 from public.review_assignments r where r.submission_id = p_submission and r.reviewer_id = p.id and r.status in ('invited', 'accepted', 'submitted'))
  from cand join public.persons p on p.id = cand.person_id;
end $$;

-- ---------------------------------------------------------------- conflict override (B5)
create or replace function public.request_conflict_override(p_submission uuid, p_person uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_venue uuid;
  v_id uuid;
begin
  select venue_id into v_venue from public.submissions where id = p_submission;
  if v_venue is null or not private.manages_paper(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'explain why this is not a real conflict (10 characters or more)' using errcode = '22023'; end if;
  if exists (select 1 from public.submission_authors a where a.submission_id = p_submission and a.person_id = p_person) then
    raise exception 'authors can never review their own paper' using errcode = '22023';
  end if;
  update public.conflict_overrides set status = 'refused', decided_at = now()
   where submission_id = p_submission and person_id = p_person and status = 'pending';
  insert into public.conflict_overrides (venue_id, submission_id, person_id, reason, requested_by)
  values (v_venue, p_submission, p_person, btrim(p_reason), private.current_person_id()) returning id into v_id;
  perform private.log(v_venue, 'conflict.override_requested', 'submission', p_submission, jsonb_build_object('person', p_person, 'override', v_id));
  return v_id;
end $$;

create or replace function public.decide_conflict_override(p_override uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  o public.conflict_overrides;
  st public.venue_settings;
begin
  select * into o from public.conflict_overrides where id = p_override for update;
  if o.id is null or not private.has_venue_role(o.venue_id, array['owner', 'program_chair', 'ceb_chair', 'chair']::public.venue_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into st from public.venue_settings where venue_id = o.venue_id;
  if coalesce(st.override_second, true) and o.requested_by = private.current_person_id() then
    raise exception 'a second person must approve (B5)' using errcode = '42501';
  end if;
  if o.status <> 'pending' then return o.status; end if;
  update public.conflict_overrides set status = case when p_approve then 'approved' else 'refused' end,
    approved_by = private.current_person_id(), decided_at = now() where id = o.id;
  perform private.log(o.venue_id, case when p_approve then 'conflict.override_approved' else 'conflict.override_refused' end, 'submission', o.submission_id,
    jsonb_build_object('person', o.person_id, 'override', o.id));
  return case when p_approve then 'approved' else 'refused' end;
end $$;

-- ---------------------------------------------------------------- extension requests of an event (EM25)
create or replace function public.venue_extension_requests(p_venue uuid)
returns table (request_id uuid, assignment_id uuid, submission_id uuid, paper_number integer, reviewer text, option text,
               requested_until timestamptz, due_at timestamptz, message text, status text, offered_until timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.id, r.id, s.id, s.number, p.display_name, e.option, e.requested_until, r.due_at, e.message, e.status, e.offered_until, e.created_at
  from public.extension_requests e
  join public.review_assignments r on r.id = e.assignment_id
  join public.submissions s on s.id = r.submission_id
  left join public.persons p on p.id = r.reviewer_id
  where s.venue_id = p_venue and private.manages_paper(s.id) and e.option <> 'hand_back'
  order by (e.status = 'pending') desc, e.created_at desc
  limit 200
$$;

-- every review slot of the event's papers (EM25 slots + overdue list); managers only
create or replace function public.venue_review_slots(p_venue uuid)
returns table (assignment_id uuid, submission_id uuid, reviewer_id uuid, reviewer text, email text, status text, round smallint,
               due_at timestamptz, submitted_at timestamptz, ordinal smallint, reminders bigint, last_reminder timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.submission_id, r.reviewer_id, coalesce(p.display_name, r.invited_email::text),
         coalesce(r.invited_email::text, (select e.email::text from public.person_emails e where e.person_id = r.reviewer_id and e.is_primary limit 1)),
         case when r.status = 'invited' and r.reply_by < now() then 'expired' else r.status end,
         r.round, r.due_at, r.submitted_at, r.ordinal,
         (select count(*) from public.review_reminders m where m.assignment_id = r.id),
         (select max(m.sent_at) from public.review_reminders m where m.assignment_id = r.id)
  from public.review_assignments r
  join public.submissions s on s.id = r.submission_id
  left join public.persons p on p.id = r.reviewer_id
  where s.venue_id = p_venue and private.manages_paper(s.id)
  order by s.number, r.ordinal nulls last
$$;

-- reminders sent from EM25 are logged (E10 automatic ones use the same table)
create or replace function public.log_reminders(p_assignments uuid[], p_kind text default 'manual')
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.review_reminders (assignment_id, kind)
  select r.id, coalesce(p_kind, 'manual') from public.review_assignments r
  where r.id = any (p_assignments) and private.manages_paper(r.submission_id);
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------- letters (EM27): released batch content + delivery stats
create or replace function public.batch_letters(p_batch uuid)
returns table (submission_id uuid, number integer, title text, decision text, letter text, editor_summary text, revision_due_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.number, s.title, d.decision, d.letter, coalesce(d.editor_summary, rec.summary), d.revision_due_at
  from public.decisions d join public.submissions s on s.id = d.submission_id
  left join public.ae_recommendations rec on rec.submission_id = s.id and rec.sent_at is not null
  join public.decision_batches b on b.id = d.batch_id
  where d.batch_id = p_batch and private.is_venue_chair(b.venue_id) and not private.is_submission_author(s.id)
  order by s.number
$$;

create or replace function public.record_batch_stats(p_batch uuid, p_delivered integer, p_bounced integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_venue uuid;
begin
  select venue_id into v_venue from public.decision_batches where id = p_batch;
  if v_venue is null or not private.is_venue_chair(v_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.decision_batches set delivered = greatest(coalesce(p_delivered, 0), 0), bounced = greatest(coalesce(p_bounced, 0), 0) where id = p_batch;
end $$;

-- the conference's reviews for letters: comments to authors only (F6), managers only
create or replace function public.venue_letter_reviews(p_venue uuid)
returns table (submission_id uuid, ordinal smallint, scores jsonb, recommendation text, to_authors text)
language sql stable security definer set search_path = '' as $$
  select r.submission_id, r.ordinal, w.scores, w.recommendation, w.to_authors
  from public.review_assignments r join public.reviews w on w.assignment_id = r.id
  join public.submissions s on s.id = r.submission_id
  where s.venue_id = p_venue and r.status = 'submitted' and private.is_venue_chair(p_venue) and not private.is_submission_author(s.id)
  order by r.submission_id, r.round, r.ordinal
$$;

-- ---------------------------------------------------------------- dashboard helpers (EM20)
create or replace function public.venue_dashboard_counts(p_venue uuid)
returns table (drafts bigint, submitted bigint, pdf_failed bigint, similarity_flags bigint, unconfirmed_coauthor_papers bigint,
               pending_invitations bigint, committee_accepted bigint, committee_total bigint, pending_extensions bigint,
               aes_over_load bigint, my_papers bigint, deputy_name text)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.submissions s where s.venue_id = p_venue and s.stage = 'draft'),
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

-- ---------------------------------------------------------------- grants
revoke all on function public.venue_paper_authors(uuid), public.paper_author_summary(uuid), public.venue_conflict_pairs(uuid),
  public.paper_invitations(uuid), public.suggest_reviewers(uuid), public.request_conflict_override(uuid, uuid, text),
  public.decide_conflict_override(uuid, boolean), public.venue_extension_requests(uuid), public.venue_review_slots(uuid),
  public.log_reminders(uuid[], text), public.batch_letters(uuid), public.record_batch_stats(uuid, integer, integer),
  public.venue_letter_reviews(uuid), public.venue_dashboard_counts(uuid) from public, anon;
grant execute on function public.venue_paper_authors(uuid), public.paper_author_summary(uuid), public.venue_conflict_pairs(uuid),
  public.paper_invitations(uuid), public.suggest_reviewers(uuid), public.request_conflict_override(uuid, uuid, text),
  public.decide_conflict_override(uuid, boolean), public.venue_extension_requests(uuid), public.venue_review_slots(uuid),
  public.log_reminders(uuid[], text), public.batch_letters(uuid), public.record_batch_stats(uuid, integer, integer),
  public.venue_letter_reviews(uuid), public.venue_dashboard_counts(uuid) to authenticated;
