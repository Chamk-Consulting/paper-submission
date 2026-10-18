-- Submission wizard (canvas SB01–SB09): drafts, details, authors, keywords, files, conflicts, submit, withdraw.
-- Rules live here, not in the browser: authors edit only their own drafts, only before the deadline;
-- numbering, stage changes and author lists go through security-definer functions.

-- ---------------------------------------------------------------- submissions: wizard fields
alter table public.submissions
  add column track            text check (char_length(track) <= 120),
  add column abstract         text check (char_length(abstract) <= 4000),
  add column short_title      text check (char_length(short_title) <= 120),
  add column declarations     jsonb not null default '{}'::jsonb,   -- {original, preprint, student_award}
  add column keywords         text[] not null default '{}',         -- venue list; [1] = main keyword
  add column own_keywords     text[] not null default '{}',
  add column conflicts_ok_at  timestamptz,                          -- author reviewed conflicts (step 6)
  add column confirmations    jsonb not null default '{}'::jsonb,   -- {agree, present} at submit
  add column withdrawn_at     timestamptz,
  add constraint submissions_keywords_max check (cardinality(keywords) <= 5 and cardinality(own_keywords) <= 5);

-- next open submission deadline of a venue (null = none open). Journals (no deadline) stay open.
create or replace function private.venue_deadline(p_venue uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select min(d.starts_at) from public.venue_dates d
  where d.venue_id = p_venue and d.kind = 'submission' and d.starts_at > now()
$$;

create or replace function private.venue_open(p_venue uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.venues v where v.id = p_venue and v.is_published)
     and (
       private.venue_deadline(p_venue) is not null
       or exists (select 1 from public.venues v where v.id = p_venue and v.kind = 'journal')
     )
$$;

-- Authors may edit the wizard fields while the paper is a draft or submitted-but-before-deadline.
create or replace function private.can_edit_submission(p_submission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.submissions s
    where s.id = p_submission
      and s.stage in ('draft', 'submitted')
      and private.is_submission_author(s.id)
      and private.venue_open(s.venue_id)
  )
$$;

revoke update on public.submissions from authenticated;
grant update (paper_type, track, title, abstract, short_title, declarations, keywords, own_keywords, draft_step, conflicts_ok_at)
  on public.submissions to authenticated;
create policy submissions_update_author on public.submissions for update to authenticated
  using ((select private.can_edit_submission(id)))
  with check ((select private.can_edit_submission(id)));
revoke insert, delete on public.submissions from authenticated;
revoke insert, update, delete on public.submission_authors from authenticated;

-- ---------------------------------------------------------------- create a draft (SB01)
create or replace function public.create_draft(p_venue uuid, p_paper_type text, p_track text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_person uuid := private.current_person_id();
  v_id uuid;
begin
  if v_person is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not private.venue_open(p_venue) then raise exception 'submissions are closed' using errcode = '22023'; end if;
  if coalesce(btrim(p_paper_type), '') = '' or char_length(p_paper_type) > 80 then raise exception 'choose a type' using errcode = '22023'; end if;
  if (select count(*) from public.submissions s join public.submission_authors a on a.submission_id = s.id
      where s.venue_id = p_venue and a.person_id = v_person and s.stage = 'draft') >= 10 then
    raise exception 'too many drafts at this venue' using errcode = '22023';
  end if;

  insert into public.submissions (venue_id, title, paper_type, track, stage, draft_step, created_by)
  values (p_venue, 'Untitled paper', btrim(p_paper_type), nullif(btrim(coalesce(p_track, '')), ''), 'draft', 2, v_person)
  returning id into v_id;
  insert into public.submission_authors (submission_id, person_id, position, is_corresponding)
  values (v_id, v_person, 1, true);
  insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id)
  values (v_person, p_venue, 'submission.draft_created', 'submission', v_id);
  return v_id;
end $$;

-- ---------------------------------------------------------------- authors (SB03)
-- Everyone on the author list of a paper can see each other's name, email and affiliation.
create or replace function public.submission_author_list(p_submission uuid)
returns table (person_id uuid, author_position smallint, is_corresponding boolean, display_name text, email text,
               institution text, plenary_id text, is_you boolean, has_account boolean)
language sql stable security definer set search_path = '' as $$
  select a.person_id, a.position, a.is_corresponding, p.display_name,
         (select e.email::text from public.person_emails e where e.person_id = p.id order by e.is_primary desc limit 1),
         (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1),
         p.plenary_id, p.id = private.current_person_id(), p.user_id is not null
  from public.submission_authors a
  join public.persons p on p.id = a.person_id
  where a.submission_id = p_submission
    and (private.is_submission_author(p_submission)
         or exists (select 1 from public.submissions s where s.id = p_submission
                    and private.has_venue_role(s.venue_id, array['owner', 'chair']::public.venue_role[])))
  order by a.position
$$;

-- Find someone to add as co-author by Plenary ID or email (exact match only; no browsing).
create or replace function public.find_person(p_query text)
returns table (person_id uuid, display_name text, institution text, plenary_id text)
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(btrim(coalesce(p_query, '')));
begin
  if private.current_person_id() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if q ~ '^pl-\d{4}-\d{4}$' then
    return query select p.id, p.display_name,
      (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1), p.plenary_id
      from public.persons p where lower(p.plenary_id) = q;
  elsif q ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return query select p.id, p.display_name,
      (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1), p.plenary_id
      from public.person_emails e join public.persons p on p.id = e.person_id where e.email = q::extensions.citext;
  end if;
end $$;

-- Replace the author list in one go. Items: {"person_id": uuid} or {"email","given_name","family_name","institution"},
-- plus "corresponding": bool. You must stay on the list; exactly one corresponding author.
create or replace function public.set_authors(p_submission uuid, p_authors jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  v_item jsonb;
  v_pid uuid;
  v_pos smallint := 0;
  v_email text;
  v_ids uuid[] := '{}';
  v_corr int := 0;
begin
  if not private.can_edit_submission(p_submission) then raise exception 'cannot edit this paper' using errcode = '42501'; end if;
  if jsonb_typeof(p_authors) <> 'array' or jsonb_array_length(p_authors) = 0 or jsonb_array_length(p_authors) > 40 then
    raise exception 'between 1 and 40 authors' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_authors) loop
    v_pid := nullif(v_item ->> 'person_id', '')::uuid;
    if v_pid is null then
      v_email := lower(btrim(coalesce(v_item ->> 'email', '')));
      if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email %', v_email using errcode = '22023'; end if;
      select e.person_id into v_pid from public.person_emails e where e.email = v_email::extensions.citext;
      if v_pid is null then
        -- placeholder person: claimed automatically when they sign up with this email (link_confirmed_user)
        if coalesce(btrim(v_item ->> 'family_name'), '') = '' and coalesce(btrim(v_item ->> 'given_name'), '') = '' then
          raise exception 'name required for %', v_email using errcode = '22023';
        end if;
        insert into public.persons (given_name, family_name)
        values (left(btrim(coalesce(v_item ->> 'given_name', '')), 120), left(btrim(coalesce(v_item ->> 'family_name', '')), 120))
        returning id into v_pid;
        insert into public.person_emails (person_id, email, is_primary) values (v_pid, v_email, true);
        if coalesce(btrim(v_item ->> 'institution'), '') <> '' then
          insert into public.affiliations (person_id, institution, email_domain)
          values (v_pid, left(btrim(v_item ->> 'institution'), 200), split_part(v_email, '@', 2));
        end if;
      end if;
    elsif not exists (select 1 from public.persons where id = v_pid) then
      raise exception 'unknown person' using errcode = '22023';
    end if;
    if v_pid = any (v_ids) then raise exception 'an author is listed twice' using errcode = '22023'; end if;
    v_ids := v_ids || v_pid;
    if coalesce((v_item ->> 'corresponding')::boolean, false) then v_corr := v_corr + 1; end if;
  end loop;

  if not (v_me = any (v_ids)) then raise exception 'you must stay on the author list' using errcode = '22023'; end if;
  if v_corr <> 1 then raise exception 'choose exactly one corresponding author' using errcode = '22023'; end if;

  delete from public.submission_authors where submission_id = p_submission;
  for v_item in select * from jsonb_array_elements(p_authors) loop
    v_pos := v_pos + 1;
    insert into public.submission_authors (submission_id, person_id, position, is_corresponding)
    values (p_submission, v_ids[v_pos], v_pos, coalesce((v_item ->> 'corresponding')::boolean, false));
  end loop;
  update public.submissions set updated_at = now() where id = p_submission;
end $$;

-- ---------------------------------------------------------------- files (SB05)
create type public.submission_file_role as enum ('paper', 'appendix', 'source', 'data', 'video');

create table public.submission_files (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  role           public.submission_file_role not null,
  storage_path   text not null unique,
  file_name      text not null check (char_length(file_name) between 1 and 200),
  size_bytes     bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  mime_type      text not null,
  pages          integer check (pages >= 0),
  check_result   jsonb not null default '{}'::jsonb,   -- {status: passed|warnings|failed, items: [...]}
  version        integer not null default 1,
  is_current     boolean not null default true,
  uploaded_by    uuid references public.persons (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index submission_files_sub_idx on public.submission_files (submission_id, role, is_current);
alter table public.submission_files enable row level security;
create policy submission_files_select on public.submission_files for select to authenticated
  using ((select private.is_submission_author(submission_id))
         or exists (select 1 from public.submissions s where s.id = submission_id
                    and (select private.has_venue_role(s.venue_id, array['owner', 'chair']::public.venue_role[]))));
revoke insert, update, delete on public.submission_files from authenticated;

-- Record an uploaded object (path must sit under the paper's folder) with its automatic check.
-- TODO(security): run the PDF check in an Edge Function with the service key so the result can't be supplied by the client.
create or replace function public.record_submission_file(
  p_submission uuid, p_role public.submission_file_role, p_path text, p_name text, p_size bigint, p_mime text,
  p_pages integer, p_check jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_ver int;
begin
  if not private.can_edit_submission(p_submission) then raise exception 'cannot edit this paper' using errcode = '42501'; end if;
  if split_part(p_path, '/', 1) <> p_submission::text then raise exception 'bad path' using errcode = '22023'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'papers' and o.name = p_path) then
    raise exception 'file not uploaded' using errcode = '22023';
  end if;
  if p_role = 'paper' and p_mime <> 'application/pdf' then raise exception 'paper must be a PDF' using errcode = '22023'; end if;

  select coalesce(max(version), 0) + 1 into v_ver from public.submission_files where submission_id = p_submission and role = p_role;
  if p_role = 'paper' then
    update public.submission_files set is_current = false where submission_id = p_submission and role = 'paper';
  end if;
  insert into public.submission_files (submission_id, role, storage_path, file_name, size_bytes, mime_type, pages, check_result, version, uploaded_by)
  values (p_submission, p_role, p_path, left(p_name, 200), p_size, p_mime, p_pages, coalesce(p_check, '{}'::jsonb), v_ver, private.current_person_id())
  returning id into v_id;

  if p_role = 'paper' then
    update public.submissions set pdf_check = case coalesce(p_check ->> 'status', '') when 'failed' then 'need'::public.check_state else 'ok'::public.check_state end,
           updated_at = now()
     where id = p_submission;
  end if;
  return v_id;
end $$;

create or replace function public.remove_submission_file(p_file uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sub uuid; v_role public.submission_file_role;
begin
  select submission_id, role into v_sub, v_role from public.submission_files where id = p_file;
  if v_sub is null or not private.can_edit_submission(v_sub) then raise exception 'cannot edit this paper' using errcode = '42501'; end if;
  if v_role = 'paper' then raise exception 'replace the paper PDF instead of removing it' using errcode = '22023'; end if;
  delete from public.submission_files where id = p_file;
end $$;

-- Storage: authors read/write their paper's folder papers/{submission_id}/...; chairs read.
create policy papers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'papers' and (select private.can_edit_submission(((storage.foldername(name))[1])::uuid)));
create policy papers_select on storage.objects for select to authenticated
  using (bucket_id = 'papers' and (
    (select private.is_submission_author(((storage.foldername(name))[1])::uuid))
    or exists (select 1 from public.submissions s where s.id = ((storage.foldername(name))[1])::uuid
               and (select private.has_venue_role(s.venue_id, array['owner', 'chair']::public.venue_role[])))));
create policy papers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'papers' and (select private.can_edit_submission(((storage.foldername(name))[1])::uuid)));

-- ---------------------------------------------------------------- conflicts (SB06)
create table public.submission_conflicts (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  person_id      uuid references public.persons (id) on delete cascade,
  institution    text check (char_length(institution) <= 200),
  reason         text not null check (char_length(reason) between 2 and 200),
  created_at     timestamptz not null default now(),
  check (person_id is not null or institution is not null),
  unique (submission_id, person_id)
);
alter table public.submission_conflicts enable row level security;
create policy submission_conflicts_author on public.submission_conflicts for all to authenticated
  using ((select private.is_submission_author(submission_id)))
  with check ((select private.can_edit_submission(submission_id)));
create policy submission_conflicts_chair on public.submission_conflicts for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id
                 and (select private.has_venue_role(s.venue_id, array['owner', 'chair']::public.venue_role[]))));

-- The committee you may declare conflicts with (names + affiliation only).
create or replace function public.venue_committee(p_venue uuid)
returns table (person_id uuid, display_name text, institution text, role public.venue_role)
language sql stable security definer set search_path = '' as $$
  select distinct on (p.id) p.id, p.display_name,
         (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1),
         m.role
  from public.venue_members m join public.persons p on p.id = m.person_id
  where m.venue_id = p_venue and m.role in ('owner', 'chair', 'associate_editor')
    and private.current_person_id() is not null
    and exists (select 1 from public.venues v where v.id = p_venue and v.is_published)
  order by p.id, m.role
$$;

-- ---------------------------------------------------------------- submit / withdraw (SB07–SB09)
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

  if s.stage = 'draft' then
    perform 1 from public.venues where id = s.venue_id for update;   -- serialise numbering per venue
    select coalesce(max(number), 0) + 1 into v_number from public.submissions where venue_id = s.venue_id;
    update public.submissions
       set stage = 'submitted', number = v_number, submitted_at = now(), draft_step = 7,
           stage_detail = 'Editable until the deadline', confirmations = jsonb_build_object('agree', true, 'present', true, 'at', now()),
           updated_at = now()
     where id = p_submission;
    insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id, details)
    values (v_me, s.venue_id, 'submission.submitted', 'submission', p_submission, jsonb_build_object('number', v_number));
    -- TODO(email): receipt to all authors; invitation to co-authors without an account.
  else
    v_number := s.number;
    update public.submissions set confirmations = jsonb_build_object('agree', true, 'present', true, 'at', now()), updated_at = now() where id = p_submission;
    insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id)
    values (v_me, s.venue_id, 'submission.updated', 'submission', p_submission);
  end if;
  return v_number;
end $$;

create or replace function public.withdraw_paper(p_submission uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_venue uuid;
begin
  select venue_id into v_venue from public.submissions
   where id = p_submission and stage not in ('withdrawn', 'done', 'rejected') and private.is_submission_author(id);
  if v_venue is null then raise exception 'cannot withdraw this paper' using errcode = '42501'; end if;
  update public.submissions set stage = 'withdrawn', withdrawn_at = now(), stage_detail = 'Withdrawn by the authors', updated_at = now()
   where id = p_submission;
  insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id)
  values (private.current_person_id(), v_venue, 'submission.withdrawn', 'submission', p_submission);
end $$;

-- Paper history for the status page (SB09): this paper's audit entries, authors only.
create or replace function public.submission_history(p_submission uuid)
returns table (at timestamptz, action text, details jsonb)
language sql stable security definer set search_path = '' as $$
  select l.at, l.action, l.details from public.audit_log l
  where l.entity = 'submission' and l.entity_id = p_submission and private.is_submission_author(p_submission)
  order by l.at desc limit 50
$$;

-- ---------------------------------------------------------------- grants
revoke all on function public.create_draft(uuid, text, text), public.submission_author_list(uuid), public.find_person(text),
  public.set_authors(uuid, jsonb), public.record_submission_file(uuid, public.submission_file_role, text, text, bigint, text, integer, jsonb),
  public.remove_submission_file(uuid), public.venue_committee(uuid), public.submit_paper(uuid, boolean, boolean),
  public.withdraw_paper(uuid), public.submission_history(uuid) from public, anon;
grant execute on function public.create_draft(uuid, text, text), public.submission_author_list(uuid), public.find_person(text),
  public.set_authors(uuid, jsonb), public.record_submission_file(uuid, public.submission_file_role, text, text, bigint, text, integer, jsonb),
  public.remove_submission_file(uuid), public.venue_committee(uuid), public.submit_paper(uuid, boolean, boolean),
  public.withdraw_paper(uuid), public.submission_history(uuid) to authenticated;
grant execute on function private.venue_deadline(uuid), private.venue_open(uuid), private.can_edit_submission(uuid) to authenticated;
