-- Submissions (papers) and their authors — the minimum WS02 "My submissions" needs.
-- Writes (create draft, upload, submit) arrive with the SB01–SB08 wizard; for now only reads are opened.

create type public.submission_stage as enum
  ('draft', 'submitted', 'review', 'decision', 'revise', 'final', 'done', 'rejected', 'withdrawn');
create type public.check_state as enum ('ok', 'need', 'no');

create table public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  venue_id            uuid not null references public.venues (id) on delete cascade,
  number              integer,                                  -- "#1234", given on submit
  title               text not null check (char_length(title) between 1 and 500),
  paper_type          text not null default 'Regular paper' check (char_length(paper_type) <= 80),
  stage               public.submission_stage not null default 'draft',
  stage_detail        text check (char_length(stage_detail) <= 200), -- "2 of 3 reviews in", "Step 4 of 7"
  draft_step          smallint check (draft_step between 1 and 7),
  pdf_check           public.check_state not null default 'no',
  copyright_check     public.check_state not null default 'no',
  registration_check  public.check_state not null default 'no',
  created_by          uuid references public.persons (id) on delete set null,
  submitted_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (venue_id, number)
);
create index submissions_venue_idx on public.submissions (venue_id, stage);
create trigger submissions_updated_at before update on public.submissions
  for each row execute function private.set_updated_at();

create table public.submission_authors (
  submission_id     uuid not null references public.submissions (id) on delete cascade,
  person_id         uuid not null references public.persons (id) on delete cascade,
  position          smallint not null check (position between 1 and 100),
  is_corresponding  boolean not null default false,
  created_at        timestamptz not null default now(),
  primary key (submission_id, person_id),
  unique (submission_id, position)
);
create index submission_authors_person_idx on public.submission_authors (person_id);

create or replace function private.is_submission_author(p_submission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.submission_authors a
    where a.submission_id = p_submission and a.person_id = (select private.current_person_id())
  )
$$;
grant execute on function private.is_submission_author(uuid) to authenticated;

alter table public.submissions enable row level security;
alter table public.submission_authors enable row level security;

-- Authors see their own papers; chairs/owners see every paper of their venue.
-- Reviewers get a blinded view later (separate view without author identities).
create policy submissions_select on public.submissions for select to authenticated
  using (
    (select private.is_submission_author(id))
    or (select private.has_venue_role(venue_id, array['owner', 'chair']::public.venue_role[]))
  );

create policy submission_authors_select on public.submission_authors for select to authenticated
  using (
    (select private.is_submission_author(submission_id))
    or exists (
      select 1 from public.submissions s
      where s.id = submission_id
        and (select private.has_venue_role(s.venue_id, array['owner', 'chair']::public.venue_role[]))
    )
  );

grant select on public.submissions, public.submission_authors to authenticated;
-- TODO(submit): insert/update policies + RPCs (create_draft, submit_paper) with the SB wizard.
