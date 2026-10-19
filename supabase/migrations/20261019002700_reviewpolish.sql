-- Review polish (WS01, SB04, SB08, RV02, RV03, RV04/RV08, RV10).
-- Additive except the three 'papers' storage policies, which are re-created so that the new
-- {submission}/reviews/{assignment}/ folder (reviewers' annotated PDFs) is never readable or writable by authors.

-- ---------------------------------------------------------------- helper: text -> uuid or null (never raises)
create or replace function private.uuid_or_null(p text)
returns uuid language sql immutable set search_path = '' as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end
$$;
grant execute on function private.uuid_or_null(text) to authenticated;

-- ---------------------------------------------------------------- SB08 / EM23: reviewer volunteers
create table public.venue_review_volunteers (
  venue_id      uuid not null references public.venues (id) on delete cascade,
  person_id     uuid not null references public.persons (id) on delete cascade,
  topics        text[] not null default '{}' check (cardinality(topics) <= 10),
  note          text check (char_length(note) <= 500),
  max_papers    smallint not null default 3 check (max_papers between 1 and 10),
  created_at    timestamptz not null default now(),
  withdrawn_at  timestamptz,
  primary key (venue_id, person_id)
);
create index venue_review_volunteers_person_idx on public.venue_review_volunteers (person_id);
alter table public.venue_review_volunteers enable row level security;
create policy venue_review_volunteers_select on public.venue_review_volunteers for select to authenticated
  using (person_id = (select private.current_person_id()) or (select private.is_organizer(venue_id)));
revoke insert, update, delete on public.venue_review_volunteers from authenticated;

create or replace function public.volunteer_to_review(p_venue uuid, p_topics text[], p_note text, p_max integer default 3)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id();
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.venues where id = p_venue) then raise exception 'venue not found' using errcode = '22023'; end if;
  insert into public.venue_review_volunteers (venue_id, person_id, topics, note, max_papers)
  values (p_venue, v_me,
          coalesce((select array_agg(distinct left(btrim(t), 120)) from unnest(coalesce(p_topics, '{}')) t where btrim(t) <> ''), '{}'),
          nullif(left(btrim(coalesce(p_note, '')), 500), ''), greatest(1, least(10, coalesce(p_max, 3))))
  on conflict (venue_id, person_id) do update set topics = excluded.topics, note = excluded.note, max_papers = excluded.max_papers,
    withdrawn_at = null, created_at = now();
end $$;

create or replace function public.withdraw_volunteering(p_venue uuid)
returns void language sql security definer set search_path = '' as $$
  update public.venue_review_volunteers set withdrawn_at = now()
  where venue_id = p_venue and person_id = private.current_person_id() and withdrawn_at is null
$$;

-- organizers only: active volunteers with their current institution and whether they already hold a role
create or replace function public.venue_volunteers(p_venue uuid)
returns table (person_id uuid, display_name text, institution text, topics text[], note text, max_papers smallint,
               created_at timestamptz, member_role text)
language sql stable security definer set search_path = '' as $$
  select v.person_id, p.display_name,
         (select a.institution from public.affiliations a where a.person_id = p.id and (a.ends_on is null or a.ends_on >= current_date)
          order by a.starts_on desc nulls last, a.created_at desc limit 1),
         v.topics, v.note, v.max_papers, v.created_at,
         (select string_agg(m.role::text, ', ' order by m.role::text) from public.venue_members m where m.venue_id = v.venue_id and m.person_id = v.person_id)
  from public.venue_review_volunteers v join public.persons p on p.id = v.person_id
  where v.venue_id = p_venue and v.withdrawn_at is null and private.is_organizer(p_venue)
  order by v.created_at desc
$$;

-- ---------------------------------------------------------------- SB04: reviewer pool size per keyword (counts only)
-- Pool = the venue's reviewers and associate editors plus active volunteers. No identities leave this function.
create or replace function public.keyword_pool_counts(p_venue uuid, p_keywords text[])
returns table (keyword text, reviewers integer)
language sql stable security definer set search_path = '' as $$
  with pool as (
    select m.person_id from public.venue_members m where m.venue_id = p_venue and m.role in ('reviewer', 'associate_editor')
    union
    select v.person_id from public.venue_review_volunteers v where v.venue_id = p_venue and v.withdrawn_at is null
  )
  select k, (select count(distinct t.person_id)::int from public.person_topics t join pool on pool.person_id = t.person_id
             where lower(t.topic) = lower(k))
  from unnest(coalesce(p_keywords, '{}')) as k
  where private.current_person_id() is not null and cardinality(p_keywords) <= 30
$$;

-- ---------------------------------------------------------------- RV02: reviewer -> handling AE (or chairs) message
create or replace function public.message_handling_editor(p_assignment uuid, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  r public.review_assignments;
  s public.submissions;
  v_to uuid[];
  v_thread uuid;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into r from public.review_assignments where id = p_assignment;
  if r.id is null or r.reviewer_id is distinct from v_me then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_body, ''))) < 2 then raise exception 'write a message' using errcode = '22023'; end if;
  select * into s from public.submissions where id = r.submission_id;
  if s.handling_ae is not null and s.handling_ae <> v_me then
    v_to := array[s.handling_ae];
  else  -- no AE yet: the chairs, never one who is an author of this paper (B1)
    v_to := array(select distinct m.person_id from public.venue_members m
                  where m.venue_id = s.venue_id and m.role in ('chair', 'program_chair', 'owner') and m.person_id <> v_me
                    and not exists (select 1 from public.submission_authors a where a.submission_id = s.id and a.person_id = m.person_id));
  end if;
  if cardinality(v_to) = 0 then raise exception 'no editor to message yet' using errcode = '22023'; end if;
  insert into public.inbox_threads (venue_id, submission_id, kind, subject, reply_allowed)
  values (s.venue_id, s.id, 'message',
          left(coalesce(nullif(btrim(p_subject), ''), 'Reviewer question') || ' · #' || lpad(coalesce(s.number::text, '0'), 4, '0'), 300), true)
  returning id into v_thread;
  insert into public.inbox_messages (thread_id, sender_id, body) values (v_thread, v_me, left(btrim(p_body), 8000));
  insert into public.inbox_participants (thread_id, person_id, read_at) values (v_thread, v_me, now()) on conflict do nothing;
  insert into public.inbox_participants (thread_id, person_id) select v_thread, x from unnest(v_to) x on conflict do nothing;
  return v_thread;
end $$;

-- ---------------------------------------------------------------- RV03: annotated PDF  ({submission}/reviews/{assignment}/file.pdf)
drop policy if exists papers_select on storage.objects;
create policy papers_select on storage.objects for select to authenticated
  using (bucket_id = 'papers' and (storage.foldername(name))[2] is distinct from 'reviews' and (
    (select private.is_submission_author(((storage.foldername(name))[1])::uuid))
    or (select private.manages_paper(((storage.foldername(name))[1])::uuid))
    or (select private.is_reviewer_of(((storage.foldername(name))[1])::uuid))));

drop policy if exists papers_insert on storage.objects;
create policy papers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'papers' and (storage.foldername(name))[2] is distinct from 'reviews' and (
    (select private.can_edit_submission(((storage.foldername(name))[1])::uuid))
    or (select private.can_upload_followup(((storage.foldername(name))[1])::uuid))));

drop policy if exists papers_delete on storage.objects;
create policy papers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'papers' and (storage.foldername(name))[2] is distinct from 'reviews'
         and (select private.can_edit_submission(((storage.foldername(name))[1])::uuid)));

-- the reviewer of that assignment, while it is accepted (not yet submitted or locked)
create or replace function private.can_write_annotation(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.review_assignments r
                 where r.id = private.uuid_or_null((storage.foldername(p_name))[3])
                   and r.submission_id = private.uuid_or_null((storage.foldername(p_name))[1])
                   and r.reviewer_id = private.current_person_id() and r.status = 'accepted' and r.locked_at is null)
$$;
-- that reviewer, or the people who manage the paper (handling AE, chairs who are not authors)
create or replace function private.can_read_annotation(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.review_assignments r
                 where r.id = private.uuid_or_null((storage.foldername(p_name))[3])
                   and r.submission_id = private.uuid_or_null((storage.foldername(p_name))[1])
                   and (r.reviewer_id = private.current_person_id() or private.manages_paper(r.submission_id)))
$$;
grant execute on function private.can_write_annotation(text), private.can_read_annotation(text) to authenticated;

create policy papers_review_annot_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'papers' and (storage.foldername(name))[2] = 'reviews' and lower(name) like '%.pdf'
              and (select private.can_write_annotation(name)));
create policy papers_review_annot_select on storage.objects for select to authenticated
  using (bucket_id = 'papers' and (storage.foldername(name))[2] = 'reviews' and (select private.can_read_annotation(name)));
create policy papers_review_annot_delete on storage.objects for delete to authenticated
  using (bucket_id = 'papers' and (storage.foldername(name))[2] = 'reviews' and (select private.can_write_annotation(name)));

create or replace function public.set_annotated_pdf(p_assignment uuid, p_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.review_assignments;
begin
  select * into r from public.review_assignments where id = p_assignment;
  if r.id is null or r.reviewer_id is distinct from private.current_person_id() or r.status <> 'accepted' or r.locked_at is not null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_path is not null then
    if p_path not like r.submission_id::text || '/reviews/' || r.id::text || '/%' or lower(p_path) not like '%.pdf' then
      raise exception 'bad path' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'papers' and o.name = p_path) then
      raise exception 'upload the file first' using errcode = '22023';
    end if;
  end if;
  insert into public.reviews (assignment_id, annotated_path, updated_at) values (r.id, p_path, now())
  on conflict (assignment_id) do update set annotated_path = excluded.annotated_path, updated_at = now();
end $$;

-- ---------------------------------------------------------------- RV10: "Best match" scores for my bidding list
create or replace function public.bidding_matches(p_venue uuid)
returns table (submission_id uuid, score integer, matched text[])
language sql stable security definer set search_path = '' as $$
  with mine as (select lower(t.topic) as t from public.person_topics t where t.person_id = private.current_person_id()),
  terms as (
    select s.id, lower(x) as term, x as label
    from public.submissions s, unnest(coalesce(s.keywords, '{}') || array_remove(array[s.topic, s.track], null)) x
    where s.venue_id = p_venue and s.stage in ('submitted', 'review') and not private.is_submission_author(s.id)
      and private.has_venue_role(p_venue, array['reviewer', 'associate_editor']::public.venue_role[])
  )
  select terms.id, count(distinct terms.term)::int, array_agg(distinct terms.label)
  from terms join mine on mine.t = terms.term
                       or (char_length(mine.t) >= 5 and char_length(terms.term) >= 5
                           and (position(mine.t in terms.term) > 0 or position(terms.term in mine.t) > 0))
  group by terms.id
$$;

-- ---------------------------------------------------------------- RV04/RV08: reviewer certificate (own completed reviews only)
create or replace function public.reviewer_certificate(p_venue uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when x.n > 0 then jsonb_build_object(
    'reviewer', (select p.display_name from public.persons p where p.id = private.current_person_id()),
    'orcid', (select p.orcid from public.persons p where p.id = private.current_person_id()),
    'venue', v.name, 'short', coalesce(v.short_name, v.name), 'slug', v.slug::text, 'starts_on', v.starts_on, 'ends_on', v.ends_on,
    'reviews', x.n, 'first_at', x.first_at, 'last_at', x.last_at,
    'chair', (select p.display_name from public.venue_members m join public.persons p on p.id = m.person_id
              where m.venue_id = v.id and m.role in ('chair', 'program_chair', 'owner')
              order by case m.role when 'chair' then 0 when 'program_chair' then 1 else 2 end limit 1))
  end
  from public.venues v,
       lateral (select count(*)::int as n, min(r.submitted_at) as first_at, max(r.submitted_at) as last_at
                from public.review_assignments r join public.submissions s on s.id = r.submission_id
                where s.venue_id = v.id and r.reviewer_id = private.current_person_id() and r.status = 'submitted') x
  where v.id = p_venue and private.current_person_id() is not null
$$;

-- ---------------------------------------------------------------- grants
revoke all on function public.volunteer_to_review(uuid, text[], text, integer), public.withdraw_volunteering(uuid), public.venue_volunteers(uuid),
  public.keyword_pool_counts(uuid, text[]), public.message_handling_editor(uuid, text, text), public.set_annotated_pdf(uuid, text),
  public.bidding_matches(uuid), public.reviewer_certificate(uuid) from public, anon;
grant execute on function public.volunteer_to_review(uuid, text[], text, integer), public.withdraw_volunteering(uuid), public.venue_volunteers(uuid),
  public.keyword_pool_counts(uuid, text[]), public.message_handling_editor(uuid, text, text), public.set_annotated_pdf(uuid, text),
  public.bidding_matches(uuid), public.reviewer_certificate(uuid) to authenticated;
