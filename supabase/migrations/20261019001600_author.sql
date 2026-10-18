-- Author follow-up screens (SB05v/a/t, SB10–SB15, CA01): versions with diffs, author-side info the
-- author can't read through RLS (venue settings, dates, registration), and notifications after a withdrawal.
-- Additive only.

-- ---------------------------------------------------------------- snapshot of what an edit can change
create or replace function private.version_snapshot(p_submission uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', s.title,
    'abstract', s.abstract,
    'short_title', s.short_title,
    'keywords', to_jsonb(coalesce(s.keywords, '{}'::text[])),
    'authors', coalesce((select jsonb_agg(coalesce(p.display_name, '') order by a.position)
                         from public.submission_authors a left join public.persons p on p.id = a.person_id
                         where a.submission_id = s.id), '[]'::jsonb),
    'conflicts', (select count(*) from public.submission_conflicts c where c.submission_id = s.id),
    'paper', (select jsonb_build_object('id', f.id, 'name', f.file_name, 'pages', f.pages, 'version', f.version)
              from public.submission_files f where f.submission_id = s.id and f.role = 'paper' and f.is_current limit 1)
  )
  from public.submissions s where s.id = p_submission
$$;

-- first version (what was submitted) — created lazily the first time an author opens the edit flow
create or replace function public.ensure_version_baseline(p_submission uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  v_no int;
begin
  select * into s from public.submissions where id = p_submission;
  if s.id is null or not private.is_submission_author(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  select max(version_no) into v_no from public.submission_versions where submission_id = p_submission;
  if v_no is not null then return v_no; end if;
  if s.stage = 'draft' then return 0; end if;
  insert into public.submission_versions (submission_id, version_no, kind, snapshot, receipt, created_by, created_at)
  values (p_submission, 1, 'initial', private.version_snapshot(p_submission), private.receipt(p_submission, 'V1'), s.created_by, coalesce(s.submitted_at, now()))
  on conflict (submission_id, version_no) do nothing;
  return 1;
end $$;

-- save the current state as a new version; the changed fields are computed against the last snapshot
create or replace function public.save_edit_version(p_submission uuid, p_agree boolean, p_notify boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  v_prev jsonb;
  v_now jsonb;
  v_changed text[] := '{}';
  v_no int;
  v_receipt text;
  k text;
begin
  select * into s from public.submissions where id = p_submission for update;
  if s.id is null or s.stage <> 'submitted' or not private.can_edit_submission(p_submission) then raise exception 'cannot edit this paper now' using errcode = '42501'; end if;
  if not coalesce(p_agree, false) then raise exception 'confirm that all co-authors agree' using errcode = '22023'; end if;
  perform public.ensure_version_baseline(p_submission);
  select snapshot, version_no into v_prev, v_no from public.submission_versions where submission_id = p_submission order by version_no desc limit 1;
  v_now := private.version_snapshot(p_submission);
  foreach k in array array['title', 'abstract', 'short_title', 'authors', 'keywords', 'conflicts', 'paper'] loop
    if (v_prev -> k) is distinct from (v_now -> k) then v_changed := v_changed || k; end if;
  end loop;
  if cardinality(v_changed) = 0 then raise exception 'nothing has changed since the last version' using errcode = '22023'; end if;
  v_no := v_no + 1;
  v_receipt := private.receipt(p_submission, 'V' || v_no);
  insert into public.submission_versions (submission_id, version_no, kind, changed_fields, snapshot, receipt, coauthors_notified, created_by)
  values (p_submission, v_no, 'edit', v_changed, v_now, v_receipt, coalesce(p_notify, false), private.current_person_id());
  update public.submissions set updated_at = now() where id = p_submission;
  if coalesce(p_notify, false) then
    perform private.notify(array(select a.person_id from public.submission_authors a where a.submission_id = p_submission
                                   and a.person_id is not null and a.person_id <> private.current_person_id()),
      'coauthor', '#' || lpad(coalesce(s.number, 0)::text, 4, '0') || ' is now version ' || v_no,
      coalesce((select display_name from public.persons where id = private.current_person_id()), 'A co-author') || ' changed: '
        || array_to_string(v_changed, ', ') || '. Receipt ' || v_receipt || '.',
      s.venue_id, p_submission, 'View paper', '/submissions/' || p_submission);
  end if;
  perform private.log(s.venue_id, 'submission.edited', 'submission', p_submission, jsonb_build_object('version', v_no, 'changed', v_changed, 'receipt', v_receipt));
  return jsonb_build_object('receipt', v_receipt, 'version', v_no, 'changed', to_jsonb(v_changed));
end $$;

-- ---------------------------------------------------------------- after a withdrawal: tell chairs and co-authors
create or replace function public.after_withdraw(p_submission uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  v_cancelled int;
  v_kept int;
  v_chairs uuid[];
begin
  select * into s from public.submissions where id = p_submission;
  if s.id is null or s.stage <> 'withdrawn' or not private.is_submission_author(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  select count(*) filter (where status = 'cancelled'), count(*) filter (where status = 'submitted')
    into v_cancelled, v_kept from public.review_assignments where submission_id = p_submission;
  -- notify once, right after the withdrawal
  if s.withdrawn_at > now() - interval '15 minutes'
     and not exists (select 1 from public.inbox_threads t where t.submission_id = p_submission and t.kind = 'system' and t.subject like '%withdrawn') then
    select array_agg(distinct r.person_id) into v_chairs from public.venue_members r
      where r.venue_id = s.venue_id and r.role in ('owner', 'chair', 'program_chair')
        and not exists (select 1 from public.submission_authors a where a.submission_id = p_submission and a.person_id = r.person_id);
    perform private.notify(coalesce(v_chairs, '{}'), 'system', 'Paper #' || lpad(coalesce(s.number, 0)::text, 4, '0') || ' withdrawn',
      '“' || s.title || '” was withdrawn by its authors. Reason: ' || coalesce(s.withdraw_reason, 'other') || '.', s.venue_id, p_submission);
    perform private.notify(array(select a.person_id from public.submission_authors a where a.submission_id = p_submission
                                   and a.person_id is not null and a.person_id <> private.current_person_id()),
      'system', 'Paper #' || lpad(coalesce(s.number, 0)::text, 4, '0') || ' withdrawn',
      coalesce((select display_name from public.persons where id = private.current_person_id()), 'A co-author') || ' withdrew “' || s.title || '”.',
      s.venue_id, p_submission, 'View paper', '/submissions/' || p_submission);
  end if;
  return jsonb_build_object('cancelled', v_cancelled, 'kept', v_kept, 'reason', s.withdraw_reason, 'note', s.withdraw_note, 'at', s.withdrawn_at);
end $$;

-- ---------------------------------------------------------------- what an author may know about their paper's venue
create or replace function public.author_followup_info(p_submission uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  s public.submissions;
  st public.venue_settings;
  v_released boolean;
  v_me uuid := private.current_person_id();
begin
  select * into s from public.submissions where id = p_submission;
  if s.id is null or not private.is_submission_author(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into st from public.venue_settings where venue_id = s.venue_id;
  select exists (select 1 from public.decisions d where d.submission_id = p_submission and d.released_at is not null) into v_released;
  return jsonb_build_object(
    'rebuttal', coalesce(st.rebuttal, false),
    'withdraw_reason', s.withdraw_reason,
    'ai_policy', coalesce(st.ai_policy, 'language_only'),
    'copyright_mode', coalesce(st.copyright_mode, 'ieee_ecf'),
    'dates', coalesce((select jsonb_object_agg(d.key, d.starts_at) from public.venue_dates d where d.venue_id = s.venue_id and d.key is not null), '{}'::jsonb),
    'reviews', jsonb_build_object(
      'cancelled', (select count(*) from public.review_assignments r where r.submission_id = p_submission and r.status = 'cancelled'),
      'active', (select count(*) from public.review_assignments r where r.submission_id = p_submission and r.status in ('invited', 'accepted')),
      'submitted', (select count(*) from public.review_assignments r where r.submission_id = p_submission and r.status = 'submitted')),
    'stats', case when v_released then jsonb_build_object(
      'papers', (select count(*) from public.submissions x where x.venue_id = s.venue_id and x.stage not in ('draft', 'withdrawn')),
      'accepted', (select count(*) from public.decisions d join public.submissions x on x.id = d.submission_id
                   where x.venue_id = s.venue_id and d.released_at is not null and d.decision in ('accept_oral', 'accept_poster', 'conditional')))
      else null end,
    'chair', (select p.display_name from public.venue_members r join public.persons p on p.id = r.person_id
              where r.venue_id = s.venue_id and r.role in ('chair', 'program_chair') order by (r.role = 'program_chair') desc limit 1),
    'authors', coalesce((select jsonb_agg(jsonb_build_object('person_id', a.person_id, 'confirmation', a.confirmation, 'affiliation', a.affiliation,
                                                            'responded_at', a.responded_at, 'is_me', a.person_id = v_me) order by a.position)
                         from public.submission_authors a where a.submission_id = p_submission), '[]'::jsonb),
    'added_by', (select p.display_name from public.persons p where p.id = s.created_by),
    'my_affiliations', coalesce((select jsonb_agg(distinct x) from (
        select f.institution x from public.affiliations f where f.person_id = v_me
        union select a.affiliation from public.submission_authors a where a.person_id = v_me and a.affiliation is not null) q), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------- registration of the paper's authors (SB12d)
create or replace function public.paper_registrations(p_submission uuid)
returns table (person_id uuid, display_name text, registered boolean, covers_paper boolean, reg_number text)
language plpgsql stable security definer set search_path = '' as $$
declare s public.submissions;
begin
  select * into s from public.submissions where id = p_submission;
  if s.id is null or not private.is_submission_author(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select a.person_id, p.display_name,
      exists (select 1 from public.registrations g where g.venue_id = s.venue_id and g.person_id = a.person_id),
      exists (select 1 from public.registrations g join public.registration_papers rp on rp.registration_id = g.id
              where g.venue_id = s.venue_id and g.person_id = a.person_id and rp.submission_id = p_submission),
      (select g.number from public.registrations g where g.venue_id = s.venue_id and g.person_id = a.person_id limit 1)
    from public.submission_authors a left join public.persons p on p.id = a.person_id
    where a.submission_id = p_submission order by a.position;
end $$;

revoke all on function private.version_snapshot(uuid) from public, anon;
revoke all on function public.ensure_version_baseline(uuid), public.save_edit_version(uuid, boolean, boolean), public.after_withdraw(uuid),
  public.author_followup_info(uuid), public.paper_registrations(uuid) from public, anon;
grant execute on function public.ensure_version_baseline(uuid), public.save_edit_version(uuid, boolean, boolean), public.after_withdraw(uuid),
  public.author_followup_info(uuid), public.paper_registrations(uuid) to authenticated;

-- ---------------------------------------------------------------- reviews the authors may answer during the rebuttal window (SB15)
create or replace function public.rebuttal_reviews(p_submission uuid)
returns table (assignment_id uuid, label text, scores jsonb, recommendation text, to_authors text, response text, closes_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.submissions;
  v_close timestamptz;
begin
  select * into s from public.submissions where id = p_submission;
  if s.id is null or not private.is_submission_author(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.venue_settings st where st.venue_id = s.venue_id and st.rebuttal) then return; end if;
  select d.starts_at into v_close from public.venue_dates d where d.venue_id = s.venue_id and d.key = 'rebuttal_close';
  if v_close is null then return; end if;
  return query
    select r.id, 'Reviewer ' || coalesce(r.ordinal, 0), w.scores, w.recommendation, w.to_authors,
      (select x.response from public.author_responses x where x.submission_id = p_submission and x.kind = 'rebuttal' and x.assignment_id = r.id limit 1),
      v_close
    from public.review_assignments r join public.reviews w on w.assignment_id = r.id
    where r.submission_id = p_submission and r.status = 'submitted' order by r.round, r.ordinal;
end $$;
revoke all on function public.rebuttal_reviews(uuid) from public, anon;
grant execute on function public.rebuttal_reviews(uuid) to authenticated;

-- what would go into the next version (SB10/SB10b): last snapshot, current state, changed fields
create or replace function public.edit_preview(p_submission uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_prev jsonb;
  v_no int;
  v_now jsonb;
  v_changed text[] := '{}';
  k text;
begin
  if not private.is_submission_author(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  perform public.ensure_version_baseline(p_submission);
  select snapshot, version_no into v_prev, v_no from public.submission_versions where submission_id = p_submission order by version_no desc limit 1;
  v_now := private.version_snapshot(p_submission);
  foreach k in array array['title', 'abstract', 'short_title', 'authors', 'keywords', 'conflicts', 'paper'] loop
    if (v_prev -> k) is distinct from (v_now -> k) then v_changed := v_changed || k; end if;
  end loop;
  return jsonb_build_object('version', coalesce(v_no, 0), 'previous', coalesce(v_prev, '{}'::jsonb), 'current', v_now, 'changed', to_jsonb(v_changed));
end $$;
revoke all on function public.edit_preview(uuid) from public, anon;
grant execute on function public.edit_preview(uuid) to authenticated;
