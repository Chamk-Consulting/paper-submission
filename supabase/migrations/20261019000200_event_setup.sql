-- Event setup (canvas EM01–EM13, EMR1, EM40, EM44): create an event, configure it section by section,
-- invite the committee, check everything, open submissions.
-- Settings that the canvas groups per screen live in one venue_settings row; screens validate shapes.

-- ---------------------------------------------------------------- role helpers
create or replace function private.is_organizer(p_venue uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_venue_role(p_venue, array['owner', 'chair', 'program_chair', 'deputy_chair', 'ceb_chair',
    'publication_chair', 'registration_chair', 'staff']::public.venue_role[])
$$;
-- chairs who run the paper process (staff and publication/registration chairs excluded)
create or replace function private.is_venue_chair(p_venue uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_venue_role(p_venue, array['owner', 'chair', 'program_chair', 'deputy_chair']::public.venue_role[])
$$;
create or replace function private.is_venue_owner(p_venue uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_venue_role(p_venue, array['owner']::public.venue_role[])
$$;
grant execute on function private.is_organizer(uuid), private.is_venue_chair(uuid), private.is_venue_owner(uuid) to authenticated;

-- ---------------------------------------------------------------- venues: setup columns
alter table public.venues
  add column if not exists tagline        text check (char_length(tagline) <= 160),
  add column if not exists accent         text not null default 'navy' check (accent in ('navy', 'saffron', 'teal', 'forest', 'crimson', 'royal')),
  add column if not exists logo_path      text check (char_length(logo_path) <= 300),
  add column if not exists public_text    text check (char_length(public_text) <= 20000),
  add column if not exists venue_address  text check (char_length(venue_address) <= 300),
  add column if not exists hotels         text check (char_length(hotels) <= 500),
  add column if not exists sponsor        text check (char_length(sponsor) <= 120),
  add column if not exists contact_email  text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column if not exists status         text not null default 'draft'
    check (status in ('draft', 'open', 'reviewing', 'decisions', 'finals', 'program', 'live', 'closed', 'archived')),
  add column if not exists opened_at      timestamptz,
  add column if not exists copied_from    uuid references public.venues (id) on delete set null,
  add column if not exists is_test        boolean not null default false;
-- existing demo venues were created already published: treat them as open
update public.venues set status = 'open' where is_published and status = 'draft';

-- ---------------------------------------------------------------- settings (one row per venue)
create table public.venue_settings (
  venue_id               uuid primary key references public.venues (id) on delete cascade,
  -- review (EM07)
  blind_type             text not null default 'double' check (blind_type in ('double', 'single', 'open')),
  min_reviews            smallint not null default 3 check (min_reviews between 1 and 6),
  max_reviewers          smallint not null default 4 check (max_reviewers between 1 and 8),
  ae_cap                 smallint not null default 15 check (ae_cap between 1 and 60),
  invite_days            smallint not null default 3 check (invite_days between 1 and 14),
  bidding                boolean not null default false,
  discussion             boolean not null default true,
  named_discussion       boolean not null default false,
  rebuttal               boolean not null default false,
  round2                 boolean not null default true,
  ai_policy              text not null default 'language_only' check (ai_policy in ('language_only', 'allowed_with_declaration', 'not_allowed')),
  criteria               jsonb not null default '[{"key":"novelty","name":"Novelty","help":"Is the contribution new?"},{"key":"quality","name":"Technical quality","help":"Are methods and proofs sound?"},{"key":"clarity","name":"Clarity","help":"Is it well written?"},{"key":"relevance","name":"Relevance","help":"Does it fit this venue?"}]'::jsonb,
  -- submission form + PDF rules (EM05)
  form_fields            jsonb not null default '{"title":"required","abstract":"required","authors":"required","keywords":"required","student":"optional","presented":"optional","conflicts":"required","funding":"hidden"}'::jsonb,
  custom_questions       jsonb not null default '[]'::jsonb,
  pdf_rules              jsonb not null default '{"fonts":true,"page_size":true,"blind":true,"pdf_express":true,"similarity":true}'::jsonb,
  max_papers_per_author  smallint check (max_papers_per_author between 1 and 20),
  keyword_list           text,
  -- conflicts (EM08)
  coauthor_years         smallint not null default 3 check (coauthor_years between 1 and 10),
  institution_years      smallint not null default 2 check (institution_years between 0 and 10),
  use_declared           boolean not null default true,
  override_second        boolean not null default true,
  -- publishing, registration (EM10)
  copyright_mode         text not null default 'ieee_ecf' check (copyright_mode in ('ieee_ecf', 'other_form', 'none')),
  ieee_record            text check (char_length(ieee_record) <= 40),
  isbn                   text check (char_length(isbn) <= 40),
  open_access            boolean not null default true,
  papers_per_registration smallint not null default 2 check (papers_per_registration between 1 and 4),
  extra_pages_prepaid    boolean not null default true,
  fee_types              jsonb not null default '[{"name":"IEEE member","early":null,"late":null,"covers":"n"},{"name":"Non-member","early":null,"late":null,"covers":"n"},{"name":"Student member","early":null,"late":null,"covers":"0"},{"name":"Life member / retired","early":null,"late":null,"covers":"1"},{"name":"Extra page","early":null,"late":null,"covers":"-"}]'::jsonb,
  currency               text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  -- program (EM11)
  minutes_per_paper      smallint not null default 20 check (minutes_per_paper between 10 and 40),
  papers_per_session     smallint not null default 5 check (papers_per_session between 3 and 8),
  parallel_sessions      smallint not null default 4 check (parallel_sessions between 1 and 12),
  poster_sessions        boolean not null default true,
  allow_remote           boolean not null default false,
  program_days           jsonb not null default '[]'::jsonb,
  -- emails (EM09)
  send_as_event          boolean not null default true,
  -- what locks when submissions open (K3)
  locked_at              timestamptz,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references public.persons (id) on delete set null,
  check (max_reviewers >= min_reviews)
);

-- ---------------------------------------------------------------- setup checklist (EM02)
create table public.venue_setup_sections (
  venue_id    uuid not null references public.venues (id) on delete cascade,
  key         text not null check (key in ('basics', 'dates', 'submission_types', 'submission_form', 'pdf_rules', 'review',
                'committee', 'conflicts', 'emails', 'copyright', 'registration', 'program')),
  status      text not null default 'not_started' check (status in ('not_started', 'in_progress', 'ready')),
  updated_by  uuid references public.persons (id) on delete set null,
  updated_at  timestamptz,
  primary key (venue_id, key)
);

-- ---------------------------------------------------------------- milestones (EM04) on venue_dates
alter table public.venue_dates
  add column if not exists key  text check (key in ('submissions_open', 'paper_deadline', 'ae_assignment', 'reviewer_assignment',
    'reviews_due', 'decisions', 'finals', 'registration', 'conference', 'bidding_close', 'discussion_close', 'rebuttal_close')),
  add column if not exists note text check (char_length(note) <= 200);
create unique index if not exists venue_dates_key_uq on public.venue_dates (venue_id, key) where key is not null;

create table public.venue_date_changes (
  id          bigint generated always as identity primary key,
  date_id     uuid not null references public.venue_dates (id) on delete cascade,
  old_at      timestamptz not null,
  new_at      timestamptz not null,
  changed_by  uuid references public.persons (id) on delete set null,
  notified    integer not null default 0,
  changed_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- submission types (EM05)
create table public.submission_types (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues (id) on delete cascade,
  name            text not null check (char_length(name) between 2 and 80),
  description     text check (char_length(description) <= 200),
  pages           smallint not null default 6 check (pages between 1 and 60),
  extra_pages     smallint not null default 0 check (extra_pages between 0 and 20),
  extra_page_fee  integer check (extra_page_fee >= 0),            -- in currency units
  revision_pages  smallint check (revision_pages between 1 and 80),
  deadline_at     timestamptz,                                     -- null = the paper deadline
  blind_override  text check (blind_override in ('double', 'single', 'open')),
  enabled         boolean not null default true,
  sort            smallint not null default 0,
  created_at      timestamptz not null default now(),
  unique (venue_id, name)
);

-- ---------------------------------------------------------------- committee (EM08)
alter table public.venue_members
  add column if not exists load_cap   smallint check (load_cap between 0 and 60),
  add column if not exists invited_by uuid references public.persons (id) on delete set null;

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,
  email        extensions.citext check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  person_id    uuid references public.persons (id) on delete cascade,
  role         public.venue_role not null,
  load_cap     smallint check (load_cap between 0 and 60),
  token_hash   text not null unique check (char_length(token_hash) = 64),   -- sha256 hex of the emailed token
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  message      text check (char_length(message) <= 2000),
  invited_by   uuid references public.persons (id) on delete set null,
  expires_at   timestamptz not null default now() + interval '30 days',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (email is not null or person_id is not null)
);
create index invitations_venue_idx on public.invitations (venue_id, status);
create index invitations_person_idx on public.invitations (person_id) where person_id is not null;

-- ---------------------------------------------------------------- conflicts (EM08, EMR1, ST01)
create table public.declared_conflicts (
  id             uuid primary key default gen_random_uuid(),
  person_id      uuid not null references public.persons (id) on delete cascade,
  other_person   uuid references public.persons (id) on delete cascade,
  institution    text check (char_length(institution) <= 200),
  reason         text not null check (char_length(reason) between 2 and 200),
  until_year     smallint check (until_year between 1950 and 2100),
  created_at     timestamptz not null default now(),
  check (other_person is not null or institution is not null)
);
create index declared_conflicts_person_idx on public.declared_conflicts (person_id);

create table public.conflict_overrides (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid not null references public.venues (id) on delete cascade,
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  person_id      uuid not null references public.persons (id) on delete cascade,
  reason         text not null check (char_length(reason) between 10 and 1000),
  requested_by   uuid references public.persons (id) on delete set null,
  approved_by    uuid references public.persons (id) on delete set null,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
  created_at     timestamptz not null default now(),
  decided_at     timestamptz
);

-- ---------------------------------------------------------------- email templates (EM09)
create table public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid references public.venues (id) on delete cascade,      -- null = Plenary default
  key         text not null check (key ~ '^[a-z][a-z0-9_]{2,40}$'),
  name        text not null check (char_length(name) <= 80),
  recipients  text not null check (recipients in ('authors', 'co_authors', 'reviewers', 'accepted_authors', 'committee', 'associate_editors', 'session_chairs')),
  subject     text not null check (char_length(subject) between 3 and 200),
  body        text not null check (char_length(body) between 10 and 20000),
  updated_by  uuid references public.persons (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create unique index email_templates_uq on public.email_templates (coalesce(venue_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

insert into public.email_templates (venue_id, key, name, recipients, subject, body) values
 (null, 'submission_received', 'Submission received', 'authors', 'Paper [paper.id] received — [venue.short]',
  E'Dear [author.first],\n\nWe received your paper [paper.id], “[paper.title]”. You can edit it until [deadline].\n\n[link]\n\n[venue.short] program committee'),
 (null, 'coauthor_confirmation', 'Co-author confirmation', 'co_authors', 'Please confirm you are an author of [paper.id]',
  E'Dear [author.first],\n\n[submitter] listed you as an author of “[paper.title]” at [venue.short]. Please confirm within 5 days.\n\n[link]'),
 (null, 'reviewer_invitation', 'Reviewer invitation', 'reviewers', 'Invitation to review [paper.id] for [venue.short]',
  E'Dear [reviewer.first],\n\nWould you review “[paper.title]” for [venue.short]? The review is due [deadline].\nAccept or decline without signing in:\n\n[link]'),
 (null, 'review_reminder', 'Review reminder', 'reviewers', 'Reminder: review of [paper.id] due [deadline]',
  E'Dear [reviewer.first],\n\nThis is a reminder that your review of [paper.id] is due [deadline].\n\n[link]'),
 (null, 'decision_accept', 'Decision — accept', 'authors', 'Decision on [paper.id] — accepted',
  E'Dear [author.first],\n\nWe are pleased to tell you that “[paper.title]” has been accepted to [venue.short].\nPlease upload the final version, sign the copyright form and register by [deadline].\n\n[link]'),
 (null, 'decision_conditional', 'Decision — conditional accept', 'authors', 'Decision on [paper.id] — conditional accept',
  E'Dear [author.first],\n\n“[paper.title]” is conditionally accepted. Please submit a revision within 30 days.\n\n[link]'),
 (null, 'decision_reject', 'Decision — reject', 'authors', 'Decision on [paper.id]',
  E'Dear [author.first],\n\nThank you for submitting “[paper.title]” to [venue.short]. We are sorry to tell you it was not accepted.\nThe reviews are below and in Plenary.\n\n[link]'),
 (null, 'final_reminder', 'Final version reminder', 'accepted_authors', 'Final version of [paper.id] due [deadline]',
  E'Dear [author.first],\n\nStill needed for [paper.id]: [missing.items]. Please upload the final PDF, sign copyright and register by [deadline].\n\n[link]'),
 (null, 'submissions_open', 'Submissions open', 'committee', 'Submissions are open — [venue.short]',
  E'Dear colleague,\n\nSubmissions for [venue.short] are now open. Thank you for being part of the committee.\n\n[link]'),
 (null, 'committee_invitation', 'Committee invitation', 'committee', 'Join the [venue.short] committee as [role]',
  E'Dear colleague,\n\n[inviter] invites you to join [venue.short] as [role]. The role starts when you accept.\n\n[link]');

-- ---------------------------------------------------------------- rooms (EM11)
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  code        text check (char_length(code) <= 12),
  name        text not null check (char_length(name) between 1 and 80),
  seats       integer check (seats between 1 and 20000),
  equipment   text check (char_length(equipment) <= 200),
  level       text check (char_length(level) <= 80),
  step_free   boolean not null default true,
  technician  text check (char_length(technician) <= 120),
  sort        smallint not null default 0
);
create index rooms_venue_idx on public.rooms (venue_id, sort);

-- ---------------------------------------------------------------- view as (EM40) + audit extras (EM44)
create table public.view_as_sessions (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  actor_id    uuid not null references public.persons (id) on delete cascade,
  target_id   uuid not null references public.persons (id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);
alter table public.audit_log
  add column if not exists acted_as text check (char_length(acted_as) <= 40),
  add column if not exists rule     text check (char_length(rule) <= 10);

-- ---------------------------------------------------------------- RLS
alter table public.venue_settings       enable row level security;
alter table public.venue_setup_sections enable row level security;
alter table public.venue_date_changes   enable row level security;
alter table public.submission_types     enable row level security;
alter table public.invitations          enable row level security;
alter table public.declared_conflicts   enable row level security;
alter table public.conflict_overrides   enable row level security;
alter table public.email_templates      enable row level security;
alter table public.rooms                enable row level security;
alter table public.view_as_sessions     enable row level security;
revoke all on public.venue_settings, public.venue_setup_sections, public.venue_date_changes, public.invitations,
  public.declared_conflicts, public.conflict_overrides, public.email_templates, public.view_as_sessions from anon;
revoke insert, update, delete on public.submission_types, public.rooms from anon;

create policy venue_settings_select on public.venue_settings for select to authenticated using ((select private.is_organizer(venue_id)));
create policy venue_settings_update on public.venue_settings for update to authenticated
  using ((select private.is_venue_chair(venue_id))) with check ((select private.is_venue_chair(venue_id)));
revoke insert, delete on public.venue_settings from authenticated;

create policy setup_sections_select on public.venue_setup_sections for select to authenticated using ((select private.is_organizer(venue_id)));
create policy setup_sections_write on public.venue_setup_sections for update to authenticated
  using ((select private.is_organizer(venue_id))) with check ((select private.is_organizer(venue_id)));
revoke insert, delete on public.venue_setup_sections from authenticated;

create policy date_changes_select on public.venue_date_changes for select to authenticated
  using (exists (select 1 from public.venue_dates d where d.id = date_id and (select private.is_organizer(d.venue_id))));
revoke insert, update, delete on public.venue_date_changes from authenticated;

-- types are public for published venues (wizard SB01), organizers manage them
create policy submission_types_select on public.submission_types for select to anon, authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.is_published) or (select private.is_organizer(venue_id)));
create policy submission_types_write on public.submission_types for all to authenticated
  using ((select private.is_venue_chair(venue_id))) with check ((select private.is_venue_chair(venue_id)));

create policy invitations_select on public.invitations for select to authenticated
  using (person_id = (select private.current_person_id()) or (select private.is_venue_chair(venue_id)));
revoke insert, update, delete on public.invitations from authenticated;

create policy declared_conflicts_own on public.declared_conflicts for all to authenticated
  using (person_id = (select private.current_person_id())) with check (person_id = (select private.current_person_id()));

create policy conflict_overrides_select on public.conflict_overrides for select to authenticated
  using ((select private.has_venue_role(venue_id, array['owner', 'chair', 'program_chair', 'deputy_chair', 'ceb_chair']::public.venue_role[])));
revoke insert, update, delete on public.conflict_overrides from authenticated;

create policy email_templates_select on public.email_templates for select to authenticated
  using (venue_id is null or (select private.is_organizer(venue_id)));
create policy email_templates_write on public.email_templates for all to authenticated
  using (venue_id is not null and (select private.is_venue_chair(venue_id)))
  with check (venue_id is not null and (select private.is_venue_chair(venue_id)));

create policy rooms_select on public.rooms for select to anon, authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.is_published) or (select private.is_organizer(venue_id)));
create policy rooms_write on public.rooms for all to authenticated
  using ((select private.is_venue_chair(venue_id))) with check ((select private.is_venue_chair(venue_id)));

create policy view_as_select on public.view_as_sessions for select to authenticated using ((select private.is_venue_owner(venue_id)));
revoke insert, update, delete on public.view_as_sessions from authenticated;

-- organizers read the whole audit log of their event; owners only per canvas, but chairs keep read access to their own actions
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (actor_user_id = (select auth.uid())
         or (venue_id is not null and (select private.is_venue_owner(venue_id))));

-- ---------------------------------------------------------------- settings row + checklist for every venue
create or replace function private.venue_setup_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.venue_settings (venue_id, updated_by) values (new.id, new.created_by) on conflict do nothing;
  insert into public.venue_setup_sections (venue_id, key)
  select new.id, k from unnest(array['basics', 'dates', 'submission_types', 'submission_form', 'pdf_rules', 'review',
    'committee', 'conflicts', 'emails', 'copyright', 'registration', 'program']) k
  on conflict do nothing;
  return new;
end $$;
create trigger venues_setup_defaults after insert on public.venues
  for each row execute function private.venue_setup_defaults();
-- backfill existing venues
insert into public.venue_settings (venue_id) select id from public.venues on conflict do nothing;
insert into public.venue_setup_sections (venue_id, key, status)
select v.id, k, case when v.is_published then 'ready' else 'not_started' end
from public.venues v cross join unnest(array['basics', 'dates', 'submission_types', 'submission_form', 'pdf_rules', 'review',
  'committee', 'conflicts', 'emails', 'copyright', 'registration', 'program']) k
on conflict do nothing;

-- lock: blind type, criteria and the review numbers can't change once submissions open, except by an owner
create or replace function private.venue_settings_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := private.current_person_id();
  if old.locked_at is not null and not private.is_venue_owner(old.venue_id)
     and (new.blind_type is distinct from old.blind_type or new.criteria is distinct from old.criteria
          or new.locked_at is distinct from old.locked_at) then
    raise exception 'locked since submissions opened — ask an owner' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger venue_settings_guard before update on public.venue_settings
  for each row execute function private.venue_settings_guard();

-- ---------------------------------------------------------------- RPC: create an event (EM01)
create or replace function public.create_event(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_me     uuid := private.current_person_id();
  v_kind   public.venue_kind := coalesce(nullif(p ->> 'kind', ''), 'conference')::public.venue_kind;
  v_name   text := btrim(coalesce(p ->> 'name', ''));
  v_short  text := btrim(coalesce(p ->> 'short_name', ''));
  v_base   text;
  v_slug   text;
  v_id     uuid;
  v_from   uuid := nullif(p ->> 'copy_from', '')::uuid;
  v_copy   jsonb := coalesce(p -> 'copy', '{}'::jsonb);
  n        int := 1;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if char_length(v_name) < 3 then raise exception 'name too short' using errcode = '22023'; end if;
  if v_from is not null and not private.is_venue_chair(v_from) then raise exception 'cannot copy that event' using errcode = '42501'; end if;
  v_base := regexp_replace(lower(coalesce(nullif(v_short, ''), v_name)), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from left(v_base, 50));
  if char_length(v_base) < 3 then v_base := 'event-' || v_base; end if;
  v_slug := v_base;
  while exists (select 1 from public.venues where slug = v_slug) loop n := n + 1; v_slug := v_base || '-' || n; end loop;

  insert into public.venues (slug, name, short_name, kind, starts_on, ends_on, location, city, country, format, sponsor,
                             timezone, double_blind, is_published, status, created_by, copied_from, society)
  values (v_slug, v_name, nullif(v_short, ''), v_kind, nullif(p ->> 'starts_on', '')::date, nullif(p ->> 'ends_on', '')::date,
          nullif(p ->> 'location', ''), nullif(p ->> 'city', ''), nullif(p ->> 'country', ''),
          nullif(p ->> 'format', '')::public.venue_format, nullif(p ->> 'sponsor', ''),
          coalesce(nullif(p ->> 'timezone', ''), 'UTC'), true, false, 'draft', v_me, v_from,
          nullif(p ->> 'society', ''))
  returning id into v_id;

  -- milestones (dates shifted by a year when copying, else empty placeholders the chair fills in)
  if v_from is not null and coalesce((v_copy ->> 'dates')::boolean, true) then
    insert into public.venue_dates (venue_id, kind, label, starts_at, ends_at, is_hard, key, note)
    select v_id, d.kind, d.label, d.starts_at + interval '1 year', d.ends_at + interval '1 year', d.is_hard, d.key, d.note
    from public.venue_dates d where d.venue_id = v_from and d.key is not null;
  end if;

  if v_from is not null then
    update public.venue_settings t set
      blind_type = case when coalesce((v_copy ->> 'review')::boolean, true) then s.blind_type else t.blind_type end,
      min_reviews = case when coalesce((v_copy ->> 'review')::boolean, true) then s.min_reviews else t.min_reviews end,
      max_reviewers = case when coalesce((v_copy ->> 'review')::boolean, true) then s.max_reviewers else t.max_reviewers end,
      ae_cap = case when coalesce((v_copy ->> 'review')::boolean, true) then s.ae_cap else t.ae_cap end,
      criteria = case when coalesce((v_copy ->> 'review')::boolean, true) then s.criteria else t.criteria end,
      bidding = s.bidding, discussion = s.discussion, rebuttal = s.rebuttal, round2 = s.round2, ai_policy = s.ai_policy,
      form_fields = case when coalesce((v_copy ->> 'types')::boolean, true) then s.form_fields else t.form_fields end,
      pdf_rules = case when coalesce((v_copy ->> 'types')::boolean, true) then s.pdf_rules else t.pdf_rules end,
      minutes_per_paper = case when coalesce((v_copy ->> 'program')::boolean, false) then s.minutes_per_paper else t.minutes_per_paper end,
      papers_per_session = case when coalesce((v_copy ->> 'program')::boolean, false) then s.papers_per_session else t.papers_per_session end,
      parallel_sessions = case when coalesce((v_copy ->> 'program')::boolean, false) then s.parallel_sessions else t.parallel_sessions end
    from public.venue_settings s where s.venue_id = v_from and t.venue_id = v_id;
    if coalesce((v_copy ->> 'types')::boolean, true) then
      insert into public.submission_types (venue_id, name, description, pages, extra_pages, extra_page_fee, revision_pages, blind_override, enabled, sort)
      select v_id, name, description, pages, extra_pages, extra_page_fee, revision_pages, blind_override, enabled, sort
      from public.submission_types where venue_id = v_from;
    end if;
    if coalesce((v_copy ->> 'emails')::boolean, true) then
      insert into public.email_templates (venue_id, key, name, recipients, subject, body, updated_by)
      select v_id, key, name, recipients, subject, body, v_me from public.email_templates where venue_id = v_from;
    end if;
    if coalesce((v_copy ->> 'program')::boolean, false) then
      insert into public.rooms (venue_id, code, name, seats, equipment, level, step_free, technician, sort)
      select v_id, code, name, seats, equipment, level, step_free, technician, sort from public.rooms where venue_id = v_from;
    end if;
  end if;

  if not exists (select 1 from public.submission_types where venue_id = v_id) then
    insert into public.submission_types (venue_id, name, description, pages, extra_pages, enabled, sort) values
      (v_id, 'Regular paper', 'Full papers', 6, 2, true, 1),
      (v_id, 'Invited session paper', 'Proposed by session organizers', 6, 2, true, 2),
      (v_id, 'Late-breaking results', '2-page posters', 2, 0, false, 3);
  end if;

  perform private.log(v_id, 'event.created', 'venue', v_id, jsonb_build_object('copied_from', v_from));
  return v_slug;
end $$;
grant execute on function public.create_event(jsonb) to authenticated;

-- ---------------------------------------------------------------- RPC: section status (EM02, K2)
create or replace function public.set_section_status(p_venue uuid, p_key text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_organizer(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.venue_setup_sections set status = p_status, updated_by = private.current_person_id(), updated_at = now()
  where venue_id = p_venue and key = p_key;
  if not found then raise exception 'unknown section' using errcode = '22023'; end if;
  perform private.log(p_venue, 'setup.' || p_key || '.' || p_status, 'venue', p_venue);
end $$;
grant execute on function public.set_section_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------- RPC: save milestones (EM04, C4–C6)
-- p_dates: [{key, label, kind, at (timestamptz), hard}]
create or replace function public.save_milestones(p_venue uuid, p_dates jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  d public.venue_dates;
  v_open boolean;
  v_new timestamptz;
  n int := 0;
begin
  if not private.is_venue_chair(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  select is_published into v_open from public.venues where id = p_venue;
  for r in select * from jsonb_array_elements(coalesce(p_dates, '[]'::jsonb)) loop
    continue when nullif(r ->> 'at', '') is null;
    v_new := (r ->> 'at')::timestamptz;
    select * into d from public.venue_dates where venue_id = p_venue and key = r ->> 'key';
    if d.id is null then
      insert into public.venue_dates (venue_id, key, kind, label, starts_at, is_hard, note)
      values (p_venue, r ->> 'key', coalesce(nullif(r ->> 'kind', ''), 'other')::public.venue_date_kind,
              coalesce(nullif(r ->> 'label', ''), r ->> 'key'), v_new, coalesce((r ->> 'hard')::boolean, false), nullif(r ->> 'note', ''));
    elsif d.starts_at is distinct from v_new or d.is_hard is distinct from coalesce((r ->> 'hard')::boolean, d.is_hard) then
      if v_open and v_new < d.starts_at and d.starts_at < now() then
        raise exception '‘%’ already passed and can’t move earlier', d.label using errcode = '22023';
      end if;
      if v_open and d.starts_at is distinct from v_new then
        insert into public.venue_date_changes (date_id, old_at, new_at, changed_by) values (d.id, d.starts_at, v_new, private.current_person_id());
        perform private.log(p_venue, 'deadline.changed', 'venue_date', d.id, jsonb_build_object('label', d.label, 'from', d.starts_at, 'to', v_new));
      end if;
      update public.venue_dates set starts_at = v_new, is_hard = coalesce((r ->> 'hard')::boolean, is_hard),
        is_extended = case when v_open and v_new > d.starts_at then true else is_extended end,
        extended_from = case when v_open and v_new > d.starts_at then coalesce(extended_from, d.starts_at) else extended_from end
      where id = d.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function public.save_milestones(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- RPC: committee invitations (EM08, A3)
-- the app generates a random token per recipient, emails it, and passes sha256(token) here.
create or replace function public.invite_member(p_venue uuid, p_email text, p_person uuid, p_role public.venue_role,
                                                p_token_hash text, p_load_cap integer default null, p_message text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_person uuid := p_person;
begin
  if not private.has_venue_role(p_venue, array['owner', 'chair', 'program_chair']::public.venue_role[]) then
    raise exception 'only owners and program chairs grant roles' using errcode = '42501';
  end if;
  if p_role in ('owner', 'author') then raise exception 'role can’t be granted by invitation' using errcode = '22023'; end if;
  if v_person is null and p_email is not null then
    select e.person_id into v_person from public.person_emails e where e.email = p_email::extensions.citext limit 1;
  end if;
  if v_person is not null and exists (select 1 from public.venue_members m where m.venue_id = p_venue and m.person_id = v_person and m.role = p_role) then
    raise exception 'already has this role' using errcode = '23505';
  end if;
  update public.invitations set status = 'revoked'
  where venue_id = p_venue and role = p_role and status = 'pending'
    and ((v_person is not null and person_id = v_person) or (p_email is not null and email = p_email::extensions.citext));
  insert into public.invitations (venue_id, email, person_id, role, load_cap, token_hash, message, invited_by)
  values (p_venue, nullif(p_email, '')::extensions.citext, v_person, p_role, p_load_cap, p_token_hash, p_message, private.current_person_id())
  returning id into v_id;
  perform private.log(p_venue, 'role.invited', 'invitation', v_id, jsonb_build_object('role', p_role, 'email', p_email));
  return v_id;
end $$;
grant execute on function public.invite_member(uuid, text, uuid, public.venue_role, text, integer, text) to authenticated;

create or replace function public.invitation_by_token(p_token_hash text)
returns table (id uuid, venue_id uuid, venue_name text, venue_slug text, role public.venue_role, status text, expires_at timestamptz,
               inviter text, email text)
language sql stable security definer set search_path = '' as $$
  select i.id, v.id, v.name, v.slug::text, i.role,
         case when i.status = 'pending' and i.expires_at < now() then 'expired' else i.status end,
         i.expires_at, p.display_name, i.email::text
  from public.invitations i join public.venues v on v.id = i.venue_id left join public.persons p on p.id = i.invited_by
  where i.token_hash = p_token_hash
$$;
grant execute on function public.invitation_by_token(text) to anon, authenticated;

create or replace function public.respond_invitation(p_token_hash text, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  i public.invitations;
  v_me uuid := private.current_person_id();
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into i from public.invitations where token_hash = p_token_hash for update;
  if i.id is null then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if i.status <> 'pending' then return i.status; end if;
  if i.expires_at < now() then update public.invitations set status = 'expired' where id = i.id; return 'expired'; end if;
  if i.person_id is not null and i.person_id <> v_me then raise exception 'this invitation is for another account' using errcode = '42501'; end if;
  update public.invitations set status = case when p_accept then 'accepted' else 'declined' end, person_id = v_me, responded_at = now() where id = i.id;
  if p_accept then
    insert into public.venue_members (venue_id, person_id, role, load_cap, invited_by)
    values (i.venue_id, v_me, i.role, i.load_cap, i.invited_by) on conflict do nothing;
  end if;
  insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id, details)
  values (v_me, i.venue_id, case when p_accept then 'role.accepted' else 'role.declined' end, 'invitation', i.id, jsonb_build_object('role', i.role));
  return case when p_accept then 'accepted' else 'declined' end;
end $$;
grant execute on function public.respond_invitation(text, boolean) to authenticated;

create or replace function public.remove_member(p_venue uuid, p_person uuid, p_role public.venue_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_venue_role(p_venue, array['owner', 'chair', 'program_chair']::public.venue_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    if not private.is_venue_owner(p_venue) then raise exception 'only owners remove owners' using errcode = '42501'; end if;
    if (select count(*) from public.venue_members where venue_id = p_venue and role = 'owner') <= 1 then
      raise exception 'every event keeps at least one owner' using errcode = '22023';
    end if;
  end if;
  delete from public.venue_members where venue_id = p_venue and person_id = p_person and role = p_role;
  perform private.log(p_venue, 'role.removed', 'person', p_person, jsonb_build_object('role', p_role));
end $$;
grant execute on function public.remove_member(uuid, uuid, public.venue_role) to authenticated;

-- People at an event (EM08 committee, EM40 people): one row per person with all their roles.
create or replace function public.venue_people(p_venue uuid)
returns table (person_id uuid, display_name text, plenary_id text, email text, institution text, roles text[], load_cap smallint,
               papers bigint, reviews bigint)
language sql stable security definer set search_path = '' as $$
  with people as (
    select m.person_id, array_agg(distinct m.role::text) roles, max(m.load_cap) load_cap from public.venue_members m where m.venue_id = p_venue group by m.person_id
    union
    select a.person_id, array['author'], null from public.submission_authors a join public.submissions s on s.id = a.submission_id
    where s.venue_id = p_venue and s.stage <> 'draft'
  ), merged as (
    select person_id, array(select distinct unnest(array_agg(r)) ) roles, max(load_cap) load_cap
    from people, unnest(people.roles) r group by person_id
  )
  select p.id, p.display_name, p.plenary_id,
         (select e.email::text from public.person_emails e where e.person_id = p.id and e.is_primary limit 1),
         (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1),
         m.roles, m.load_cap,
         (select count(*) from public.submission_authors a join public.submissions s on s.id = a.submission_id where a.person_id = p.id and s.venue_id = p_venue and s.stage <> 'draft'),
         0::bigint
  from merged m join public.persons p on p.id = m.person_id
  where private.is_organizer(p_venue)
  order by p.family_name, p.given_name
$$;
grant execute on function public.venue_people(uuid) to authenticated;

-- ---------------------------------------------------------------- go-live (EM13, D1)
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
                 join public.submissions x on x.id = a.submission_id and x.venue_id = p_venue
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
grant execute on function public.go_live_checks(uuid) to authenticated;

create or replace function public.open_submissions(p_venue uuid, p_ack boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_venue_role(p_venue, array['owner', 'program_chair']::public.venue_role[]) then
    raise exception 'only owners and program chairs open submissions' using errcode = '42501';
  end if;
  if not coalesce(p_ack, false) then raise exception 'confirm that settings lock' using errcode = '22023'; end if;
  if exists (select 1 from public.go_live_checks(p_venue) c where not c.ok) then
    raise exception 'go-live checks not passed' using errcode = '22023';
  end if;
  update public.venues set is_published = true, status = 'open', opened_at = now() where id = p_venue;
  update public.venue_settings set locked_at = now() where venue_id = p_venue;
  perform private.log(p_venue, 'event.opened', 'venue', p_venue);
end $$;
grant execute on function public.open_submissions(uuid, boolean) to authenticated;

-- every event the signed-in person organizes (sidebar "Your venues", EMR1)
create or replace function public.my_events()
returns table (venue_id uuid, slug text, name text, short_name text, status text, roles text[], starts_on date)
language sql stable security definer set search_path = '' as $$
  select v.id, v.slug::text, v.name, v.short_name, v.status, array_agg(distinct m.role::text), v.starts_on
  from public.venue_members m join public.venues v on v.id = m.venue_id
  where m.person_id = private.current_person_id()
  group by v.id order by v.starts_on desc nulls first
$$;
grant execute on function public.my_events() to authenticated;
