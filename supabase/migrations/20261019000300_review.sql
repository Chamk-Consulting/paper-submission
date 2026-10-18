-- Review and decisions (canvas RV01–RV10, EM20–EM28, EM41 basics).
-- Blind rules live here: reviewers never read author identities; authors read reviews only after release and
-- only the "to authors" part; a chair who wrote a paper can't see its reviews (B1) — a deputy handles it.

-- ---------------------------------------------------------------- people: reviewer preferences + profile extras
alter table public.persons
  add column if not exists availability   text not null default 'normal' check (availability in ('normal', 'low', 'off')),
  add column if not exists available_from date,
  add column if not exists monthly_limit  smallint not null default 4 check (monthly_limit between 0 and 30),
  add column if not exists timezone       text check (char_length(timezone) <= 64),
  add column if not exists locale         text check (locale in ('en', 'fr', 'it', 'de')),
  add column if not exists pronouns       text check (char_length(pronouns) <= 40),
  add column if not exists ieee_member    text check (char_length(ieee_member) <= 20),
  add column if not exists scholar_url    text check (scholar_url is null or scholar_url ~ '^https://'),
  add column if not exists visibility     text not null default 'signed_in' check (visibility in ('public', 'signed_in', 'venues_only'));
grant update (availability, available_from, monthly_limit, timezone, locale, pronouns, ieee_member, scholar_url, visibility)
  on public.persons to authenticated;

create table public.person_topics (
  person_id  uuid not null references public.persons (id) on delete cascade,
  topic      text not null check (char_length(topic) between 2 and 120),
  created_at timestamptz not null default now(),
  primary key (person_id, topic)
);

-- ---------------------------------------------------------------- submissions: review fields
alter table public.submissions
  add column if not exists handling_ae     uuid references public.persons (id) on delete set null,
  add column if not exists ae_assigned_at  timestamptz,
  add column if not exists similarity_pct  numeric(5, 2) check (similarity_pct between 0 and 100),
  add column if not exists topic           text check (char_length(topic) <= 120);
create index if not exists submissions_ae_idx on public.submissions (handling_ae) where handling_ae is not null;

create or replace function private.words(p text)
returns integer language sql immutable set search_path = '' as $$
  select case when btrim(coalesce(p, '')) = '' then 0 else coalesce(array_length(regexp_split_to_array(btrim(p), '\s+'), 1), 0) end
$$;

-- ---------------------------------------------------------------- assignments + reviews
create table public.review_assignments (
  id                 uuid primary key default gen_random_uuid(),
  submission_id      uuid not null references public.submissions (id) on delete cascade,
  reviewer_id        uuid references public.persons (id) on delete cascade,
  invited_email      extensions.citext,
  round              smallint not null default 1 check (round between 1 and 3),
  ordinal            smallint check (ordinal between 1 and 20),            -- "Reviewer 2", given on accept
  invited_by         uuid references public.persons (id) on delete set null,
  token_hash         text unique check (token_hash is null or char_length(token_hash) = 64),
  status             text not null default 'invited'
    check (status in ('invited', 'accepted', 'declined', 'expired', 'closed', 'handed_back', 'submitted', 'cancelled')),
  reply_by           timestamptz not null default now() + interval '3 days',
  due_at             timestamptz not null,
  responded_at       timestamptz,
  decline_reason     text check (decline_reason in ('busy', 'expertise', 'conflict', 'other')),
  decline_suggestion text check (char_length(decline_suggestion) <= 300),
  coi_confirmed_at   timestamptz,
  submitted_at       timestamptz,
  receipt            text,
  locked_at          timestamptz,
  editor_rating      smallint check (editor_rating between 1 and 5),
  editor_tags        text[] not null default '{}',
  orcid_push         boolean not null default true,
  created_at         timestamptz not null default now(),
  check (reviewer_id is not null or invited_email is not null)
);
create unique index review_assignments_uq on public.review_assignments (submission_id, reviewer_id, round) where reviewer_id is not null;
create index review_assignments_reviewer_idx on public.review_assignments (reviewer_id, status);

create table public.reviews (
  assignment_id      uuid primary key references public.review_assignments (id) on delete cascade,
  scores             jsonb not null default '{}'::jsonb,     -- {criterion_key: 1..5}
  recommendation     text check (recommendation in ('accept', 'weak_accept', 'borderline', 'weak_reject', 'reject', 'major_revision',
                                                    'accept_minor', 'another_revision')),
  confidence         text check (confidence in ('low', 'medium', 'high')),
  to_authors         text not null default '' check (char_length(to_authors) <= 30000),
  to_editor          text not null default '' check (char_length(to_editor) <= 10000),
  annotated_path     text,
  round2             jsonb not null default '[]'::jsonb,      -- [{comment, location, response, addressed: yes|partly|no}]
  remaining_concerns text check (char_length(remaining_concerns) <= 10000),
  ai_declaration     text check (char_length(ai_declaration) <= 500),
  updated_at         timestamptz not null default now(),
  submitted_at       timestamptz
);

create table public.review_changes (
  id             bigint generated always as identity primary key,
  assignment_id  uuid not null references public.review_assignments (id) on delete cascade,
  field          text not null,
  old_value      text,
  new_value      text,
  changed_at     timestamptz not null default now()
);

create table public.review_notes (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.review_assignments (id) on delete cascade,
  page           smallint check (page between 1 and 999),
  anchor         text check (char_length(anchor) <= 60),
  body           text not null check (char_length(body) between 1 and 4000),
  in_review      boolean not null default false,
  created_at     timestamptz not null default now()
);

create table public.extension_requests (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.review_assignments (id) on delete cascade,
  option         text not null check (option in ('d3', 'd7', 'd14', 'hand_back')),
  requested_until timestamptz,
  message        text check (char_length(message) <= 2000),
  suggestion     text check (char_length(suggestion) <= 300),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'counter_offered', 'accepted_counter', 'cancelled', 'refused', 'handed_back')),
  offered_until  timestamptz,
  editor_message text check (char_length(editor_message) <= 2000),
  decided_by     uuid references public.persons (id) on delete set null,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz
);

create table public.review_reminders (
  id             bigint generated always as identity primary key,
  assignment_id  uuid not null references public.review_assignments (id) on delete cascade,
  kind           text not null check (kind in ('d7', 'd3', 'd1', 'overdue', 'manual')),
  sent_at        timestamptz not null default now()
);

create table public.discussion_posts (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  author_id      uuid not null references public.persons (id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 8000),
  created_at     timestamptz not null default now()
);
create index discussion_posts_sub_idx on public.discussion_posts (submission_id, created_at);

create table public.bids (
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  person_id      uuid not null references public.persons (id) on delete cascade,
  level          text not null check (level in ('eager', 'willing', 'not_my_area', 'conflict')),
  updated_at     timestamptz not null default now(),
  primary key (submission_id, person_id)
);

create table public.ae_recommendations (
  submission_id     uuid primary key references public.submissions (id) on delete cascade,
  ae_id             uuid references public.persons (id) on delete set null,
  summary           text not null default '' check (char_length(summary) <= 20000),
  recommendation    text check (recommendation in ('accept_oral', 'accept_poster', 'conditional', 'reject')),
  confidential_note text check (char_length(confidential_note) <= 5000),
  sent_at           timestamptz,
  updated_at        timestamptz not null default now()
);

create table public.decision_batches (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues (id) on delete cascade,
  scope            text not null default 'all' check (scope in ('all', 'by_type')),
  paper_type       text,
  scheduled_at     timestamptz,
  released_at      timestamptz,
  released_by      uuid references public.persons (id) on delete set null,
  recipients       integer not null default 0,
  delivered        integer not null default 0,
  bounced          integer not null default 0
);

create table public.decisions (
  submission_id   uuid primary key references public.submissions (id) on delete cascade,
  decision        text not null check (decision in ('accept_oral', 'accept_poster', 'conditional', 'reject', 'desk_reject')),
  reason          text check (char_length(reason) <= 80),             -- desk reject reason
  letter          text check (char_length(letter) <= 30000),
  editor_summary  text check (char_length(editor_summary) <= 20000),
  drafted_by      uuid references public.persons (id) on delete set null,
  drafted_at      timestamptz not null default now(),
  batch_id        uuid references public.decision_batches (id) on delete set null,
  released_at     timestamptz,
  revision_due_at timestamptz
);

-- ---------------------------------------------------------------- helpers
-- accepted (or done) reviewer of this paper
create or replace function private.is_reviewer_of(p_submission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.review_assignments r where r.submission_id = p_submission
                 and r.reviewer_id = (select private.current_person_id()) and r.status in ('accepted', 'submitted'))
$$;
create or replace function private.handles_paper(p_submission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.submissions s where s.id = p_submission and s.handling_ae = (select private.current_person_id()))
$$;
-- chair of the paper's venue who is not one of its authors (B1), or its handling AE
create or replace function private.manages_paper(p_submission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (exists (select 1 from public.submissions s where s.id = p_submission and private.is_venue_chair(s.venue_id))
          and not private.is_submission_author(p_submission))
      or private.handles_paper(p_submission)
$$;
grant execute on function private.is_reviewer_of(uuid), private.handles_paper(uuid), private.manages_paper(uuid), private.words(text) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.person_topics      enable row level security;
alter table public.review_assignments enable row level security;
alter table public.reviews            enable row level security;
alter table public.review_changes     enable row level security;
alter table public.review_notes       enable row level security;
alter table public.extension_requests enable row level security;
alter table public.review_reminders   enable row level security;
alter table public.discussion_posts   enable row level security;
alter table public.bids               enable row level security;
alter table public.ae_recommendations enable row level security;
alter table public.decision_batches   enable row level security;
alter table public.decisions          enable row level security;
revoke all on public.person_topics, public.review_assignments, public.reviews, public.review_changes, public.review_notes,
  public.extension_requests, public.review_reminders, public.discussion_posts, public.bids, public.ae_recommendations,
  public.decision_batches, public.decisions from anon;

create policy person_topics_own on public.person_topics for all to authenticated
  using (person_id = (select private.current_person_id())) with check (person_id = (select private.current_person_id()));
create policy person_topics_chairs on public.person_topics for select to authenticated using ((select private.can_see_person(person_id)));

create policy review_assignments_select on public.review_assignments for select to authenticated
  using (reviewer_id = (select private.current_person_id()) or (select private.manages_paper(submission_id)));
revoke insert, update, delete on public.review_assignments from authenticated;

-- reviews: the reviewer and those who manage the paper; everyone else goes through paper_reviews()
create policy reviews_select on public.reviews for select to authenticated
  using (exists (select 1 from public.review_assignments r where r.id = assignment_id
                 and (r.reviewer_id = (select private.current_person_id()) or (select private.manages_paper(r.submission_id)))));
revoke insert, update, delete on public.reviews from authenticated;

create policy review_changes_select on public.review_changes for select to authenticated
  using (exists (select 1 from public.review_assignments r where r.id = assignment_id and (select private.manages_paper(r.submission_id))));
revoke insert, update, delete on public.review_changes from authenticated;

create policy review_notes_own on public.review_notes for all to authenticated
  using (exists (select 1 from public.review_assignments r where r.id = assignment_id and r.reviewer_id = (select private.current_person_id())))
  with check (exists (select 1 from public.review_assignments r where r.id = assignment_id and r.reviewer_id = (select private.current_person_id()) and r.status = 'accepted'));

create policy extension_requests_select on public.extension_requests for select to authenticated
  using (exists (select 1 from public.review_assignments r where r.id = assignment_id
                 and (r.reviewer_id = (select private.current_person_id()) or (select private.manages_paper(r.submission_id)))));
revoke insert, update, delete on public.extension_requests from authenticated;

create policy review_reminders_select on public.review_reminders for select to authenticated
  using (exists (select 1 from public.review_assignments r where r.id = assignment_id
                 and (r.reviewer_id = (select private.current_person_id()) or (select private.manages_paper(r.submission_id)))));
revoke insert, update, delete on public.review_reminders from authenticated;

create policy discussion_select on public.discussion_posts for select to authenticated
  using ((select private.manages_paper(submission_id))
         or exists (select 1 from public.review_assignments r where r.submission_id = discussion_posts.submission_id
                    and r.reviewer_id = (select private.current_person_id()) and r.status = 'submitted'));
revoke insert, update, delete on public.discussion_posts from authenticated;

create policy bids_own on public.bids for select to authenticated using (person_id = (select private.current_person_id()));
create policy bids_chairs on public.bids for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id and (select private.is_venue_chair(s.venue_id))));
revoke insert, update, delete on public.bids from authenticated;

create policy ae_recommendations_select on public.ae_recommendations for select to authenticated using ((select private.manages_paper(submission_id)));
revoke insert, update, delete on public.ae_recommendations from authenticated;

create policy decision_batches_select on public.decision_batches for select to authenticated using ((select private.is_venue_chair(venue_id)));
revoke insert, update, delete on public.decision_batches from authenticated;

-- decisions: managers always; authors once released
create policy decisions_select on public.decisions for select to authenticated
  using ((select private.manages_paper(submission_id))
         or (released_at is not null and (select private.is_submission_author(submission_id))));
revoke insert, update, delete on public.decisions from authenticated;

-- submissions: chairs (all chair roles), handling AE and reviewers see the paper row (reviewers: no author table access)
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions for select to authenticated
  using ((select private.is_submission_author(id))
         or (select private.is_venue_chair(venue_id))
         or handling_ae = (select private.current_person_id())
         or (select private.is_reviewer_of(id)));

drop policy if exists submission_files_select on public.submission_files;
create policy submission_files_select on public.submission_files for select to authenticated
  using ((select private.is_submission_author(submission_id))
         or (select private.manages_paper(submission_id))
         or (select private.is_reviewer_of(submission_id)));

drop policy if exists papers_select on storage.objects;
create policy papers_select on storage.objects for select to authenticated
  using (bucket_id = 'papers' and (
    (select private.is_submission_author(((storage.foldername(name))[1])::uuid))
    or (select private.manages_paper(((storage.foldername(name))[1])::uuid))
    or (select private.is_reviewer_of(((storage.foldername(name))[1])::uuid))));

-- ---------------------------------------------------------------- RPC: AE assignment (EM22, B4, E2)
create or replace function public.assign_ae(p_submission uuid, p_ae uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  v_cap int;
  v_load int;
begin
  select * into s from public.submissions where id = p_submission for update;
  if s.id is null or not private.is_venue_chair(s.venue_id) or private.is_submission_author(p_submission) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_ae is null then
    update public.submissions set handling_ae = null, ae_assigned_at = null where id = p_submission; return;
  end if;
  if not exists (select 1 from public.venue_members m where m.venue_id = s.venue_id and m.person_id = p_ae
                 and m.role in ('associate_editor', 'program_chair', 'deputy_chair', 'chair')) then
    raise exception 'not an associate editor of this event' using errcode = '22023';
  end if;
  if exists (select 1 from public.submission_authors a where a.submission_id = p_submission and a.person_id = p_ae)
     or exists (select 1 from public.submission_conflicts c where c.submission_id = p_submission and c.person_id = p_ae) then
    raise exception 'conflict of interest (B4)' using errcode = '22023';
  end if;
  select coalesce(max(m.load_cap), (select ae_cap from public.venue_settings where venue_id = s.venue_id)) into v_cap
    from public.venue_members m where m.venue_id = s.venue_id and m.person_id = p_ae;
  select count(*) into v_load from public.submissions x where x.venue_id = s.venue_id and x.handling_ae = p_ae and x.stage not in ('withdrawn', 'rejected');
  if v_load >= v_cap and not private.has_venue_role(s.venue_id, array['owner', 'program_chair']::public.venue_role[]) then
    raise exception 'associate editor at limit — needs the program chair (E2)' using errcode = '22023';
  end if;
  update public.submissions set handling_ae = p_ae, ae_assigned_at = now(),
    stage = case when stage = 'submitted' then 'review'::public.submission_stage else stage end where id = p_submission;
  perform private.log(s.venue_id, 'paper.ae_assigned', 'submission', p_submission, jsonb_build_object('ae', p_ae, 'over_limit', v_load >= v_cap));
end $$;

-- ---------------------------------------------------------------- RPC: invite a reviewer (EM23, E3–E5, B6)
create or replace function public.invite_reviewer(p_submission uuid, p_person uuid, p_email text, p_token_hash text, p_due timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  st public.venue_settings;
  v_person uuid := p_person;
  v_id uuid;
begin
  select * into s from public.submissions where id = p_submission;
  if s.id is null or not private.manages_paper(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into st from public.venue_settings where venue_id = s.venue_id;
  if v_person is null and p_email is not null then
    select e.person_id into v_person from public.person_emails e where e.email = p_email::extensions.citext limit 1;
  end if;
  if (select count(*) from public.review_assignments r where r.submission_id = p_submission and r.round = 1
      and r.status in ('invited', 'accepted', 'submitted')) >= st.max_reviewers then
    raise exception 'maximum reviewers reached (E3)' using errcode = '22023';
  end if;
  if v_person is not null and (
       exists (select 1 from public.submission_authors a where a.submission_id = p_submission and a.person_id = v_person)
    or exists (select 1 from public.submission_conflicts c where c.submission_id = p_submission and c.person_id = v_person)
    or exists (select 1 from public.bids b where b.submission_id = p_submission and b.person_id = v_person and b.level = 'conflict')) then
    if not exists (select 1 from public.conflict_overrides o where o.submission_id = p_submission and o.person_id = v_person and o.status = 'approved') then
      raise exception 'conflict of interest (B6)' using errcode = '22023';
    end if;
  end if;
  insert into public.review_assignments (submission_id, reviewer_id, invited_email, invited_by, token_hash, reply_by, due_at)
  values (p_submission, v_person, nullif(p_email, '')::extensions.citext, private.current_person_id(), p_token_hash,
          now() + make_interval(days => st.invite_days), p_due)
  returning id into v_id;
  perform private.log(s.venue_id, 'review.invited', 'submission', p_submission, jsonb_build_object('assignment', v_id));
  return v_id;
end $$;

-- What a reviewer sees about an invitation (RV02, RV02e): no author identities.
create or replace function public.review_invitation(p_assignment uuid, p_token_hash text default null)
returns table (assignment_id uuid, status text, reply_by timestamptz, due_at timestamptz, venue_name text, venue_short text, venue_slug text,
               paper_number integer, title text, abstract text, keywords text[], paper_type text, pages integer, blind_type text,
               inviter text, is_mine boolean, invited_email text)
language sql stable security definer set search_path = '' as $$
  select r.id, case when r.status = 'invited' and r.reply_by < now() then 'expired' else r.status end, r.reply_by, r.due_at,
         v.name, v.short_name, v.slug::text, s.number, s.title, s.abstract, s.keywords, s.paper_type,
         (select f.pages from public.submission_files f where f.submission_id = s.id and f.role = 'paper' and f.is_current limit 1),
         st.blind_type, p.display_name, r.reviewer_id = private.current_person_id(), r.invited_email::text
  from public.review_assignments r
  join public.submissions s on s.id = r.submission_id
  join public.venues v on v.id = s.venue_id
  left join public.venue_settings st on st.venue_id = v.id
  left join public.persons p on p.id = r.invited_by
  where (p_token_hash is not null and r.token_hash = p_token_hash)
     or (p_token_hash is null and r.id = p_assignment and (r.reviewer_id = private.current_person_id() or private.manages_paper(r.submission_id)))
$$;

create or replace function public.respond_review_invitation(p_assignment uuid, p_token_hash text, p_accept boolean, p_coi boolean,
                                                            p_reason text default null, p_suggestion text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  r public.review_assignments;
  v_me uuid := private.current_person_id();
begin
  select * into r from public.review_assignments
   where (p_token_hash is not null and token_hash = p_token_hash) or (p_token_hash is null and id = p_assignment) for update;
  if r.id is null then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if p_token_hash is null and (v_me is null or r.reviewer_id is distinct from v_me) then raise exception 'not your invitation' using errcode = '42501'; end if;
  if r.status <> 'invited' then return r.status; end if;
  if r.reply_by < now() then update public.review_assignments set status = 'expired' where id = r.id; return 'expired'; end if;
  if p_accept then
    if not coalesce(p_coi, false) then raise exception 'confirm you have no conflict of interest' using errcode = '22023'; end if;
    update public.review_assignments set status = 'accepted', responded_at = now(), coi_confirmed_at = now(),
      reviewer_id = coalesce(reviewer_id, v_me),
      ordinal = (select coalesce(max(x.ordinal), 0) + 1 from public.review_assignments x where x.submission_id = r.submission_id and x.round = r.round)
    where id = r.id;
    insert into public.reviews (assignment_id) values (r.id) on conflict do nothing;
  else
    update public.review_assignments set status = 'declined', responded_at = now(),
      decline_reason = coalesce(p_reason, 'other'), decline_suggestion = nullif(btrim(coalesce(p_suggestion, '')), '')
    where id = r.id;
  end if;
  insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id, details)
  select coalesce(v_me, r.reviewer_id), s.venue_id, case when p_accept then 'review.accepted' else 'review.declined' end, 'submission', s.id,
         jsonb_build_object('assignment', r.id, 'reason', p_reason)
  from public.submissions s where s.id = r.submission_id;
  return case when p_accept then 'accepted' else 'declined' end;
end $$;

-- ---------------------------------------------------------------- RPC: write / submit a review (RV03, RV04, RV07, RV09)
create or replace function public.save_review(p_assignment uuid, p_scores jsonb, p_recommendation text, p_confidence text,
                                              p_to_authors text, p_to_editor text, p_submit boolean, p_round2 jsonb default null,
                                              p_remaining text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  r public.review_assignments;
  old public.reviews;
  st public.venue_settings;
  v_venue uuid;
  c jsonb;
  v_receipt text;
begin
  select * into r from public.review_assignments where id = p_assignment for update;
  if r.id is null or r.reviewer_id is distinct from private.current_person_id() then raise exception 'not your review' using errcode = '42501'; end if;
  if r.status not in ('accepted', 'submitted') then raise exception 'review is %', r.status using errcode = '22023'; end if;
  if r.locked_at is not null then raise exception 'the decision has started — ask the editor to reopen your review' using errcode = '22023'; end if;
  select s.venue_id into v_venue from public.submissions s where s.id = r.submission_id;
  select * into st from public.venue_settings where venue_id = v_venue;
  select * into old from public.reviews where assignment_id = r.id;

  if coalesce(p_submit, false) or r.status = 'submitted' then
    if r.round = 1 then
      for c in select * from jsonb_array_elements(st.criteria) loop
        if coalesce((p_scores ->> (c ->> 'key'))::int, 0) not between 1 and 5 then raise exception 'score missing: %', c ->> 'name' using errcode = '22023'; end if;
      end loop;
      if p_confidence is null then raise exception 'confidence missing' using errcode = '22023'; end if;
      if private.words(p_to_authors) < 100 then raise exception 'comments to the authors need at least 100 words' using errcode = '22023'; end if;
    end if;
    if p_recommendation is null then raise exception 'recommendation missing' using errcode = '22023'; end if;
  end if;

  -- after submission, changes are logged (B9)
  if r.status = 'submitted' and old.assignment_id is not null then
    insert into public.review_changes (assignment_id, field, old_value, new_value)
    select r.id, k, old.scores ->> k, p_scores ->> k from jsonb_object_keys(coalesce(p_scores, '{}'::jsonb)) k
    where (old.scores ->> k) is distinct from (p_scores ->> k);
    if old.recommendation is distinct from p_recommendation then
      insert into public.review_changes (assignment_id, field, old_value, new_value) values (r.id, 'recommendation', old.recommendation, p_recommendation);
    end if;
  end if;

  insert into public.reviews (assignment_id, scores, recommendation, confidence, to_authors, to_editor, round2, remaining_concerns, updated_at)
  values (r.id, coalesce(p_scores, '{}'::jsonb), p_recommendation, p_confidence, coalesce(p_to_authors, ''), coalesce(p_to_editor, ''),
          coalesce(p_round2, '[]'::jsonb), p_remaining, now())
  on conflict (assignment_id) do update set scores = excluded.scores, recommendation = excluded.recommendation,
    confidence = excluded.confidence, to_authors = excluded.to_authors, to_editor = excluded.to_editor,
    round2 = excluded.round2, remaining_concerns = excluded.remaining_concerns, updated_at = now();

  if coalesce(p_submit, false) and r.status = 'accepted' then
    v_receipt := 'PLN-R-' || lpad(coalesce((select number::text from public.submissions where id = r.submission_id), '0'), 4, '0') || '-' || coalesce(r.ordinal, 1);
    update public.reviews set submitted_at = now() where assignment_id = r.id;
    update public.review_assignments set status = 'submitted', submitted_at = now(), receipt = v_receipt where id = r.id;
    perform private.log(v_venue, 'review.submitted', 'submission', r.submission_id, jsonb_build_object('assignment', r.id));
    return v_receipt;
  end if;
  return 'saved';
end $$;

-- ---------------------------------------------------------------- RPC: my reviews (RV01)
create or replace function public.my_reviews()
returns table (assignment_id uuid, submission_id uuid, status text, round smallint, ordinal smallint, reply_by timestamptz, due_at timestamptz,
               submitted_at timestamptz, paper_number integer, title text, venue_short text, venue_slug text, decision_released boolean,
               draft_scores integer, discussion_posts bigint)
language sql stable security definer set search_path = '' as $$
  select r.id, s.id, case when r.status = 'invited' and r.reply_by < now() then 'expired' else r.status end, r.round, r.ordinal,
         r.reply_by, r.due_at, r.submitted_at, s.number, s.title, coalesce(v.short_name, v.name), v.slug::text,
         exists (select 1 from public.decisions d where d.submission_id = s.id and d.released_at is not null),
         (select count(*)::int from jsonb_object_keys(coalesce(w.scores, '{}'::jsonb))),
         (select count(*) from public.discussion_posts p where p.submission_id = s.id)
  from public.review_assignments r
  join public.submissions s on s.id = r.submission_id
  join public.venues v on v.id = s.venue_id
  left join public.reviews w on w.assignment_id = r.id
  where r.reviewer_id = private.current_person_id()
  order by r.due_at
$$;

-- ---------------------------------------------------------------- RPC: reviews of a paper, as the caller may see them
-- managers: everything incl. names; reviewers: other reviews only after their own is in (E7), anonymous unless named;
-- authors: after release, "to authors" + scores, anonymous.
create or replace function public.paper_reviews(p_submission uuid)
returns table (assignment_id uuid, label text, reviewer_name text, is_me boolean, status text, round smallint, scores jsonb,
               recommendation text, confidence text, to_authors text, to_editor text, submitted_at timestamptz, due_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  v_manager boolean := private.manages_paper(p_submission);
  v_mine_in boolean;
  v_named boolean;
  v_released boolean;
  v_author boolean := private.is_submission_author(p_submission);
begin
  select exists (select 1 from public.review_assignments r where r.submission_id = p_submission and r.reviewer_id = v_me and r.status = 'submitted') into v_mine_in;
  select coalesce(st.named_discussion, false) into v_named from public.submissions s join public.venue_settings st on st.venue_id = s.venue_id where s.id = p_submission;
  select exists (select 1 from public.decisions d where d.submission_id = p_submission and d.released_at is not null) into v_released;
  if v_manager then
    return query select r.id, 'Reviewer ' || coalesce(r.ordinal, 0), p.display_name, r.reviewer_id = v_me, r.status, r.round, w.scores,
      w.recommendation, w.confidence, w.to_authors, w.to_editor, w.submitted_at, r.due_at
      from public.review_assignments r left join public.reviews w on w.assignment_id = r.id left join public.persons p on p.id = r.reviewer_id
      where r.submission_id = p_submission order by r.round, r.ordinal nulls last;
  elsif v_mine_in or exists (select 1 from public.review_assignments r where r.submission_id = p_submission and r.reviewer_id = v_me and r.status = 'accepted') then
    return query select r.id, 'Reviewer ' || coalesce(r.ordinal, 0) || case when r.reviewer_id = v_me then ' (you)' else '' end,
      case when v_named or r.reviewer_id = v_me then p.display_name else null end, r.reviewer_id = v_me, r.status, r.round, w.scores,
      w.recommendation, w.confidence, w.to_authors, case when r.reviewer_id = v_me then w.to_editor else null end, w.submitted_at, r.due_at
      from public.review_assignments r left join public.reviews w on w.assignment_id = r.id left join public.persons p on p.id = r.reviewer_id
      where r.submission_id = p_submission and r.status = 'submitted' and (r.reviewer_id = v_me or v_mine_in)
      order by r.round, r.ordinal;
  elsif v_author and v_released then
    return query select r.id, 'Reviewer ' || coalesce(r.ordinal, 0), null::text, false, r.status, r.round, w.scores,
      w.recommendation, null::text, w.to_authors, null::text, w.submitted_at, null::timestamptz
      from public.review_assignments r join public.reviews w on w.assignment_id = r.id
      where r.submission_id = p_submission and r.status = 'submitted' order by r.round, r.ordinal;
  end if;
end $$;

-- ---------------------------------------------------------------- RPC: extensions (RV06, EM25, C7)
create or replace function public.request_extension(p_assignment uuid, p_option text, p_message text, p_suggestion text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  r public.review_assignments;
  v_days int := case p_option when 'd3' then 3 when 'd7' then 7 when 'd14' then 14 else 0 end;
  v_id uuid;
begin
  select * into r from public.review_assignments where id = p_assignment for update;
  if r.id is null or r.reviewer_id is distinct from private.current_person_id() or r.status <> 'accepted' then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_option = 'hand_back' then
    update public.review_assignments set status = 'handed_back' where id = r.id;
    delete from public.reviews where assignment_id = r.id;
    insert into public.extension_requests (assignment_id, option, message, suggestion, status, decided_at)
    values (r.id, 'hand_back', p_message, p_suggestion, 'handed_back', now());
    return 'handed_back';
  end if;
  update public.extension_requests set status = 'cancelled' where assignment_id = r.id and status in ('pending', 'counter_offered');
  insert into public.extension_requests (assignment_id, option, requested_until, message)
  values (r.id, p_option, r.due_at + make_interval(days => v_days), p_message) returning id into v_id;
  if p_option = 'd3' then   -- usually approved straight away
    update public.review_assignments set due_at = due_at + interval '3 days' where id = r.id;
    update public.extension_requests set status = 'approved', decided_at = now() where id = v_id;
    return 'approved';
  end if;
  return 'pending';
end $$;

create or replace function public.decide_extension(p_request uuid, p_approve boolean, p_offer timestamptz default null, p_message text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  e public.extension_requests;
  r public.review_assignments;
begin
  select * into e from public.extension_requests where id = p_request for update;
  select * into r from public.review_assignments where id = e.assignment_id;
  if e.id is null or not private.manages_paper(r.submission_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if e.status not in ('pending') then return e.status; end if;
  if p_offer is not null then
    update public.extension_requests set status = 'counter_offered', offered_until = p_offer, editor_message = p_message,
      decided_by = private.current_person_id(), decided_at = now() where id = e.id;
    return 'counter_offered';
  end if;
  update public.extension_requests set status = case when p_approve then 'approved' else 'refused' end, editor_message = p_message,
    decided_by = private.current_person_id(), decided_at = now() where id = e.id;
  if p_approve then update public.review_assignments set due_at = e.requested_until where id = r.id; end if;
  return case when p_approve then 'approved' else 'refused' end;
end $$;

create or replace function public.accept_counter_offer(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.extension_requests;
begin
  select x.* into e from public.extension_requests x join public.review_assignments r on r.id = x.assignment_id
   where x.id = p_request and r.reviewer_id = private.current_person_id() and x.status = 'counter_offered' for update;
  if e.id is null then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.extension_requests set status = 'accepted_counter' where id = e.id;
  update public.review_assignments set due_at = e.offered_until where id = e.assignment_id;
end $$;

-- ---------------------------------------------------------------- RPC: discussion, bids (RV07, RV10)
create or replace function public.post_discussion(p_submission uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not (private.manages_paper(p_submission) or exists (select 1 from public.review_assignments r where r.submission_id = p_submission
          and r.reviewer_id = private.current_person_id() and r.status = 'submitted')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.discussion_posts (submission_id, author_id, body) values (p_submission, private.current_person_id(), btrim(p_body)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.discussion(p_submission uuid)
returns table (id uuid, label text, is_me boolean, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id,
         case when private.handles_paper(p_submission) and d.author_id = private.current_person_id() then 'Associate editor'
              when exists (select 1 from public.submissions s where s.id = p_submission and s.handling_ae = d.author_id) then 'Associate editor'
              when r.ordinal is not null then 'Reviewer ' || r.ordinal
              else 'Program committee' end
           || case when d.author_id = private.current_person_id() then ' (you)' else '' end,
         d.author_id = private.current_person_id(), d.body, d.created_at
  from public.discussion_posts d
  left join public.review_assignments r on r.submission_id = d.submission_id and r.reviewer_id = d.author_id and r.round = 1
  where d.submission_id = p_submission
    and (private.manages_paper(p_submission) or exists (select 1 from public.review_assignments x where x.submission_id = p_submission
         and x.reviewer_id = private.current_person_id() and x.status = 'submitted'))
  order by d.created_at
$$;

create or replace function public.place_bid(p_submission uuid, p_level text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_venue uuid;
begin
  select venue_id into v_venue from public.submissions where id = p_submission and stage in ('submitted', 'review');
  if v_venue is null or not private.has_venue_role(v_venue, array['reviewer', 'associate_editor']::public.venue_role[])
     or not exists (select 1 from public.venue_settings st where st.venue_id = v_venue and st.bidding) then
    raise exception 'bidding is not open for you here' using errcode = '42501';
  end if;
  if p_level is null then delete from public.bids where submission_id = p_submission and person_id = private.current_person_id(); return; end if;
  insert into public.bids (submission_id, person_id, level) values (p_submission, private.current_person_id(), p_level)
  on conflict (submission_id, person_id) do update set level = excluded.level, updated_at = now();
end $$;

-- papers open for bidding (titles + abstracts only; own and same-institution papers hidden)
create or replace function public.bidding_papers(p_venue uuid)
returns table (submission_id uuid, number integer, title text, abstract text, keywords text[], topic text, my_bid text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.number, s.title, s.abstract, s.keywords, coalesce(s.topic, s.track),
         (select b.level from public.bids b where b.submission_id = s.id and b.person_id = private.current_person_id())
  from public.submissions s
  where s.venue_id = p_venue and s.stage in ('submitted', 'review')
    and private.has_venue_role(p_venue, array['reviewer', 'associate_editor']::public.venue_role[])
    and not private.is_submission_author(s.id)
  order by s.number
$$;

-- ---------------------------------------------------------------- RPC: AE recommendation, decisions (EM24, EM26, EM27, D8)
create or replace function public.save_recommendation(p_submission uuid, p_summary text, p_rec text, p_note text, p_send boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.manages_paper(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  if coalesce(p_send, false) and (private.words(p_summary) < 60 or p_rec is null) then
    raise exception 'summary of at least 60 words and a recommendation are needed' using errcode = '22023';
  end if;
  insert into public.ae_recommendations (submission_id, ae_id, summary, recommendation, confidential_note, sent_at, updated_at)
  values (p_submission, private.current_person_id(), coalesce(p_summary, ''), p_rec, p_note, case when p_send then now() end, now())
  on conflict (submission_id) do update set summary = excluded.summary, recommendation = excluded.recommendation,
    confidential_note = excluded.confidential_note, ae_id = excluded.ae_id,
    sent_at = coalesce(public.ae_recommendations.sent_at, excluded.sent_at), updated_at = now();
end $$;

create or replace function public.set_decision(p_submission uuid, p_decision text, p_reason text default null, p_letter text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  v_min int;
  v_in int;
begin
  select * into s from public.submissions where id = p_submission;
  if s.id is null or not private.is_venue_chair(s.venue_id) or private.is_submission_author(p_submission) then
    raise exception 'only a program chair without a conflict decides (F1, B1)' using errcode = '42501';
  end if;
  if exists (select 1 from public.decisions d where d.submission_id = p_submission and d.released_at is not null)
     and not private.is_venue_owner(s.venue_id) then
    raise exception 'released decisions change only with owner approval (F5)' using errcode = '42501';
  end if;
  if p_decision is null then delete from public.decisions where submission_id = p_submission and released_at is null; return; end if;
  if p_decision <> 'desk_reject' then
    select min_reviews into v_min from public.venue_settings where venue_id = s.venue_id;
    select count(*) into v_in from public.review_assignments r where r.submission_id = p_submission and r.status = 'submitted' and r.round = 1;
    if v_in < v_min then raise exception 'needs % reviews (has %) (F2)', v_min, v_in using errcode = '22023'; end if;
  end if;
  insert into public.decisions (submission_id, decision, reason, letter, drafted_by, drafted_at)
  values (p_submission, p_decision, p_reason, p_letter, private.current_person_id(), now())
  on conflict (submission_id) do update set decision = excluded.decision, reason = excluded.reason, letter = excluded.letter,
    drafted_by = excluded.drafted_by, drafted_at = now();
  if p_decision = 'desk_reject' then   -- desk rejects go out at once
    update public.decisions set released_at = now() where submission_id = p_submission;
    update public.submissions set stage = 'rejected', stage_detail = 'Desk rejected', updated_at = now() where id = p_submission;
    update public.review_assignments set status = 'cancelled' where submission_id = p_submission and status in ('invited', 'accepted');
  end if;
  perform private.log(s.venue_id, 'decision.' || p_decision, 'submission', p_submission, jsonb_build_object('reason', p_reason));
end $$;

-- Release all drafted decisions in scope (EM27, F4, I3). Blocked while any paper in scope is undecided.
create or replace function public.release_decisions(p_venue uuid, p_paper_type text default null, p_confirm_large boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_batch uuid;
  v_n int;
begin
  if not private.has_venue_role(p_venue, array['owner', 'chair', 'program_chair']::public.venue_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.submissions s left join public.decisions d on d.submission_id = s.id
             where s.venue_id = p_venue and s.stage in ('submitted', 'review', 'decision') and (p_paper_type is null or s.paper_type = p_paper_type)
               and d.submission_id is null) then
    raise exception 'undecided papers block the release' using errcode = '22023';
  end if;
  select count(*) into v_n from public.decisions d join public.submissions s on s.id = d.submission_id
   where s.venue_id = p_venue and d.released_at is null and (p_paper_type is null or s.paper_type = p_paper_type);
  if v_n > 500 and not coalesce(p_confirm_large, false) then raise exception 'confirm twice to send more than 500 letters (I3)' using errcode = '22023'; end if;
  insert into public.decision_batches (venue_id, scope, paper_type, released_at, released_by, recipients)
  values (p_venue, case when p_paper_type is null then 'all' else 'by_type' end, p_paper_type, now(), private.current_person_id(), v_n)
  returning id into v_batch;
  update public.decisions d set released_at = now(), batch_id = v_batch,
    revision_due_at = case when d.decision = 'conditional' then now() + interval '30 days' end
  from public.submissions s
  where s.id = d.submission_id and s.venue_id = p_venue and d.released_at is null and (p_paper_type is null or s.paper_type = p_paper_type);
  update public.submissions s set
    stage = case d.decision when 'conditional' then 'revise'::public.submission_stage when 'reject' then 'rejected'::public.submission_stage
                            else 'final'::public.submission_stage end,
    stage_detail = case d.decision when 'accept_oral' then 'Accepted · oral' when 'accept_poster' then 'Accepted · poster'
                                   when 'conditional' then 'Conditionally accepted' else 'Not accepted' end,
    updated_at = now()
  from public.decisions d where d.submission_id = s.id and d.batch_id = v_batch;
  update public.review_assignments r set locked_at = now()
  from public.decisions d where d.batch_id = v_batch and r.submission_id = d.submission_id and r.locked_at is null;
  perform private.log(p_venue, 'decision.released', 'venue', p_venue, jsonb_build_object('count', v_n, 'type', p_paper_type));
  return v_n;
end $$;

-- ---------------------------------------------------------------- RPC: organizer tables (EM21, EM25, EM26)
create or replace function public.venue_papers(p_venue uuid)
returns table (submission_id uuid, number integer, title text, paper_type text, topic text, stage text, author_count bigint, countries text[],
               pdf_check text, similarity_pct numeric, handling_ae uuid, ae_name text, reviews_in bigint, reviews_needed smallint,
               reviews_out bigint, overdue bigint, avg_score numeric, spread numeric, ae_rec text, decision text, released boolean,
               coauthors_confirmed bigint)
language sql stable security definer set search_path = '' as $$
  select s.id, s.number, s.title, s.paper_type, coalesce(s.topic, s.track), s.stage::text,
         (select count(*) from public.submission_authors a where a.submission_id = s.id),
         array(select distinct p.country from public.submission_authors a join public.persons p on p.id = a.person_id where a.submission_id = s.id and p.country is not null),
         s.pdf_check::text, s.similarity_pct, s.handling_ae, ae.display_name,
         (select count(*) from public.review_assignments r where r.submission_id = s.id and r.status = 'submitted' and r.round = 1),
         st.min_reviews,
         (select count(*) from public.review_assignments r where r.submission_id = s.id and r.status in ('invited', 'accepted') and r.round = 1),
         (select count(*) from public.review_assignments r where r.submission_id = s.id and r.status = 'accepted' and r.due_at < now()),
         (select round(avg(x.v), 2) from public.review_assignments r join public.reviews w on w.assignment_id = r.id,
            lateral (select avg(value::numeric) v from jsonb_each_text(w.scores)) x where r.submission_id = s.id and r.status = 'submitted'),
         (select max(x.v) - min(x.v) from public.review_assignments r join public.reviews w on w.assignment_id = r.id,
            lateral (select avg(value::numeric) v from jsonb_each_text(w.scores)) x where r.submission_id = s.id and r.status = 'submitted'),
         rec.recommendation, d.decision, d.released_at is not null,
         0::bigint
  from public.submissions s
  join public.venue_settings st on st.venue_id = s.venue_id
  left join public.persons ae on ae.id = s.handling_ae
  left join public.ae_recommendations rec on rec.submission_id = s.id and rec.sent_at is not null
  left join public.decisions d on d.submission_id = s.id
  where s.venue_id = p_venue and s.stage <> 'draft' and private.is_organizer(p_venue)
    and not private.is_submission_author(s.id)             -- B1/B3: own papers are hidden
    and (private.is_venue_chair(p_venue) or s.handling_ae = private.current_person_id())
  order by s.number
$$;

-- AE workload (EM22)
create or replace function public.venue_aes(p_venue uuid)
returns table (person_id uuid, display_name text, institution text, load bigint, cap smallint, topics text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name,
         (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1),
         (select count(*) from public.submissions s where s.venue_id = p_venue and s.handling_ae = p.id and s.stage not in ('withdrawn', 'rejected')),
         coalesce(max(m.load_cap), (select ae_cap from public.venue_settings where venue_id = p_venue)),
         array(select t.topic from public.person_topics t where t.person_id = p.id)
  from public.venue_members m join public.persons p on p.id = m.person_id
  where m.venue_id = p_venue and m.role = 'associate_editor' and private.is_venue_chair(p_venue)
  group by p.id order by p.family_name
$$;

-- ---------------------------------------------------------------- grants
revoke all on function public.assign_ae(uuid, uuid), public.invite_reviewer(uuid, uuid, text, text, timestamptz),
  public.save_review(uuid, jsonb, text, text, text, text, boolean, jsonb, text), public.my_reviews(), public.paper_reviews(uuid),
  public.request_extension(uuid, text, text, text), public.decide_extension(uuid, boolean, timestamptz, text), public.accept_counter_offer(uuid),
  public.post_discussion(uuid, text), public.discussion(uuid), public.place_bid(uuid, text), public.bidding_papers(uuid),
  public.save_recommendation(uuid, text, text, text, boolean), public.set_decision(uuid, text, text, text),
  public.release_decisions(uuid, text, boolean), public.venue_papers(uuid), public.venue_aes(uuid) from public, anon;
grant execute on function public.assign_ae(uuid, uuid), public.invite_reviewer(uuid, uuid, text, text, timestamptz),
  public.save_review(uuid, jsonb, text, text, text, text, boolean, jsonb, text), public.my_reviews(), public.paper_reviews(uuid),
  public.request_extension(uuid, text, text, text), public.decide_extension(uuid, boolean, timestamptz, text), public.accept_counter_offer(uuid),
  public.post_discussion(uuid, text), public.discussion(uuid), public.place_bid(uuid, text), public.bidding_papers(uuid),
  public.save_recommendation(uuid, text, text, text, boolean), public.set_decision(uuid, text, text, text),
  public.release_decisions(uuid, text, boolean), public.venue_papers(uuid), public.venue_aes(uuid) to authenticated;
-- invitation links work without signing in (RV02e): the token is the secret
grant execute on function public.review_invitation(uuid, text), public.respond_review_invitation(uuid, text, boolean, boolean, text, text) to anon, authenticated;
