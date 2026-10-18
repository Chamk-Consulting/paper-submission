-- After submission (SB10–SB15, CA01), registration + program + event day (EM28–EM32, PG01–PG03, CH01),
-- communication (IN01, EM41, announcements), account (ST01–ST04, CL01), contact (CT01) and AI limits (SB05a/t).

-- ---------------------------------------------------------------- versions of a submitted paper (SB10)
create table public.submission_versions (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  version_no     integer not null,
  kind           text not null check (kind in ('initial', 'edit', 'revision', 'final')),
  changed_fields text[] not null default '{}',
  snapshot       jsonb not null default '{}'::jsonb,      -- title, abstract, keywords, authors at that moment
  receipt        text not null,
  coauthors_notified boolean not null default false,
  created_by     uuid references public.persons (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (submission_id, version_no)
);

-- withdraw details (SB11)
alter table public.submissions
  add column if not exists withdraw_reason text check (withdraw_reason in ('error', 'other_venue', 'not_ready', 'disagreement', 'other')),
  add column if not exists withdraw_note   text check (char_length(withdraw_note) <= 2000);

-- co-author confirmation (CA01, D5)
alter table public.submission_authors
  add column if not exists confirmation   text not null default 'pending' check (confirmation in ('pending', 'confirmed', 'declined')),
  add column if not exists responded_at   timestamptz,
  add column if not exists affiliation    text check (char_length(affiliation) <= 200),
  add column if not exists attestations   jsonb not null default '{}'::jsonb;
-- the submitter has confirmed by submitting
update public.submission_authors a set confirmation = 'confirmed', responded_at = s.submitted_at
from public.submissions s where s.id = a.submission_id and a.person_id = s.created_by and s.submitted_at is not null;

-- ---------------------------------------------------------------- rebuttal + revision (SB14, SB15)
create table public.author_responses (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  kind           text not null check (kind in ('rebuttal', 'revision')),
  round          smallint not null default 1,
  assignment_id  uuid references public.review_assignments (id) on delete cascade,
  comment_no     smallint,
  quote          text check (char_length(quote) <= 4000),
  response       text not null default '' check (char_length(response) <= 6000),
  changed_in     text check (char_length(changed_in) <= 200),
  updated_at     timestamptz not null default now(),
  check (kind <> 'rebuttal' or char_length(response) <= 2000)
);
create unique index author_responses_uq on public.author_responses (submission_id, kind, round, coalesce(assignment_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(comment_no, 0));

create table public.revisions (
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  round          smallint not null default 1,
  status         text not null default 'draft' check (status in ('draft', 'submitted', 'in_check', 'decided')),
  change_summary jsonb not null default '[]'::jsonb,
  receipt        text,
  submitted_at   timestamptz,
  primary key (submission_id, round)
);

-- ---------------------------------------------------------------- final version (SB12, EM28, G1–G7)
create table public.final_versions (
  submission_id      uuid primary key references public.submissions (id) on delete cascade,
  final_title        text check (char_length(final_title) <= 300),
  title_locked_at    timestamptz,
  locked_by          uuid references public.persons (id) on delete set null,
  copyright_type     text check (copyright_type in ('ieee', 'open_access', 'us_gov', 'crown')),
  copyright_status   text not null default 'not_started' check (copyright_status in ('not_started', 'waiting', 'signed')),
  copyright_signer   text check (char_length(copyright_signer) <= 200),
  copyright_signed_at timestamptz,
  ecf_reference      text check (char_length(ecf_reference) <= 80),
  presenter_id       uuid references public.persons (id) on delete set null,
  remote_requested   boolean not null default false,
  remote_approved    boolean,
  extra_pages        smallint not null default 0,
  extra_paid         boolean not null default false,
  attest_comments    boolean not null default false,
  attest_noshow      boolean not null default false,
  status             text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'complete', 'incomplete', 'dropped')),
  receipt            text,
  submitted_at       timestamptz,
  dropped_by         uuid references public.persons (id) on delete set null,
  dropped_at         timestamptz,
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------- registrations (EM10, EM31, SB12d)
create table public.registrations (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,
  person_id     uuid references public.persons (id) on delete set null,
  number        text not null check (char_length(number) between 1 and 40),
  reg_type      text not null check (char_length(reg_type) <= 80),
  full_name     text check (char_length(full_name) <= 200),
  email         extensions.citext,
  affiliation   text check (char_length(affiliation) <= 200),
  covers_papers smallint not null default 2 check (covers_papers between 0 and 4),
  paid_at       timestamptz,
  checked_in_at timestamptz,
  badges        smallint not null default 0,
  source        text not null default 'manual' check (source in ('manual', 'import', 'desk')),
  created_at    timestamptz not null default now(),
  unique (venue_id, number)
);
create table public.registration_papers (
  registration_id uuid not null references public.registrations (id) on delete cascade,
  submission_id   uuid not null references public.submissions (id) on delete cascade,
  primary key (registration_id, submission_id)
);

-- ---------------------------------------------------------------- program (EM29, EM31, PG01–PG03, CH01)
create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues (id) on delete cascade,
  code             text not null check (char_length(code) between 1 and 20),
  title            text not null check (char_length(title) between 1 and 200),
  kind             text not null default 'oral' check (kind in ('keynote', 'oral', 'poster', 'workshop', 'break')),
  room_id          uuid references public.rooms (id) on delete set null,
  previous_room_id uuid references public.rooms (id) on delete set null,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  chair_id         uuid references public.persons (id) on delete set null,
  cochair_id       uuid references public.persons (id) on delete set null,
  live_status      text not null default 'scheduled' check (live_status in ('scheduled', 'on_time', 'late', 'break', 'open', 'done')),
  delay_min        smallint not null default 0,
  live_note        text check (char_length(live_note) <= 300),
  created_at       timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (venue_id, code)
);
create index sessions_venue_idx on public.sessions (venue_id, starts_at);

create table public.session_talks (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions (id) on delete cascade,
  submission_id   uuid references public.submissions (id) on delete set null,
  title           text check (char_length(title) <= 300),         -- keynotes without a paper
  position        smallint not null default 1,
  starts_at       timestamptz,
  talk_min        smallint not null default 15,
  qa_min          smallint not null default 5,
  presenter_id    uuid references public.persons (id) on delete set null,
  is_remote       boolean not null default false,
  slides_path     text,
  presenter_bio   text check (char_length(presenter_bio) <= 1000),
  attendance      text not null default 'waiting' check (attendance in ('waiting', 'checked_in', 'speaking', 'presented', 'no_show')),
  noshow_note     text check (char_length(noshow_note) <= 1000),
  noshow_reported_by uuid references public.persons (id) on delete set null,
  noshow_decision text check (noshow_decision in ('keep', 'leave_out'))
);
create unique index session_talks_sub_uq on public.session_talks (submission_id) where submission_id is not null;

create table public.program_publications (
  id           bigint generated always as identity primary key,
  venue_id     uuid not null references public.venues (id) on delete cascade,
  published_at timestamptz not null default now(),
  published_by uuid references public.persons (id) on delete set null
);

create table public.schedule_items (
  person_id  uuid not null references public.persons (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (person_id, session_id)
);

create table public.announcements (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,
  title         text not null check (char_length(title) between 2 and 200),
  body          text not null check (char_length(body) between 2 and 5000),
  channels      text[] not null default '{inbox}',
  author_role   text check (char_length(author_role) <= 60),
  affected      integer not null default 0,
  created_by    uuid references public.persons (id) on delete set null,
  published_at  timestamptz not null default now()
);

create table public.proceedings_exports (
  venue_id     uuid primary key references public.venues (id) on delete cascade,
  steps        jsonb not null default '{}'::jsonb,
  exported_at  timestamptz,
  receipt_at   timestamptz
);

-- ---------------------------------------------------------------- inbox (IN01) + bulk email (EM41)
create table public.inbox_threads (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid references public.venues (id) on delete cascade,
  submission_id  uuid references public.submissions (id) on delete cascade,
  kind           text not null check (kind in ('decision', 'invite', 'coauthor', 'venue', 'system', 'message', 'support')),
  subject        text not null check (char_length(subject) between 1 and 300),
  reply_allowed  boolean not null default true,
  created_at     timestamptz not null default now()
);
create table public.inbox_messages (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references public.inbox_threads (id) on delete cascade,
  sender_id     uuid references public.persons (id) on delete set null,
  sender_label  text check (char_length(sender_label) <= 120),
  body          text not null check (char_length(body) between 1 and 20000),
  cta_label     text check (char_length(cta_label) <= 60),
  cta_url       text check (cta_url is null or cta_url ~ '^/'),
  created_at    timestamptz not null default now()
);
create index inbox_messages_thread_idx on public.inbox_messages (thread_id, created_at);
create table public.inbox_participants (
  thread_id    uuid not null references public.inbox_threads (id) on delete cascade,
  person_id    uuid not null references public.persons (id) on delete cascade,
  read_at      timestamptz,
  archived_at  timestamptz,
  primary key (thread_id, person_id)
);
create index inbox_participants_person_idx on public.inbox_participants (person_id);

create table public.email_campaigns (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid not null references public.venues (id) on delete cascade,
  roles          text[] not null default '{}',
  conditions     text[] not null default '{}',
  subject        text not null check (char_length(subject) between 3 and 200),
  body           text not null check (char_length(body) between 10 and 20000),
  status         text not null default 'draft' check (status in ('draft', 'scheduled', 'sent')),
  scheduled_at   timestamptz,
  test_sent_at   timestamptz,
  recipients     integer not null default 0,
  delivered      integer not null default 0,
  bounced        integer not null default 0,
  confirmed_twice boolean not null default false,
  sent_by        uuid references public.persons (id) on delete set null,
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);
create table public.email_unsubscribes (
  person_id  uuid not null references public.persons (id) on delete cascade,
  venue_id   uuid references public.venues (id) on delete cascade,
  category   text not null check (category in ('review_invitations', 'announcements', 'all_optional')),
  created_at timestamptz not null default now()
);
create unique index email_unsubscribes_uq on public.email_unsubscribes (person_id, coalesce(venue_id, '00000000-0000-0000-0000-000000000000'::uuid), category);

-- ---------------------------------------------------------------- account (ST03, ST04, CL01)
create table public.notification_prefs (
  person_id  uuid primary key references public.persons (id) on delete cascade,
  modes      jsonb not null default '{"review_invitation":"now","review_due":"now","coauthor_request":"now","coauthor_changes":"digest","venue_announcements":"digest","messages":"now","new_calls":"digest"}'::jsonb,
  reminders  jsonb not null default '{"d7":true,"d3":true,"h24":true}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.calendar_feeds (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.persons (id) on delete cascade,
  token_hash  text not null unique check (char_length(token_hash) = 64),
  flags       jsonb not null default '{"submissions":true,"reviews":true,"sessions":true,"followed":false}'::jsonb,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create table public.consents (
  person_id   uuid not null references public.persons (id) on delete cascade,
  kind        text not null check (kind in ('processing', 'share_with_venues', 'product_news')),
  granted     boolean not null,
  recorded_at timestamptz not null default now(),
  primary key (person_id, kind)
);
create table public.data_requests (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.persons (id) on delete cascade,
  kind          text not null check (kind in ('export', 'delete', 'merge', 'import')),
  status        text not null default 'requested' check (status in ('requested', 'preparing', 'ready', 'done', 'blocked', 'cancelled')),
  detail        jsonb not null default '{}'::jsonb,
  file_path     text,
  scheduled_for timestamptz,
  blocked_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create table public.sign_in_events (
  id          bigint generated always as identity primary key,
  person_id   uuid references public.persons (id) on delete cascade,
  method      text not null check (char_length(method) <= 30),
  place       text check (char_length(place) <= 120),
  user_agent  text check (char_length(user_agent) <= 300),
  result      text not null default 'ok' check (char_length(result) <= 120),
  at          timestamptz not null default now()
);
create index sign_in_events_person_idx on public.sign_in_events (person_id, at desc);

-- ---------------------------------------------------------------- AI helpers (SB05a/t, RV05) + contact (CT01) + maintenance (ER01)
create table public.ai_requests (
  id            bigint generated always as identity primary key,
  person_id     uuid not null references public.persons (id) on delete cascade,
  submission_id uuid references public.submissions (id) on delete cascade,
  kind          text not null check (kind in ('summary', 'translate', 'ask')),
  at            timestamptz not null default now()
);
create index ai_requests_person_idx on public.ai_requests (person_id, at desc);

create table public.contact_messages (
  id           uuid primary key default gen_random_uuid(),
  reference    text not null unique,
  kind         text not null check (kind in ('support', 'sales')),
  topic        text check (char_length(topic) <= 40),
  name         text check (char_length(name) <= 200),
  email        extensions.citext not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  person_id    uuid references public.persons (id) on delete set null,
  subject      text check (char_length(subject) <= 200),
  body         text not null check (char_length(body) between 10 and 4000),
  details      jsonb not null default '{}'::jsonb,
  allow_access boolean not null default false,
  status       text not null default 'new' check (status in ('new', 'open', 'closed')),
  created_at   timestamptz not null default now()
);
create index contact_messages_email_idx on public.contact_messages (email, created_at desc);

create table public.maintenance_windows (
  id             bigint generated always as identity primary key,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  message        text check (char_length(message) <= 500),
  shift_minutes  smallint not null default 120
);

-- ---------------------------------------------------------------- RLS
alter table public.submission_versions  enable row level security;
alter table public.author_responses     enable row level security;
alter table public.revisions            enable row level security;
alter table public.final_versions       enable row level security;
alter table public.registrations        enable row level security;
alter table public.registration_papers  enable row level security;
alter table public.sessions             enable row level security;
alter table public.session_talks        enable row level security;
alter table public.program_publications enable row level security;
alter table public.schedule_items       enable row level security;
alter table public.announcements        enable row level security;
alter table public.proceedings_exports  enable row level security;
alter table public.inbox_threads        enable row level security;
alter table public.inbox_messages       enable row level security;
alter table public.inbox_participants   enable row level security;
alter table public.email_campaigns      enable row level security;
alter table public.email_unsubscribes   enable row level security;
alter table public.notification_prefs   enable row level security;
alter table public.calendar_feeds       enable row level security;
alter table public.consents             enable row level security;
alter table public.data_requests        enable row level security;
alter table public.sign_in_events       enable row level security;
alter table public.ai_requests          enable row level security;
alter table public.contact_messages     enable row level security;
alter table public.maintenance_windows  enable row level security;
revoke all on public.submission_versions, public.author_responses, public.revisions, public.final_versions, public.registrations,
  public.registration_papers, public.schedule_items, public.proceedings_exports, public.inbox_threads, public.inbox_messages,
  public.inbox_participants, public.email_campaigns, public.email_unsubscribes, public.notification_prefs, public.calendar_feeds,
  public.consents, public.data_requests, public.sign_in_events, public.ai_requests, public.contact_messages from anon;
revoke insert, update, delete on public.sessions, public.session_talks, public.program_publications, public.announcements, public.maintenance_windows from anon;

create policy versions_select on public.submission_versions for select to authenticated
  using ((select private.is_submission_author(submission_id)) or (select private.manages_paper(submission_id)));
revoke insert, update, delete on public.submission_versions from authenticated;

create policy author_responses_select on public.author_responses for select to authenticated
  using ((select private.is_submission_author(submission_id)) or (select private.manages_paper(submission_id))
         or (assignment_id is not null and exists (select 1 from public.review_assignments r where r.id = assignment_id and r.reviewer_id = (select private.current_person_id())))
         or (kind = 'revision' and (select private.is_reviewer_of(submission_id))));
revoke insert, update, delete on public.author_responses from authenticated;

create policy revisions_select on public.revisions for select to authenticated
  using ((select private.is_submission_author(submission_id)) or (select private.manages_paper(submission_id)) or (select private.is_reviewer_of(submission_id)));
revoke insert, update, delete on public.revisions from authenticated;

create policy final_versions_select on public.final_versions for select to authenticated
  using ((select private.is_submission_author(submission_id))
         or exists (select 1 from public.submissions s where s.id = submission_id and (select private.is_organizer(s.venue_id))));
revoke insert, update, delete on public.final_versions from authenticated;

create policy registrations_select on public.registrations for select to authenticated
  using (person_id = (select private.current_person_id()) or (select private.is_organizer(venue_id)));
create policy registrations_write on public.registrations for all to authenticated
  using ((select private.has_venue_role(venue_id, array['owner', 'chair', 'registration_chair', 'staff']::public.venue_role[])))
  with check ((select private.has_venue_role(venue_id, array['owner', 'chair', 'registration_chair', 'staff']::public.venue_role[])));
create policy registration_papers_select on public.registration_papers for select to authenticated
  using ((select private.is_submission_author(submission_id))
         or exists (select 1 from public.registrations r where r.id = registration_id and (select private.is_organizer(r.venue_id))));
create policy registration_papers_write on public.registration_papers for all to authenticated
  using (exists (select 1 from public.registrations r where r.id = registration_id and (select private.has_venue_role(r.venue_id, array['owner', 'chair', 'registration_chair']::public.venue_role[]))))
  with check (exists (select 1 from public.registrations r where r.id = registration_id and (select private.has_venue_role(r.venue_id, array['owner', 'chair', 'registration_chair']::public.venue_role[]))));

-- program is public once published; organizers see drafts and edit
create or replace function private.program_published(p_venue uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.program_publications p where p.venue_id = p_venue)
$$;
grant execute on function private.program_published(uuid) to anon, authenticated;
create policy sessions_select on public.sessions for select to anon, authenticated
  using ((select private.program_published(venue_id)) or (select private.is_organizer(venue_id)));
create policy sessions_write on public.sessions for all to authenticated
  using ((select private.is_venue_chair(venue_id))) with check ((select private.is_venue_chair(venue_id)));
create policy talks_select on public.session_talks for select to anon, authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and ((select private.program_published(s.venue_id)) or (select private.is_organizer(s.venue_id)))));
create policy talks_write on public.session_talks for all to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and (select private.is_venue_chair(s.venue_id))))
  with check (exists (select 1 from public.sessions s where s.id = session_id and (select private.is_venue_chair(s.venue_id))));
create policy program_publications_select on public.program_publications for select to anon, authenticated using (true);
revoke insert, update, delete on public.program_publications from authenticated;

create policy schedule_own on public.schedule_items for all to authenticated
  using (person_id = (select private.current_person_id())) with check (person_id = (select private.current_person_id()));

create policy announcements_select on public.announcements for select to anon, authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.is_published) or (select private.is_organizer(venue_id)));
create policy announcements_write on public.announcements for all to authenticated
  using ((select private.is_organizer(venue_id))) with check ((select private.is_organizer(venue_id)));

create policy proceedings_select on public.proceedings_exports for select to authenticated using ((select private.is_organizer(venue_id)));
create policy proceedings_write on public.proceedings_exports for all to authenticated
  using ((select private.has_venue_role(venue_id, array['owner', 'chair', 'program_chair', 'publication_chair']::public.venue_role[])))
  with check ((select private.has_venue_role(venue_id, array['owner', 'chair', 'program_chair', 'publication_chair']::public.venue_role[])));

create or replace function private.in_thread(p_thread uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.inbox_participants p where p.thread_id = p_thread and p.person_id = (select private.current_person_id()))
$$;
grant execute on function private.in_thread(uuid) to authenticated;
create policy inbox_threads_select on public.inbox_threads for select to authenticated using ((select private.in_thread(id)));
create policy inbox_messages_select on public.inbox_messages for select to authenticated using ((select private.in_thread(thread_id)));
create policy inbox_participants_select on public.inbox_participants for select to authenticated using (person_id = (select private.current_person_id()));
create policy inbox_participants_update on public.inbox_participants for update to authenticated
  using (person_id = (select private.current_person_id())) with check (person_id = (select private.current_person_id()));
revoke insert, update, delete on public.inbox_threads, public.inbox_messages from authenticated;
revoke insert, delete on public.inbox_participants from authenticated;
revoke update on public.inbox_participants from authenticated;
grant update (read_at, archived_at) on public.inbox_participants to authenticated;

create policy campaigns_select on public.email_campaigns for select to authenticated using ((select private.is_venue_chair(venue_id)));
create policy campaigns_write on public.email_campaigns for all to authenticated
  using ((select private.is_venue_chair(venue_id))) with check ((select private.is_venue_chair(venue_id)));
create policy unsubscribes_own on public.email_unsubscribes for all to authenticated
  using (person_id = (select private.current_person_id())) with check (person_id = (select private.current_person_id()));

create policy notification_prefs_own on public.notification_prefs for all to authenticated
  using (person_id = (select private.current_person_id())) with check (person_id = (select private.current_person_id()));
create policy calendar_feeds_own on public.calendar_feeds for select to authenticated using (person_id = (select private.current_person_id()));
revoke insert, update, delete on public.calendar_feeds from authenticated;
create policy consents_own on public.consents for all to authenticated
  using (person_id = (select private.current_person_id())) with check (person_id = (select private.current_person_id()) and kind <> 'processing');
create policy data_requests_own on public.data_requests for select to authenticated using (person_id = (select private.current_person_id()));
revoke insert, update, delete on public.data_requests from authenticated;
create policy sign_in_events_own on public.sign_in_events for select to authenticated using (person_id = (select private.current_person_id()));
revoke insert, update, delete on public.sign_in_events from authenticated;
create policy ai_requests_own on public.ai_requests for select to authenticated using (person_id = (select private.current_person_id()));
revoke insert, update, delete on public.ai_requests from authenticated;
revoke all on public.contact_messages from authenticated;
create policy maintenance_select on public.maintenance_windows for select to anon, authenticated using (true);

-- ---------------------------------------------------------------- storage: follow-up uploads (revision, final, slides)
create or replace function private.can_upload_followup(p_submission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.submissions s where s.id = p_submission and private.is_submission_author(s.id)
                 and s.stage in ('revise', 'final', 'done'))
$$;
grant execute on function private.can_upload_followup(uuid) to authenticated;
drop policy if exists papers_insert on storage.objects;
create policy papers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'papers' and (
    (select private.can_edit_submission(((storage.foldername(name))[1])::uuid))
    or (select private.can_upload_followup(((storage.foldername(name))[1])::uuid))));

-- ---------------------------------------------------------------- helpers
create or replace function private.receipt(p_submission uuid, p_kind text)
returns text language sql volatile set search_path = '' as $$
  select 'PLN-' || lpad(coalesce((select number::text from public.submissions where id = p_submission), '0'), 4, '0') || '-' || p_kind || '-'
         || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
$$;

-- deliver an inbox message to people (used by flows below and by the app with the service role)
create or replace function private.notify(p_people uuid[], p_kind text, p_subject text, p_body text, p_venue uuid default null,
                                         p_submission uuid default null, p_cta_label text default null, p_cta_url text default null,
                                         p_sender_label text default null, p_reply boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_thread uuid;
begin
  if p_people is null or cardinality(p_people) = 0 then return null; end if;
  insert into public.inbox_threads (venue_id, submission_id, kind, subject, reply_allowed)
  values (p_venue, p_submission, p_kind, left(p_subject, 300), p_reply) returning id into v_thread;
  insert into public.inbox_messages (thread_id, sender_id, sender_label, body, cta_label, cta_url)
  values (v_thread, case when p_reply then private.current_person_id() end, coalesce(p_sender_label, 'Plenary'), p_body, p_cta_label, p_cta_url);
  insert into public.inbox_participants (thread_id, person_id) select v_thread, x from unnest(p_people) x where x is not null on conflict do nothing;
  return v_thread;
end $$;

-- ---------------------------------------------------------------- RPC: edit a submitted paper (SB10)
create or replace function public.record_edit(p_submission uuid, p_changed text[], p_agree boolean, p_notify boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  v_no int;
  v_receipt text;
begin
  select * into s from public.submissions where id = p_submission;
  if s.id is null or s.stage <> 'submitted' or not private.can_edit_submission(p_submission) then raise exception 'cannot edit this paper now' using errcode = '42501'; end if;
  if not coalesce(p_agree, false) then raise exception 'confirm that all co-authors agree' using errcode = '22023'; end if;
  select coalesce(max(version_no), 1) + 1 into v_no from public.submission_versions where submission_id = p_submission;
  v_receipt := private.receipt(p_submission, 'V' || v_no);
  insert into public.submission_versions (submission_id, version_no, kind, changed_fields, snapshot, receipt, coauthors_notified, created_by)
  values (p_submission, v_no, 'edit', coalesce(p_changed, '{}'),
          jsonb_build_object('title', s.title, 'abstract', s.abstract, 'keywords', s.keywords), v_receipt, coalesce(p_notify, false), private.current_person_id());
  update public.submissions set updated_at = now() where id = p_submission;
  perform private.log(s.venue_id, 'submission.edited', 'submission', p_submission, jsonb_build_object('version', v_no, 'changed', p_changed));
  return v_receipt;
end $$;

-- ---------------------------------------------------------------- RPC: withdraw with reason (SB11)
create or replace function public.withdraw_paper(p_submission uuid, p_reason text, p_note text, p_typed_number text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  v_receipt text;
  v_cancelled int;
begin
  select * into s from public.submissions where id = p_submission for update;
  if s.id is null or s.stage in ('withdrawn', 'done', 'rejected', 'draft') or not private.is_submission_author(p_submission) then
    raise exception 'cannot withdraw this paper' using errcode = '42501';
  end if;
  if p_typed_number is distinct from ('#' || lpad(s.number::text, 4, '0')) and p_typed_number is distinct from s.number::text
     and p_typed_number is distinct from lpad(s.number::text, 4, '0') then
    raise exception 'type the paper number to confirm' using errcode = '22023';
  end if;
  update public.submissions set stage = 'withdrawn', withdrawn_at = now(), withdraw_reason = coalesce(p_reason, 'other'),
    withdraw_note = nullif(btrim(coalesce(p_note, '')), ''), stage_detail = 'Withdrawn by the authors', updated_at = now()
  where id = p_submission;
  update public.review_assignments set status = 'cancelled' where submission_id = p_submission and status in ('invited', 'accepted');
  get diagnostics v_cancelled = row_count;
  v_receipt := private.receipt(p_submission, 'WD');
  perform private.log(s.venue_id, 'submission.withdrawn', 'submission', p_submission,
    jsonb_build_object('reason', p_reason, 'reviews_cancelled', v_cancelled, 'receipt', v_receipt));
  return v_receipt;
end $$;

-- ---------------------------------------------------------------- RPC: co-author confirmation (CA01)
create or replace function public.confirm_coauthorship(p_submission uuid, p_accept boolean, p_affiliation text, p_attest jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  s public.submissions;
begin
  select * into s from public.submissions where id = p_submission;
  if not exists (select 1 from public.submission_authors where submission_id = p_submission and person_id = v_me) then
    raise exception 'you are not listed on this paper' using errcode = '42501';
  end if;
  if p_accept and not (coalesce((p_attest ->> 'contributed')::boolean, false) and coalesce((p_attest ->> 'read')::boolean, false)
                       and coalesce((p_attest ->> 'conflicts')::boolean, false)) then
    raise exception 'tick all three statements' using errcode = '22023';
  end if;
  update public.submission_authors set confirmation = case when p_accept then 'confirmed' else 'declined' end, responded_at = now(),
    affiliation = coalesce(nullif(btrim(coalesce(p_affiliation, '')), ''), affiliation), attestations = coalesce(p_attest, '{}')
  where submission_id = p_submission and person_id = v_me;
  perform private.notify(array(select a.person_id from public.submission_authors a where a.submission_id = p_submission and a.is_corresponding),
    'coauthor', case when p_accept then 'Co-author confirmed #' else 'Co-author declined #' end || lpad(coalesce(s.number, 0)::text, 4, '0'),
    (select display_name from public.persons where id = v_me) || case when p_accept then ' confirmed being an author of “' else ' says they are not an author of “' end || s.title || '”.',
    s.venue_id, p_submission, 'Open paper', '/submissions/' || p_submission);
  perform private.log(s.venue_id, case when p_accept then 'coauthor.confirmed' else 'coauthor.declined' end, 'submission', p_submission);
  return case when p_accept then 'confirmed' else 'declined' end;
end $$;

-- ---------------------------------------------------------------- RPC: rebuttal (SB15)
create or replace function public.save_rebuttal(p_submission uuid, p_responses jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  r jsonb;
  n int := 0;
begin
  select * into s from public.submissions where id = p_submission;
  if s.id is null or not private.is_submission_author(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.venue_settings st where st.venue_id = s.venue_id and st.rebuttal)
     or not exists (select 1 from public.venue_dates d where d.venue_id = s.venue_id and d.key = 'rebuttal_close' and d.starts_at > now()) then
    raise exception 'the rebuttal window is closed' using errcode = '22023';
  end if;
  for r in select * from jsonb_array_elements(coalesce(p_responses, '[]'::jsonb)) loop
    if char_length(coalesce(r ->> 'response', '')) > 2000 then raise exception 'a response is over 2,000 characters' using errcode = '22023'; end if;
    if not exists (select 1 from public.review_assignments x where x.id = (r ->> 'assignment_id')::uuid and x.submission_id = p_submission and x.status = 'submitted') then
      raise exception 'unknown review' using errcode = '22023';
    end if;
    insert into public.author_responses (submission_id, kind, assignment_id, response)
    values (p_submission, 'rebuttal', (r ->> 'assignment_id')::uuid, coalesce(r ->> 'response', ''))
    on conflict (submission_id, kind, round, coalesce(assignment_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(comment_no, 0))
    do update set response = excluded.response, updated_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- RPC: revision (SB14)
create or replace function public.save_revision(p_submission uuid, p_responses jsonb, p_summary jsonb, p_submit boolean, p_agree boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  r jsonb;
  v_round smallint;
  v_receipt text;
begin
  select * into s from public.submissions where id = p_submission for update;
  if s.id is null or s.stage <> 'revise' or not private.is_submission_author(p_submission) then raise exception 'no revision is open' using errcode = '42501'; end if;
  select coalesce(max(round), 1) into v_round from public.revisions where submission_id = p_submission and status = 'draft';
  insert into public.revisions (submission_id, round) values (p_submission, v_round) on conflict do nothing;
  for r in select * from jsonb_array_elements(coalesce(p_responses, '[]'::jsonb)) loop
    insert into public.author_responses (submission_id, kind, round, assignment_id, comment_no, quote, response, changed_in)
    values (p_submission, 'revision', v_round, nullif(r ->> 'assignment_id', '')::uuid, coalesce((r ->> 'comment_no')::smallint, 1),
            r ->> 'quote', coalesce(r ->> 'response', ''), nullif(r ->> 'changed_in', ''))
    on conflict (submission_id, kind, round, coalesce(assignment_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(comment_no, 0))
    do update set response = excluded.response, changed_in = excluded.changed_in, quote = excluded.quote, updated_at = now();
  end loop;
  update public.revisions set change_summary = coalesce(p_summary, change_summary) where submission_id = p_submission and round = v_round;
  if coalesce(p_submit, false) then
    if not coalesce(p_agree, false) then raise exception 'confirm that all co-authors agree' using errcode = '22023'; end if;
    if exists (select 1 from public.author_responses a where a.submission_id = p_submission and a.kind = 'revision' and a.round = v_round
               and char_length(btrim(a.response)) <= 5) then
      raise exception 'answer every comment' using errcode = '22023';
    end if;
    if not exists (select 1 from public.submission_files f where f.submission_id = p_submission and f.role = 'revision' and f.is_current) then
      raise exception 'upload the revised paper' using errcode = '22023';
    end if;
    v_receipt := private.receipt(p_submission, 'REV');
    update public.revisions set status = 'in_check', receipt = v_receipt, submitted_at = now() where submission_id = p_submission and round = v_round;
    update public.submissions set stage_detail = 'Revision in check', updated_at = now() where id = p_submission;
    perform private.log(s.venue_id, 'revision.submitted', 'submission', p_submission, jsonb_build_object('round', v_round, 'receipt', v_receipt));
    return v_receipt;
  end if;
  return 'saved';
end $$;

-- follow-up files (revision, highlighted, final, slides, supplementary)
create or replace function public.record_followup_file(p_submission uuid, p_role public.submission_file_role, p_path text, p_name text,
                                                       p_size bigint, p_mime text, p_pages integer, p_check jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_ver int;
begin
  if not private.can_upload_followup(p_submission) or p_role not in ('revision', 'highlighted', 'final', 'slides', 'supplementary') then
    raise exception 'cannot upload this file now' using errcode = '42501';
  end if;
  if split_part(p_path, '/', 1) <> p_submission::text then raise exception 'bad path' using errcode = '22023'; end if;
  select coalesce(max(version), 0) + 1 into v_ver from public.submission_files where submission_id = p_submission and role = p_role;
  update public.submission_files set is_current = false where submission_id = p_submission and role = p_role;
  insert into public.submission_files (submission_id, role, storage_path, file_name, size_bytes, mime_type, pages, check_result, version, is_current, uploaded_by)
  values (p_submission, p_role, p_path, p_name, p_size, p_mime, p_pages, coalesce(p_check, '{}'), v_ver, true, private.current_person_id())
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------- RPC: final version steps (SB12)
create or replace function public.save_final(p_submission uuid, p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  f public.final_versions;
  v_receipt text;
begin
  select * into s from public.submissions where id = p_submission;
  if s.id is null or s.stage not in ('final', 'done') or not private.is_submission_author(p_submission) then raise exception 'final version not open' using errcode = '42501'; end if;
  insert into public.final_versions (submission_id, final_title) values (p_submission, s.title) on conflict do nothing;
  select * into f from public.final_versions where submission_id = p_submission for update;
  if f.status in ('submitted', 'complete') and coalesce(p ->> 'step', '') <> 'presenter' then raise exception 'already submitted — ask the publication chair' using errcode = '22023'; end if;

  if p ->> 'step' = 'title' then
    if f.title_locked_at is not null then raise exception 'title and authors are locked' using errcode = '22023'; end if;
    update public.final_versions set final_title = coalesce(nullif(btrim(p ->> 'title'), ''), final_title),
      title_locked_at = case when (p ->> 'lock')::boolean then now() end,
      locked_by = case when (p ->> 'lock')::boolean then private.current_person_id() end, updated_at = now()
    where submission_id = p_submission;
  elsif p ->> 'step' = 'copyright' then
    if f.title_locked_at is null then raise exception 'lock the title and authors first (G2)' using errcode = '22023'; end if;
    update public.final_versions set copyright_type = coalesce(p ->> 'type', copyright_type),
      copyright_status = case when p ->> 'type' in ('us_gov', 'crown') then 'signed' when (p ->> 'started')::boolean then 'waiting' else copyright_status end,
      copyright_signer = case when p ->> 'type' in ('us_gov', 'crown') then (select display_name from public.persons where id = private.current_person_id()) else copyright_signer end,
      copyright_signed_at = case when p ->> 'type' in ('us_gov', 'crown') then now() else copyright_signed_at end,
      updated_at = now()
    where submission_id = p_submission;
  elsif p ->> 'step' = 'presenter' then
    if not exists (select 1 from public.submission_authors a where a.submission_id = p_submission and a.person_id = (p ->> 'presenter')::uuid) then
      raise exception 'the presenter must be an author' using errcode = '22023';
    end if;
    update public.final_versions set presenter_id = (p ->> 'presenter')::uuid, remote_requested = coalesce((p ->> 'remote')::boolean, false), updated_at = now()
    where submission_id = p_submission;
  elsif p ->> 'step' = 'submit' then
    if not (coalesce((p ->> 'attest_comments')::boolean, false) and coalesce((p ->> 'attest_noshow')::boolean, false)) then
      raise exception 'tick both statements' using errcode = '22023';
    end if;
    if not exists (select 1 from public.submission_files x where x.submission_id = p_submission and x.role = 'final' and x.is_current) then
      raise exception 'upload the final PDF' using errcode = '22023';
    end if;
    if f.title_locked_at is null then raise exception 'lock the title and authors' using errcode = '22023'; end if;
    v_receipt := private.receipt(p_submission, 'FIN');
    update public.final_versions set attest_comments = true, attest_noshow = true, submitted_at = now(), receipt = v_receipt,
      status = case when copyright_status = 'signed' and exists (select 1 from public.registration_papers rp where rp.submission_id = p_submission)
                    then 'complete' else 'submitted' end, updated_at = now()
    where submission_id = p_submission;
    perform private.log(s.venue_id, 'final.submitted', 'submission', p_submission, jsonb_build_object('receipt', v_receipt));
    return v_receipt;
  else
    raise exception 'unknown step' using errcode = '22023';
  end if;
  return 'saved';
end $$;

-- organizers confirm copyright (from IEEE) or drop a paper after the deadline (G3, G6)
create or replace function public.final_admin(p_submission uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_venue uuid;
begin
  select venue_id into v_venue from public.submissions where id = p_submission;
  if not private.has_venue_role(v_venue, array['owner', 'chair', 'program_chair', 'publication_chair']::public.venue_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.final_versions (submission_id) values (p_submission) on conflict do nothing;
  if p_action = 'copyright_signed' then
    update public.final_versions set copyright_status = 'signed', copyright_signed_at = coalesce(copyright_signed_at, now()) where submission_id = p_submission;
  elsif p_action = 'drop' then
    update public.final_versions set status = 'dropped', dropped_by = private.current_person_id(), dropped_at = now() where submission_id = p_submission;
  elsif p_action = 'undrop' then
    update public.final_versions set status = 'incomplete', dropped_by = null, dropped_at = null where submission_id = p_submission;
  elsif p_action = 'unlock' then
    update public.final_versions set title_locked_at = null, status = 'in_progress' where submission_id = p_submission;
  else raise exception 'unknown action' using errcode = '22023';
  end if;
  perform private.log(v_venue, 'final.' || p_action, 'submission', p_submission);
end $$;

-- ---------------------------------------------------------------- RPC: program (EM29, PG01–PG03, CH01, EM31)
create or replace function public.program_clashes(p_venue uuid)
returns table (kind text, person_id uuid, person text, session_a text, session_b text)
language sql stable security definer set search_path = '' as $$
  select 'presenter', t1.presenter_id, p.display_name, s1.code, s2.code
  from public.session_talks t1 join public.sessions s1 on s1.id = t1.session_id
  join public.session_talks t2 on t2.presenter_id = t1.presenter_id and t2.id > t1.id
  join public.sessions s2 on s2.id = t2.session_id and s2.venue_id = s1.venue_id and s2.id <> s1.id
   and tstzrange(s1.starts_at, s1.ends_at) && tstzrange(s2.starts_at, s2.ends_at)
  join public.persons p on p.id = t1.presenter_id
  where s1.venue_id = p_venue and private.is_organizer(p_venue)
  union all
  select 'chair', s1.chair_id, p.display_name, s1.code, s2.code
  from public.sessions s1 join public.sessions s2 on s2.venue_id = s1.venue_id and s2.id > s1.id and s2.chair_id = s1.chair_id
   and tstzrange(s1.starts_at, s1.ends_at) && tstzrange(s2.starts_at, s2.ends_at)
  join public.persons p on p.id = s1.chair_id
  where s1.venue_id = p_venue and s1.chair_id is not null and private.is_organizer(p_venue)
$$;

create or replace function public.publish_program(p_venue uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_venue_chair(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  if exists (select 1 from public.program_clashes(p_venue) c where c.kind = 'presenter') then
    raise exception 'a presenter is in two rooms at once (H2)' using errcode = '22023';
  end if;
  insert into public.program_publications (venue_id, published_by) values (p_venue, private.current_person_id());
  update public.venues set status = case when status in ('open', 'reviewing', 'decisions', 'finals') then 'program' else status end where id = p_venue;
  select count(distinct t.presenter_id) into n from public.session_talks t join public.sessions s on s.id = t.session_id where s.venue_id = p_venue;
  perform private.notify(array(select distinct t.presenter_id from public.session_talks t join public.sessions s on s.id = t.session_id
                               where s.venue_id = p_venue and t.presenter_id is not null),
    'venue', 'Your talk is scheduled', 'The program is published. Your session, room and time are on the program page.', p_venue, null,
    'Open program', '/program/' || (select slug from public.venues where id = p_venue));
  perform private.log(p_venue, 'program.published', 'venue', p_venue, jsonb_build_object('presenters', n));
  return n;
end $$;

-- public program with talks (blind rules don't apply to accepted papers)
create or replace function public.program(p_venue uuid)
returns table (session_id uuid, code text, title text, kind text, room text, room_id uuid, previous_room text, starts_at timestamptz,
               ends_at timestamptz, chair text, cochair text, live_status text, delay_min smallint, talks jsonb, in_my_schedule boolean,
               i_chair boolean, i_present boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.code, s.title, s.kind, r.name, r.id, pr.name, s.starts_at, s.ends_at, c.display_name, cc.display_name, s.live_status, s.delay_min,
         coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'position', t.position, 'starts_at', t.starts_at, 'talk_min', t.talk_min,
                   'qa_min', t.qa_min, 'number', x.number, 'submission_id', x.id, 'title', coalesce(t.title, x.title), 'abstract', x.abstract,
                   'presenter', pp.display_name, 'presenter_id', t.presenter_id, 'remote', t.is_remote, 'attendance', t.attendance,
                   'authors', (select string_agg(ap.display_name, ', ' order by a.position) from public.submission_authors a join public.persons ap on ap.id = a.person_id where a.submission_id = x.id))
                   order by t.position)
                   from public.session_talks t left join public.submissions x on x.id = t.submission_id left join public.persons pp on pp.id = t.presenter_id
                   where t.session_id = s.id), '[]'::jsonb),
         exists (select 1 from public.schedule_items i where i.session_id = s.id and i.person_id = private.current_person_id()),
         coalesce(private.current_person_id() = s.chair_id, false) or coalesce(private.current_person_id() = s.cochair_id, false),
         exists (select 1 from public.session_talks t where t.session_id = s.id and t.presenter_id = private.current_person_id())
  from public.sessions s
  left join public.rooms r on r.id = s.room_id
  left join public.rooms pr on pr.id = s.previous_room_id
  left join public.persons c on c.id = s.chair_id
  left join public.persons cc on cc.id = s.cochair_id
  where s.venue_id = p_venue and (private.program_published(p_venue) or private.is_organizer(p_venue))
  order by s.starts_at, r.sort, s.code
$$;

create or replace function public.toggle_schedule(p_session uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id();
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if exists (select 1 from public.schedule_items where person_id = v_me and session_id = p_session) then
    delete from public.schedule_items where person_id = v_me and session_id = p_session; return false;
  end if;
  insert into public.schedule_items (person_id, session_id) values (v_me, p_session); return true;
end $$;

-- session chairs (CH01, M05) and organizers update the room on the day
create or replace function public.chair_update(p_session uuid, p_live_status text, p_delay integer, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = p_session;
  if s.id is null or not (coalesce(private.current_person_id() = s.chair_id, false) or coalesce(private.current_person_id() = s.cochair_id, false) or private.is_organizer(s.venue_id)) then
    raise exception 'not your session' using errcode = '42501';
  end if;
  update public.sessions set live_status = coalesce(p_live_status, live_status), delay_min = coalesce(p_delay, delay_min),
    live_note = coalesce(p_note, live_note) where id = p_session;
end $$;

create or replace function public.set_talk_attendance(p_talk uuid, p_attendance text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.sessions;
begin
  select x.* into s from public.sessions x join public.session_talks t on t.session_id = x.id where t.id = p_talk;
  if s.id is null or not (coalesce(private.current_person_id() = s.chair_id, false) or coalesce(private.current_person_id() = s.cochair_id, false) or private.is_organizer(s.venue_id)) then
    raise exception 'not your session' using errcode = '42501';
  end if;
  update public.session_talks set attendance = p_attendance,
    noshow_note = case when p_attendance = 'no_show' then coalesce(p_note, noshow_note) else noshow_note end,
    noshow_reported_by = case when p_attendance = 'no_show' then private.current_person_id() else noshow_reported_by end
  where id = p_talk;
  if p_attendance = 'no_show' then perform private.log(s.venue_id, 'talk.no_show', 'session_talk', p_talk); end if;
end $$;

create or replace function public.my_chaired_sessions()
returns table (session_id uuid, venue_id uuid, venue_short text, venue_slug text, code text, title text, room text, starts_at timestamptz, ends_at timestamptz,
               live_status text, delay_min smallint, talks jsonb)
language sql stable security definer set search_path = '' as $$
  select s.id, v.id, coalesce(v.short_name, v.name), v.slug::text, s.code, s.title, r.name, s.starts_at, s.ends_at, s.live_status, s.delay_min,
         coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'position', t.position, 'starts_at', t.starts_at, 'number', x.number,
                   'title', coalesce(t.title, x.title), 'presenter', pp.display_name, 'presenter_id', t.presenter_id, 'remote', t.is_remote,
                   'attendance', t.attendance, 'slides', t.slides_path is not null, 'bio', t.presenter_bio is not null,
                   'registered', exists (select 1 from public.registrations g where g.venue_id = v.id and g.person_id = t.presenter_id))
                   order by t.position)
                   from public.session_talks t left join public.submissions x on x.id = t.submission_id left join public.persons pp on pp.id = t.presenter_id
                   where t.session_id = s.id), '[]'::jsonb)
  from public.sessions s join public.venues v on v.id = s.venue_id left join public.rooms r on r.id = s.room_id
  where coalesce(private.current_person_id() = s.chair_id, false) or coalesce(private.current_person_id() = s.cochair_id, false)
  order by s.starts_at
$$;

create or replace function public.check_in(p_registration uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare g public.registrations;
begin
  select * into g from public.registrations where id = p_registration for update;
  if g.id is null or not private.is_organizer(g.venue_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.registrations set checked_in_at = coalesce(checked_in_at, now()), badges = badges + 1 where id = p_registration;
end $$;

-- ---------------------------------------------------------------- RPC: inbox (IN01)
create or replace function public.my_inbox()
returns table (thread_id uuid, kind text, subject text, venue text, submission_id uuid, last_body text, last_from text, last_at timestamptz,
               unread boolean, reply_allowed boolean, archived boolean, cta_label text, cta_url text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.kind, t.subject, coalesce(v.short_name, v.name), t.submission_id, m.body, coalesce(m.sender_label, sp.display_name), m.created_at,
         pa.read_at is null or pa.read_at < m.created_at, t.reply_allowed, pa.archived_at is not null, m.cta_label, m.cta_url
  from public.inbox_participants pa
  join public.inbox_threads t on t.id = pa.thread_id
  left join public.venues v on v.id = t.venue_id
  join lateral (select * from public.inbox_messages x where x.thread_id = t.id order by x.created_at desc limit 1) m on true
  left join public.persons sp on sp.id = m.sender_id
  where pa.person_id = private.current_person_id()
  order by m.created_at desc
  limit 200
$$;

create or replace function public.reply_thread(p_thread uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.in_thread(p_thread) or not exists (select 1 from public.inbox_threads where id = p_thread and reply_allowed) then
    raise exception 'replies are not possible here' using errcode = '42501';
  end if;
  insert into public.inbox_messages (thread_id, sender_id, body) values (p_thread, private.current_person_id(), btrim(p_body)) returning id into v_id;
  update public.inbox_participants set read_at = now() where thread_id = p_thread and person_id = private.current_person_id();
  update public.inbox_participants set archived_at = null where thread_id = p_thread;
  return v_id;
end $$;

-- message people at your event (EM40 Message, VN01 contacts) or the venue team
create or replace function public.send_message(p_venue uuid, p_people uuid[], p_subject text, p_body text, p_submission uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  v_to uuid[];
  v_thread uuid;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if private.is_organizer(p_venue) then
    v_to := p_people;
  else  -- non-organizers can only write to the venue's organizers
    v_to := array(select distinct m.person_id from public.venue_members m where m.venue_id = p_venue and m.person_id = any (p_people)
                  and m.role in ('owner', 'chair', 'program_chair', 'deputy_chair', 'ceb_chair', 'publication_chair', 'registration_chair'));
  end if;
  if cardinality(v_to) = 0 then raise exception 'no recipients' using errcode = '22023'; end if;
  insert into public.inbox_threads (venue_id, submission_id, kind, subject, reply_allowed) values (p_venue, p_submission, 'message', left(p_subject, 300), true)
  returning id into v_thread;
  insert into public.inbox_messages (thread_id, sender_id, body) values (v_thread, v_me, p_body);
  insert into public.inbox_participants (thread_id, person_id, read_at) values (v_thread, v_me, now()) on conflict do nothing;
  insert into public.inbox_participants (thread_id, person_id) select v_thread, x from unnest(v_to) x on conflict do nothing;
  return v_thread;
end $$;

-- ---------------------------------------------------------------- RPC: calendar feed (CL01)
create or replace function public.set_calendar_feed(p_token_hash text, p_flags jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id();
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_token_hash is not null then
    update public.calendar_feeds set revoked_at = now() where person_id = v_me and revoked_at is null;
    insert into public.calendar_feeds (person_id, token_hash, flags) values (v_me, p_token_hash, coalesce(p_flags, '{"submissions":true,"reviews":true,"sessions":true,"followed":false}'));
  else
    update public.calendar_feeds set flags = coalesce(p_flags, flags) where person_id = v_me and revoked_at is null;
  end if;
end $$;

-- events for a feed token (route handler, no sign-in)
create or replace function public.calendar_feed_items(p_token_hash text)
returns table (uid text, title text, starts_at timestamptz, ends_at timestamptz, location text, description text, url text)
language plpgsql stable security definer set search_path = '' as $$
declare f public.calendar_feeds;
begin
  select * into f from public.calendar_feeds where token_hash = p_token_hash and revoked_at is null;
  if f.id is null then return; end if;
  if coalesce((f.flags ->> 'submissions')::boolean, true) then
    return query select 'sub-' || s.id || '-' || d.id, coalesce(v.short_name, v.name) || ' · ' || d.label || ' · #' || lpad(coalesce(s.number, 0)::text, 4, '0'),
      d.starts_at, d.starts_at + interval '30 minutes', null::text, s.title, '/submissions/' || s.id
    from public.submission_authors a join public.submissions s on s.id = a.submission_id join public.venues v on v.id = s.venue_id
    join public.venue_dates d on d.venue_id = v.id and d.kind in ('submission', 'final', 'registration', 'rebuttal')
    where a.person_id = f.person_id and s.stage not in ('withdrawn', 'rejected') and d.starts_at > now() - interval '30 days';
  end if;
  if coalesce((f.flags ->> 'reviews')::boolean, true) then
    return query select 'rev-' || r.id, 'Review due · #' || lpad(coalesce(s.number, 0)::text, 4, '0') || ' · ' || coalesce(v.short_name, v.name),
      r.due_at, r.due_at + interval '30 minutes', null::text, s.title, '/reviews/' || r.id
    from public.review_assignments r join public.submissions s on s.id = r.submission_id join public.venues v on v.id = s.venue_id
    where r.reviewer_id = f.person_id and r.status = 'accepted';
  end if;
  if coalesce((f.flags ->> 'sessions')::boolean, true) then
    return query select 'ses-' || s.id, s.code || ' · ' || s.title, s.starts_at, s.ends_at, rm.name, coalesce(v.short_name, v.name), '/program/' || v.slug::text
    from public.sessions s join public.venues v on v.id = s.venue_id left join public.rooms rm on rm.id = s.room_id
    where private.program_published(v.id) and (coalesce(f.person_id = s.chair_id, false) or coalesce(f.person_id = s.cochair_id, false)
          or exists (select 1 from public.session_talks t where t.session_id = s.id and t.presenter_id = f.person_id)
          or exists (select 1 from public.schedule_items i where i.session_id = s.id and i.person_id = f.person_id));
  end if;
  if coalesce((f.flags ->> 'followed')::boolean, false) then
    return query select 'ven-' || d.id, coalesce(v.short_name, v.name) || ' · ' || d.label, d.starts_at, coalesce(d.ends_at, d.starts_at + interval '30 minutes'),
      v.location, v.name, '/venues/' || v.slug::text
    from public.venue_follows w join public.venues v on v.id = w.venue_id join public.venue_dates d on d.venue_id = v.id
    where w.person_id = f.person_id and d.kind <> 'internal' and d.starts_at > now() - interval '30 days';
  end if;
end $$;

-- ---------------------------------------------------------------- RPC: privacy requests (ST04)
create or replace function public.request_data(p_kind text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  v_open_reviews int;
  v_open_papers int;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_kind = 'delete' then
    select count(*) into v_open_reviews from public.review_assignments where reviewer_id = v_me and status = 'accepted';
    select count(*) into v_open_papers from public.submission_authors a join public.submissions s on s.id = a.submission_id
      where a.person_id = v_me and s.stage in ('submitted', 'review', 'decision', 'revise');
    if v_open_reviews + v_open_papers > 0 then
      insert into public.data_requests (person_id, kind, status, blocked_reason)
      values (v_me, 'delete', 'blocked', v_open_reviews || ' reviews in progress and ' || v_open_papers || ' papers under review');
      return 'blocked';
    end if;
    insert into public.data_requests (person_id, kind, scheduled_for) values (v_me, 'delete', now() + interval '30 days');
    return 'scheduled';
  end if;
  insert into public.data_requests (person_id, kind) values (v_me, p_kind);
  return 'requested';
end $$;

-- ---------------------------------------------------------------- RPC: AI rate limit (SB05a/t, RV05)
create or replace function public.use_ai(p_submission uuid, p_kind text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  v_used int;
  v_policy text;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not (private.is_submission_author(p_submission) or private.is_reviewer_of(p_submission) or private.manages_paper(p_submission)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select st.ai_policy into v_policy from public.submissions s join public.venue_settings st on st.venue_id = s.venue_id where s.id = p_submission;
  if v_policy = 'not_allowed' and not private.is_submission_author(p_submission) then raise exception 'this venue does not allow AI tools' using errcode = '42501'; end if;
  select count(*) into v_used from public.ai_requests where person_id = v_me and at > now() - interval '1 hour';
  if v_used >= 30 then raise exception 'AI limit reached — try again in an hour' using errcode = '53400'; end if;
  insert into public.ai_requests (person_id, submission_id, kind) values (v_me, p_submission, p_kind);
  return 30 - v_used - 1;
end $$;

-- ---------------------------------------------------------------- RPC: contact form (CT01) — anonymous allowed, rate limited
create or replace function public.submit_contact(p_kind text, p_topic text, p_name text, p_email text, p_subject text, p_body text,
                                                 p_details jsonb, p_allow_access boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v_ref text;
begin
  if p_kind not in ('support', 'sales') then raise exception 'bad kind' using errcode = '22023'; end if;
  if (select count(*) from public.contact_messages where email = p_email::extensions.citext and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many messages — try again later' using errcode = '53400';
  end if;
  v_ref := case p_kind when 'support' then 'SUP-' else 'SAL-' end || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
  insert into public.contact_messages (reference, kind, topic, name, email, person_id, subject, body, details, allow_access)
  values (v_ref, p_kind, p_topic, nullif(btrim(coalesce(p_name, '')), ''), p_email, private.current_person_id(), nullif(btrim(coalesce(p_subject, '')), ''),
          btrim(p_body), coalesce(p_details, '{}'), coalesce(p_allow_access, false));
  return v_ref;
end $$;

-- ---------------------------------------------------------------- grants
revoke all on function public.record_edit(uuid, text[], boolean, boolean), public.withdraw_paper(uuid, text, text, text),
  public.confirm_coauthorship(uuid, boolean, text, jsonb), public.save_rebuttal(uuid, jsonb), public.save_revision(uuid, jsonb, jsonb, boolean, boolean),
  public.record_followup_file(uuid, public.submission_file_role, text, text, bigint, text, integer, jsonb), public.save_final(uuid, jsonb),
  public.final_admin(uuid, text), public.program_clashes(uuid), public.publish_program(uuid), public.toggle_schedule(uuid),
  public.chair_update(uuid, text, integer, text), public.set_talk_attendance(uuid, text, text), public.my_chaired_sessions(),
  public.check_in(uuid), public.my_inbox(), public.reply_thread(uuid, text), public.send_message(uuid, uuid[], text, text, uuid),
  public.set_calendar_feed(text, jsonb), public.request_data(text), public.use_ai(uuid, text) from public, anon;
grant execute on function public.record_edit(uuid, text[], boolean, boolean), public.withdraw_paper(uuid, text, text, text),
  public.confirm_coauthorship(uuid, boolean, text, jsonb), public.save_rebuttal(uuid, jsonb), public.save_revision(uuid, jsonb, jsonb, boolean, boolean),
  public.record_followup_file(uuid, public.submission_file_role, text, text, bigint, text, integer, jsonb), public.save_final(uuid, jsonb),
  public.final_admin(uuid, text), public.program_clashes(uuid), public.publish_program(uuid), public.toggle_schedule(uuid),
  public.chair_update(uuid, text, integer, text), public.set_talk_attendance(uuid, text, text), public.my_chaired_sessions(),
  public.check_in(uuid), public.my_inbox(), public.reply_thread(uuid, text), public.send_message(uuid, uuid[], text, text, uuid),
  public.set_calendar_feed(text, jsonb), public.request_data(text), public.use_ai(uuid, text) to authenticated;
grant execute on function public.program(uuid), public.calendar_feed_items(text), public.submit_contact(text, text, text, text, text, text, jsonb, boolean) to anon, authenticated;
