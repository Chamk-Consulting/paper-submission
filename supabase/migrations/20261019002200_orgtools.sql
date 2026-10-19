-- Organizer tools (canvas EM33 similarity check, EM34 awards, BL01 billing). Additive only.
-- Reads and writes go through security-definer functions; tables are closed to direct access except owner/manager reads.

-- ================================================================ EM33 — similarity check
alter table public.venue_settings
  add column if not exists similarity_threshold smallint not null default 30 check (similarity_threshold between 1 and 100),
  add column if not exists similarity_ignore_refs boolean not null default true;

create table public.similarity_reports (
  submission_id  uuid primary key references public.submissions (id) on delete cascade,
  venue_id       uuid not null references public.venues (id) on delete cascade,
  score          numeric(5,1) check (score between 0 and 100),           -- whole text
  score_excl     numeric(5,1) check (score_excl between 0 and 100),      -- references and quotes ignored
  top_source     text check (char_length(top_source) <= 300),
  sources        jsonb not null default '[]',                             -- [{title, pct, url?, allowed?}]
  report_url     text check (report_url ~ '^https://' and char_length(report_url) <= 1000),
  provider       text not null default 'manual' check (provider in ('manual', 'csv', 'api')),
  status         text not null default 'ready' check (status in ('pending', 'ready')),
  checked_by     uuid references public.persons (id) on delete set null,
  checked_at     timestamptz,
  recorded_by    uuid references public.persons (id) on delete set null,
  updated_at     timestamptz not null default now()
);
create index similarity_reports_venue_idx on public.similarity_reports (venue_id);
alter table public.similarity_reports enable row level security;
revoke all on public.similarity_reports from anon, authenticated;
grant select on public.similarity_reports to authenticated;
-- chairs (not authors of the paper) and the paper's AE; reviewers and authors never see scores
create policy similarity_reports_select on public.similarity_reports for select to authenticated
  using (private.manages_paper(submission_id));

-- every non-draft paper the caller manages, with its report (status is computed by the screen against the threshold)
create or replace function public.similarity_overview(p_venue uuid)
returns table (submission_id uuid, number integer, title text, stage text, score numeric, score_excl numeric, top_source text,
               sources jsonb, report_url text, provider text, status text, checked_at timestamptz, checked_by text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.number, s.title, s.stage::text, r.score, r.score_excl, r.top_source, coalesce(r.sources, '[]'::jsonb), r.report_url,
         r.provider, coalesce(r.status, 'pending'), r.checked_at, cp.display_name, r.updated_at
  from public.submissions s
  left join public.similarity_reports r on r.submission_id = s.id
  left join public.persons cp on cp.id = r.checked_by
  where s.venue_id = p_venue and s.stage not in ('draft', 'withdrawn')
    and private.is_organizer(p_venue)
    and not private.is_submission_author(s.id)
    and (private.is_venue_chair(p_venue) or s.handling_ae = private.current_person_id())
  order by s.number
$$;

create or replace function public.save_similarity(p_submission uuid, p_score numeric, p_score_excl numeric, p_top_source text,
                                                  p_sources jsonb, p_report_url text, p_provider text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_venue uuid;
begin
  if not private.manages_paper(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_score is null and p_score_excl is null then raise exception 'enter a score' using errcode = '22023'; end if;
  if coalesce(p_provider, 'manual') not in ('manual', 'csv', 'api') then raise exception 'bad provider' using errcode = '22023'; end if;
  if p_sources is not null and jsonb_typeof(p_sources) <> 'array' then raise exception 'bad sources' using errcode = '22023'; end if;
  select venue_id into v_venue from public.submissions where id = p_submission;
  insert into public.similarity_reports (submission_id, venue_id, score, score_excl, top_source, sources, report_url, provider, status, recorded_by, updated_at,
                                         checked_by, checked_at)
  values (p_submission, v_venue, p_score, p_score_excl, nullif(btrim(coalesce(p_top_source, '')), ''), coalesce(p_sources, '[]'::jsonb),
          nullif(btrim(coalesce(p_report_url, '')), ''), coalesce(p_provider, 'manual'), 'ready', private.current_person_id(), now(), null, null)
  on conflict (submission_id) do update set score = excluded.score, score_excl = excluded.score_excl, top_source = excluded.top_source,
    sources = excluded.sources, report_url = excluded.report_url, provider = excluded.provider, status = 'ready',
    recorded_by = excluded.recorded_by, updated_at = now(), checked_by = null, checked_at = null;
  update public.submissions set similarity_pct = coalesce(p_score, p_score_excl) where id = p_submission;
  perform private.log(v_venue, 'similarity.recorded', 'submission', p_submission,
                      jsonb_build_object('score', p_score, 'score_excl', p_score_excl, 'provider', coalesce(p_provider, 'manual')));
end $$;

-- CSV import: [{number, score, source}] — chairs only. Returns how many matched and which numbers did not.
create or replace function public.import_similarity(p_venue uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; v_sub uuid; n int := 0; v_missing int[] := '{}'; v_num int; v_score numeric;
begin
  if not private.is_venue_chair(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then raise exception 'bad rows' using errcode = '22023'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_num := nullif(r ->> 'number', '')::int;
    v_score := nullif(r ->> 'score', '')::numeric;
    if v_num is null or v_score is null or v_score < 0 or v_score > 100 then continue; end if;
    select s.id into v_sub from public.submissions s where s.venue_id = p_venue and s.number = v_num and s.stage <> 'draft';
    if v_sub is null or private.is_submission_author(v_sub) then v_missing := v_missing || v_num; continue; end if;
    insert into public.similarity_reports (submission_id, venue_id, score, top_source, provider, recorded_by)
    values (v_sub, p_venue, v_score, nullif(btrim(coalesce(r ->> 'source', '')), ''), 'csv', private.current_person_id())
    on conflict (submission_id) do update set score = excluded.score, top_source = coalesce(excluded.top_source, public.similarity_reports.top_source),
      provider = 'csv', status = 'ready', recorded_by = excluded.recorded_by, updated_at = now(), checked_by = null, checked_at = null;
    update public.submissions set similarity_pct = v_score where id = v_sub;
    n := n + 1;
  end loop;
  perform private.log(p_venue, 'similarity.imported', 'venue', p_venue, jsonb_build_object('rows', n, 'unmatched', to_jsonb(v_missing)));
  return jsonb_build_object('matched', n, 'unmatched', to_jsonb(v_missing));
end $$;

create or replace function public.mark_similarity_checked(p_submission uuid, p_checked boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_venue uuid;
begin
  if not private.manages_paper(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.similarity_reports set checked_by = case when p_checked then private.current_person_id() end,
         checked_at = case when p_checked then now() end
  where submission_id = p_submission returning venue_id into v_venue;
  if v_venue is null then raise exception 'no report for this paper yet' using errcode = '22023'; end if;
  perform private.log(v_venue, case when p_checked then 'similarity.checked' else 'similarity.unchecked' end, 'submission', p_submission, '{}');
end $$;

create or replace function public.set_similarity_settings(p_venue uuid, p_threshold integer, p_ignore_refs boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_venue_chair(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_threshold is null or p_threshold < 1 or p_threshold > 100 then raise exception 'threshold must be 1–100' using errcode = '22023'; end if;
  insert into public.venue_settings (venue_id) values (p_venue) on conflict (venue_id) do nothing;
  update public.venue_settings set similarity_threshold = p_threshold, similarity_ignore_refs = coalesce(p_ignore_refs, true) where venue_id = p_venue;
  perform private.log(p_venue, 'similarity.settings', 'venue', p_venue, jsonb_build_object('threshold', p_threshold, 'ignore_refs', p_ignore_refs));
end $$;

-- ================================================================ EM34 — awards
create table public.awards (
  id                 uuid primary key default gen_random_uuid(),
  venue_id           uuid not null references public.venues (id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 3 and 80),
  max_shortlist      smallint not null default 3 check (max_shortlist between 1 and 10),
  sort               smallint not null default 0,
  winner_submission  uuid references public.submissions (id) on delete set null,
  announced_at       timestamptz,
  created_by         uuid references public.persons (id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (venue_id, name)
);
create table public.award_committee (
  award_id   uuid not null references public.awards (id) on delete cascade,
  person_id  uuid not null references public.persons (id) on delete cascade,
  primary key (award_id, person_id)
);
create table public.award_nominations (
  id             uuid primary key default gen_random_uuid(),
  award_id       uuid not null references public.awards (id) on delete cascade,
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  nominated_by   uuid references public.persons (id) on delete set null,
  reason         text check (char_length(reason) <= 1000),
  shortlisted    boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (award_id, submission_id)
);
create table public.award_votes (
  award_id       uuid not null references public.awards (id) on delete cascade,
  voter_id       uuid not null references public.persons (id) on delete cascade,
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (award_id, voter_id)
);
alter table public.awards            enable row level security;
alter table public.award_committee   enable row level security;
alter table public.award_nominations enable row level security;
alter table public.award_votes       enable row level security;
revoke all on public.awards, public.award_committee, public.award_nominations, public.award_votes from anon, authenticated;

-- B1 for award votes: author, conflict declared by the authors, conflict the person declared against an author, conflict bid
create or replace function private.award_conflict(p_submission uuid, p_person uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.submission_authors a where a.submission_id = p_submission and a.person_id = p_person)
      or exists (select 1 from public.submission_conflicts c where c.submission_id = p_submission and c.person_id = p_person)
      or exists (select 1 from public.declared_conflicts d join public.submission_authors a on a.person_id = d.other_person
                 where a.submission_id = p_submission and d.person_id = p_person)
      or exists (select 1 from public.bids b where b.submission_id = p_submission and b.person_id = p_person and b.level = 'conflict')
$$;

create or replace function private.award_venue(p_award uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select venue_id from public.awards where id = p_award
$$;

create or replace function public.create_award(p_venue uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_venue_chair(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.awards (venue_id, name, sort, created_by)
  values (p_venue, btrim(p_name), coalesce((select max(sort) + 1 from public.awards where venue_id = p_venue), 0), private.current_person_id())
  returning id into v_id;
  perform private.log(p_venue, 'award.created', 'award', v_id, jsonb_build_object('name', btrim(p_name)));
  return v_id;
end $$;

create or replace function public.set_award_committee(p_award uuid, p_people uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare v_venue uuid := private.award_venue(p_award); n int;
begin
  if v_venue is null or not private.is_venue_chair(v_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  if exists (select 1 from unnest(coalesce(p_people, '{}')) x where not exists (select 1 from public.venue_members m where m.venue_id = v_venue and m.person_id = x)) then
    raise exception 'committee members must be members of the event' using errcode = '22023';
  end if;
  delete from public.award_committee where award_id = p_award and person_id <> all (coalesce(p_people, '{}'));
  insert into public.award_committee (award_id, person_id) select p_award, x from unnest(coalesce(p_people, '{}')) x on conflict do nothing;
  -- votes of people who left the committee are dropped
  delete from public.award_votes where award_id = p_award and voter_id <> all (coalesce(p_people, '{}'));
  select count(*) into n from public.award_committee where award_id = p_award;
  perform private.log(v_venue, 'award.committee', 'award', p_award, jsonb_build_object('members', n));
  return n;
end $$;

create or replace function public.nominate_paper(p_award uuid, p_submission uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_venue uuid := private.award_venue(p_award); v_id uuid;
begin
  if v_venue is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.submissions s where s.id = p_submission and s.venue_id = v_venue) then raise exception 'paper not in this event' using errcode = '22023'; end if;
  if not private.manages_paper(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.decisions d where d.submission_id = p_submission and d.decision in ('accept_oral', 'accept_poster', 'conditional')) then
    raise exception 'only accepted papers can be nominated' using errcode = '22023';
  end if;
  if (select announced_at from public.awards where id = p_award) is not null then raise exception 'this award is already announced' using errcode = '22023'; end if;
  insert into public.award_nominations (award_id, submission_id, nominated_by, reason)
  values (p_award, p_submission, private.current_person_id(), nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict (award_id, submission_id) do update set reason = coalesce(excluded.reason, public.award_nominations.reason)
  returning id into v_id;
  perform private.log(v_venue, 'award.nominated', 'submission', p_submission, jsonb_build_object('award', p_award));
  return v_id;
end $$;

create or replace function public.set_award_shortlist(p_nomination uuid, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_award uuid; v_sub uuid; v_venue uuid; v_max int;
begin
  select n.award_id, n.submission_id, a.venue_id, a.max_shortlist into v_award, v_sub, v_venue, v_max
  from public.award_nominations n join public.awards a on a.id = n.award_id where n.id = p_nomination;
  if v_venue is null or not private.is_venue_chair(v_venue) or private.is_submission_author(v_sub) then raise exception 'not allowed' using errcode = '42501'; end if;
  if (select announced_at from public.awards where id = v_award) is not null then raise exception 'this award is already announced' using errcode = '22023'; end if;
  if p_on and (select count(*) from public.award_nominations where award_id = v_award and shortlisted and id <> p_nomination) >= v_max then
    raise exception 'the shortlist is full (%)', v_max using errcode = '22023';
  end if;
  update public.award_nominations set shortlisted = p_on where id = p_nomination;
  if not p_on then
    delete from public.award_votes where award_id = v_award and submission_id = v_sub;
    update public.awards set winner_submission = null where id = v_award and winner_submission = v_sub;
  end if;
  perform private.log(v_venue, case when p_on then 'award.shortlisted' else 'award.unshortlisted' end, 'submission', v_sub, jsonb_build_object('award', v_award));
end $$;

create or replace function public.cast_award_vote(p_award uuid, p_submission uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id(); v_venue uuid := private.award_venue(p_award);
begin
  if v_me is null or v_venue is null or not exists (select 1 from public.award_committee c where c.award_id = p_award and c.person_id = v_me) then
    raise exception 'only the award committee can vote' using errcode = '42501';
  end if;
  if (select announced_at from public.awards where id = p_award) is not null then raise exception 'voting is closed' using errcode = '22023'; end if;
  if not exists (select 1 from public.award_nominations n where n.award_id = p_award and n.submission_id = p_submission and n.shortlisted) then
    raise exception 'vote for a shortlisted paper' using errcode = '22023';
  end if;
  if private.award_conflict(p_submission, v_me) then raise exception 'conflict of interest — you cannot vote for this paper' using errcode = '42501'; end if;
  insert into public.award_votes (award_id, voter_id, submission_id) values (p_award, v_me, p_submission)
  on conflict (award_id, voter_id) do update set submission_id = excluded.submission_id, created_at = now();
  perform private.log(v_venue, 'award.voted', 'award', p_award, '{}');   -- the choice itself stays private
end $$;

create or replace function public.pick_award_winner(p_award uuid, p_submission uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_venue uuid := private.award_venue(p_award);
begin
  if v_venue is null or not private.is_venue_chair(v_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  if (select announced_at from public.awards where id = p_award) is not null then raise exception 'this award is already announced' using errcode = '22023'; end if;
  if p_submission is not null then
    if private.is_submission_author(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
    if not exists (select 1 from public.award_nominations n where n.award_id = p_award and n.submission_id = p_submission and n.shortlisted) then
      raise exception 'pick a shortlisted paper' using errcode = '22023';
    end if;
  end if;
  update public.awards set winner_submission = p_submission where id = p_award;
  perform private.log(v_venue, 'award.winner', 'award', p_award, jsonb_build_object('submission', p_submission));
end $$;

create or replace function public.announce_award(p_award uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_a public.awards; v_authors uuid[]; v_title text; v_num int;
begin
  select * into v_a from public.awards where id = p_award;
  if v_a.id is null or not private.is_venue_chair(v_a.venue_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_a.announced_at is not null then raise exception 'already announced' using errcode = '22023'; end if;
  if v_a.winner_submission is null then raise exception 'pick a winner first' using errcode = '22023'; end if;
  update public.awards set announced_at = now() where id = p_award;
  select s.title, s.number into v_title, v_num from public.submissions s where s.id = v_a.winner_submission;
  v_authors := array(select a.person_id from public.submission_authors a where a.submission_id = v_a.winner_submission);
  perform private.notify(v_authors, 'venue', v_a.name || ': your paper won',
    'Congratulations — "' || v_title || '" (#' || lpad(v_num::text, 4, '0') || ') won the ' || v_a.name || '. Your certificate is ready to download.',
    v_a.venue_id, v_a.winner_submission, 'Download certificate', '/api/awards/' || p_award || '/certificate');
  perform private.log(v_a.venue_id, 'award.announced', 'award', p_award, jsonb_build_object('submission', v_a.winner_submission));
  return cardinality(v_authors);
end $$;

-- everything the EM34 screen shows. Chairs see vote counts; committee members see their own vote; AEs see what they nominated.
create or replace function public.awards_board(p_venue uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id(); v_chair boolean := private.is_venue_chair(p_venue);
begin
  if not (private.is_organizer(p_venue) or private.has_venue_role(p_venue, array['associate_editor']::public.venue_role[])
          or exists (select 1 from public.award_committee c join public.awards a on a.id = c.award_id where a.venue_id = p_venue and c.person_id = v_me)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'is_chair', v_chair,
    'awards', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'name', a.name, 'max_shortlist', a.max_shortlist, 'winner', a.winner_submission, 'announced_at', a.announced_at,
      'committee', coalesce((select jsonb_agg(jsonb_build_object('person_id', p.id, 'name', p.display_name) order by p.display_name)
                             from public.award_committee c join public.persons p on p.id = c.person_id where c.award_id = a.id), '[]'::jsonb),
      'i_vote', exists (select 1 from public.award_committee c where c.award_id = a.id and c.person_id = v_me),
      'my_vote', (select v.submission_id from public.award_votes v where v.award_id = a.id and v.voter_id = v_me),
      'votes_cast', case when v_chair then (select count(*) from public.award_votes v where v.award_id = a.id) end,
      'nominations', coalesce((select jsonb_agg(jsonb_build_object(
          'id', n.id, 'submission_id', s.id, 'number', s.number, 'title', s.title, 'reason', n.reason, 'shortlisted', n.shortlisted,
          'nominated_by', nb.display_name,
          -- first author's current position says student / PhD (ST01 affiliations)
          'student', exists (select 1 from public.submission_authors sa join public.affiliations af on af.person_id = sa.person_id
                             where sa.submission_id = s.id and sa.position = 1 and af.ends_on is null
                               and coalesce(af.position_title, '') ~* '(student|phd|doctoral)'),
          'authors', (select string_agg(ap.display_name, ', ' order by sa.position) from public.submission_authors sa join public.persons ap on ap.id = sa.person_id where sa.submission_id = s.id),
          'avg_score', (select round(avg(x.v), 1) from public.review_assignments r join public.reviews w on w.assignment_id = r.id,
                          lateral (select avg(value::numeric) v from jsonb_each_text(w.scores)) x where r.submission_id = s.id and r.status = 'submitted'),
          'votes', case when v_chair then (select count(*) from public.award_votes v where v.award_id = a.id and v.submission_id = s.id) end,
          'conflict', private.award_conflict(s.id, v_me))
        order by n.shortlisted desc, s.number)
        from public.award_nominations n join public.submissions s on s.id = n.submission_id left join public.persons nb on nb.id = n.nominated_by
        where n.award_id = a.id and not private.is_submission_author(s.id)
          and (v_chair or n.shortlisted or n.nominated_by = v_me)), '[]'::jsonb))
      order by a.sort, a.created_at) from public.awards a where a.venue_id = p_venue), '[]'::jsonb),
    -- accepted papers this person may nominate
    'nominable', coalesce((select jsonb_agg(jsonb_build_object('submission_id', s.id, 'number', s.number, 'title', s.title) order by s.number)
      from public.submissions s join public.decisions d on d.submission_id = s.id
      where s.venue_id = p_venue and d.decision in ('accept_oral', 'accept_poster', 'conditional') and private.manages_paper(s.id)), '[]'::jsonb),
    'members', case when v_chair then coalesce((select jsonb_agg(distinct jsonb_build_object('person_id', p.id, 'name', p.display_name))
      from public.venue_members m join public.persons p on p.id = m.person_id where m.venue_id = p_venue), '[]'::jsonb) else '[]'::jsonb end
  );
end $$;

-- announced winners of a published venue, for the public archive (PV01p): award, paper title, authors as one display string
create or replace function public.public_awards(p_venue uuid)
returns table (award text, title text, authors text)
language sql stable security definer set search_path = '' as $$
  select a.name, s.title,
         (select string_agg(p.display_name, ', ' order by sa.position) from public.submission_authors sa join public.persons p on p.id = sa.person_id where sa.submission_id = s.id)
  from public.awards a
  join public.submissions s on s.id = a.winner_submission
  join public.venues v on v.id = a.venue_id
  where a.venue_id = p_venue and a.announced_at is not null and v.is_published
  order by a.sort, a.created_at
$$;

-- the same winners with ids, for award badges on public program, session and paper pages
create or replace function public.public_award_winners(p_venue uuid)
returns table (award_id uuid, award text, submission_id uuid, number integer, title text, announced_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, a.name, s.id, s.number, s.title, a.announced_at
  from public.awards a
  join public.submissions s on s.id = a.winner_submission
  join public.venues v on v.id = a.venue_id
  where a.venue_id = p_venue and a.announced_at is not null and v.is_published
  order by a.sort, a.created_at
$$;

-- certificate data: authors of the winning paper and organizers, once announced
create or replace function public.award_certificate(p_award uuid)
returns table (award text, venue text, venue_short text, starts_on date, ends_on date, title text, number integer, authors text[], announced_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.name, v.name, v.short_name, v.starts_on, v.ends_on, s.title, s.number,
         array(select p.display_name from public.submission_authors sa join public.persons p on p.id = sa.person_id where sa.submission_id = s.id order by sa.position),
         a.announced_at
  from public.awards a join public.venues v on v.id = a.venue_id join public.submissions s on s.id = a.winner_submission
  where a.id = p_award and a.announced_at is not null
    and (private.is_submission_author(s.id) or private.is_organizer(a.venue_id))
$$;

-- ================================================================ BL01 — billing (event owner only)
create table public.event_billing (
  venue_id          uuid primary key references public.venues (id) on delete cascade,
  plan              text check (plan in ('workshop', 'conference', 'society')),
  price_cents       integer check (price_cents >= 0),               -- null until prices are set
  currency          text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  submission_limit  integer check (submission_limit > 0),           -- null = not set / unlimited
  ai_limit          integer check (ai_limit > 0),
  billing_name      text check (char_length(billing_name) <= 200),
  vat_number        text check (char_length(vat_number) <= 40),
  billing_address   text check (char_length(billing_address) <= 500),
  po_number         text check (char_length(po_number) <= 80),
  invoice_email     text check (char_length(invoice_email) <= 254),
  updated_by        uuid references public.persons (id) on delete set null,
  updated_at        timestamptz not null default now()
);
create sequence public.event_invoice_seq;
create table public.event_invoices (
  id                 uuid primary key default gen_random_uuid(),
  venue_id           uuid not null references public.venues (id) on delete cascade,
  number             text not null unique,
  issued_on          date not null default current_date,
  due_on             date not null default (current_date + 14),
  description        text not null check (char_length(description) between 2 and 200),
  amount_cents       integer check (amount_cents >= 0),             -- null until the price is set
  currency           text not null default 'EUR',
  status             text not null default 'due' check (status in ('due', 'paid', 'void')),
  method             text check (method in ('card', 'bank')),
  invoice_sent_at    timestamptz,
  stripe_session_id  text,
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index event_invoices_venue_idx on public.event_invoices (venue_id, issued_on desc);
alter table public.event_billing  enable row level security;
alter table public.event_invoices enable row level security;
revoke all on public.event_billing, public.event_invoices from anon, authenticated;
grant select on public.event_billing, public.event_invoices to authenticated;
create policy event_billing_select on public.event_billing for select to authenticated using (private.is_venue_owner(venue_id));
create policy event_invoices_select on public.event_invoices for select to authenticated using (private.is_venue_owner(venue_id));

create or replace function private.new_invoice(p_venue uuid, p_description text, p_amount integer, p_currency text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.event_invoices (venue_id, number, description, amount_cents, currency)
  values (p_venue, 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.event_invoice_seq')::text, 4, '0'), p_description, p_amount, coalesce(p_currency, 'EUR'))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.billing_overview(p_venue uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_venue_owner(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'billing', (select to_jsonb(b) - 'updated_by' from public.event_billing b where b.venue_id = p_venue),
    'invoices', coalesce((select jsonb_agg(to_jsonb(i) - 'stripe_session_id' order by i.issued_on desc, i.number desc) from public.event_invoices i where i.venue_id = p_venue), '[]'::jsonb),
    'submissions', (select count(*) from public.submissions s where s.venue_id = p_venue and s.stage <> 'draft'),
    'ai_uses', (select count(*) from public.ai_requests r join public.submissions s on s.id = r.submission_id where s.venue_id = p_venue)
  );
end $$;

create or replace function public.save_billing_details(p_venue uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_venue_owner(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.event_billing (venue_id, billing_name, vat_number, billing_address, po_number, invoice_email, updated_by)
  values (p_venue, nullif(btrim(p ->> 'billing_name'), ''), nullif(btrim(p ->> 'vat_number'), ''), nullif(btrim(p ->> 'billing_address'), ''),
          nullif(btrim(p ->> 'po_number'), ''), nullif(btrim(p ->> 'invoice_email'), ''), private.current_person_id())
  on conflict (venue_id) do update set billing_name = excluded.billing_name, vat_number = excluded.vat_number,
    billing_address = excluded.billing_address, po_number = excluded.po_number, invoice_email = excluded.invoice_email,
    updated_by = excluded.updated_by, updated_at = now();
  perform private.log(p_venue, 'billing.details', 'venue', p_venue, '{}');
end $$;

-- choosing or changing the plan raises an invoice (amount stays empty until Plenary sets prices)
create or replace function public.change_plan(p_venue uuid, p_plan text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_old text; v_inv uuid; v_label text;
begin
  if not private.is_venue_owner(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_plan not in ('workshop', 'conference', 'society') then raise exception 'bad plan' using errcode = '22023'; end if;
  select plan into v_old from public.event_billing where venue_id = p_venue;
  if v_old = p_plan then return null; end if;
  insert into public.event_billing (venue_id, plan, updated_by) values (p_venue, p_plan, private.current_person_id())
  on conflict (venue_id) do update set plan = excluded.plan, updated_by = excluded.updated_by, updated_at = now();
  v_label := initcap(p_plan) || ' plan';
  v_inv := private.new_invoice(p_venue, case when v_old is null then v_label else v_label || ' · change from ' || initcap(v_old) end,
                               (select price_cents from public.event_billing where venue_id = p_venue),
                               (select currency from public.event_billing where venue_id = p_venue));
  perform private.log(p_venue, 'billing.plan', 'venue', p_venue, jsonb_build_object('from', v_old, 'to', p_plan, 'invoice', v_inv));
  return v_inv;
end $$;

-- "Bank transfer — send me an invoice"
create or replace function public.request_invoice(p_invoice uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_i public.event_invoices;
begin
  select * into v_i from public.event_invoices where id = p_invoice;
  if v_i.id is null or not private.is_venue_owner(v_i.venue_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_i.status <> 'due' then raise exception 'this invoice is not due' using errcode = '22023'; end if;
  update public.event_invoices set method = 'bank', invoice_sent_at = now() where id = p_invoice;
  perform private.log(v_i.venue_id, 'billing.invoice_requested', 'invoice', p_invoice, '{}');
  return jsonb_build_object('number', v_i.number, 'email', (select coalesce(b.invoice_email, '') from public.event_billing b where b.venue_id = v_i.venue_id));
end $$;

create or replace function public.set_invoice_checkout(p_invoice uuid, p_session text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_venue uuid;
begin
  select venue_id into v_venue from public.event_invoices where id = p_invoice and status = 'due';
  if v_venue is null or not private.is_venue_owner(v_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.event_invoices set stripe_session_id = left(p_session, 200), method = 'card' where id = p_invoice;
end $$;

-- Stripe webhook (service role only): mark the invoice of a completed Checkout session as paid
create or replace function public.stripe_mark_paid(p_session text, p_invoice uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_venue uuid;
begin
  update public.event_invoices set status = 'paid', paid_at = now(), method = 'card'
  where id = p_invoice and stripe_session_id = p_session and status = 'due' returning venue_id into v_venue;
  if v_venue is null then return false; end if;
  insert into public.audit_log (venue_id, action, entity, entity_id, details)
  values (v_venue, 'billing.paid', 'invoice', p_invoice, jsonb_build_object('method', 'card'));
  return true;
end $$;

-- ---------------------------------------------------------------- grants
revoke all on function public.similarity_overview(uuid), public.save_similarity(uuid, numeric, numeric, text, jsonb, text, text),
  public.import_similarity(uuid, jsonb), public.mark_similarity_checked(uuid, boolean), public.set_similarity_settings(uuid, integer, boolean),
  public.create_award(uuid, text), public.set_award_committee(uuid, uuid[]), public.nominate_paper(uuid, uuid, text),
  public.set_award_shortlist(uuid, boolean), public.cast_award_vote(uuid, uuid), public.pick_award_winner(uuid, uuid),
  public.announce_award(uuid), public.awards_board(uuid), public.award_certificate(uuid),
  public.billing_overview(uuid), public.save_billing_details(uuid, jsonb), public.change_plan(uuid, text),
  public.request_invoice(uuid), public.set_invoice_checkout(uuid, text), public.stripe_mark_paid(text, uuid),
  public.public_awards(uuid), public.public_award_winners(uuid) from public, anon;
grant execute on function public.similarity_overview(uuid), public.save_similarity(uuid, numeric, numeric, text, jsonb, text, text),
  public.import_similarity(uuid, jsonb), public.mark_similarity_checked(uuid, boolean), public.set_similarity_settings(uuid, integer, boolean),
  public.create_award(uuid, text), public.set_award_committee(uuid, uuid[]), public.nominate_paper(uuid, uuid, text),
  public.set_award_shortlist(uuid, boolean), public.cast_award_vote(uuid, uuid), public.pick_award_winner(uuid, uuid),
  public.announce_award(uuid), public.awards_board(uuid), public.award_certificate(uuid),
  public.billing_overview(uuid), public.save_billing_details(uuid, jsonb), public.change_plan(uuid, text),
  public.request_invoice(uuid), public.set_invoice_checkout(uuid, text) to authenticated;
grant execute on function public.public_awards(uuid), public.public_award_winners(uuid) to anon, authenticated;
grant execute on function public.stripe_mark_paid(text, uuid) to service_role;
