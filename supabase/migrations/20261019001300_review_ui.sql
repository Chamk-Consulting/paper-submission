-- Reviewer screens (RV01–RV10): read models the reviewer UI needs that RLS alone can't give
-- (venue_settings and decisions are not readable by reviewers), plus two small reviewer actions.
-- Additive only.

-- ---------------------------------------------------------------- RV03–RV09: everything about one of my assignments
create or replace function public.review_form(p_assignment uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  r public.review_assignments;
  s public.submissions;
  v public.venues;
  st public.venue_settings;
  w public.reviews;
  d public.decisions;
  v_total int;
begin
  select * into r from public.review_assignments where id = p_assignment;
  if r.id is null or v_me is null or r.reviewer_id is distinct from v_me then return null; end if;
  select * into s from public.submissions where id = r.submission_id;
  select * into v from public.venues where id = s.venue_id;
  select * into st from public.venue_settings where venue_id = v.id;
  select * into w from public.reviews where assignment_id = r.id;
  select * into d from public.decisions where submission_id = s.id and released_at is not null;
  select count(*) into v_total from public.review_assignments x
   where x.submission_id = s.id and x.round = r.round and x.status in ('invited', 'accepted', 'submitted');

  return jsonb_build_object(
    'assignment', jsonb_build_object(
      'id', r.id, 'submission_id', s.id, 'round', r.round, 'ordinal', r.ordinal, 'total', v_total,
      'status', case when r.status = 'invited' and r.reply_by < now() then 'expired' else r.status end,
      'reply_by', r.reply_by, 'due_at', r.due_at, 'responded_at', r.responded_at, 'submitted_at', r.submitted_at,
      'receipt', r.receipt, 'locked_at', r.locked_at, 'orcid_push', r.orcid_push,
      'editor_rating', case when d.submission_id is not null then r.editor_rating end,
      'editor_tags', case when d.submission_id is not null then to_jsonb(r.editor_tags) else '[]'::jsonb end),
    'venue', jsonb_build_object('id', v.id, 'name', v.name, 'short', coalesce(v.short_name, v.name), 'slug', v.slug::text, 'timezone', v.timezone),
    'paper', jsonb_build_object(
      'number', s.number, 'title', s.title, 'abstract', s.abstract, 'keywords', to_jsonb(coalesce(s.keywords, '{}'::text[])),
      'paper_type', s.paper_type, 'stage', s.stage::text, 'withdrawn_at', s.withdrawn_at,
      'pages', (select f.pages from public.submission_files f where f.submission_id = s.id and f.role = 'paper' and f.is_current limit 1),
      'version', (select max(f.version) from public.submission_files f where f.submission_id = s.id and f.role = 'paper'),
      'pdf_path', case when r.status in ('accepted', 'submitted') then
        (select f.storage_path from public.submission_files f where f.submission_id = s.id and f.role = 'paper' and f.is_current
          order by f.version desc limit 1) end),
    'settings', jsonb_build_object(
      'criteria', coalesce(st.criteria, '[]'::jsonb), 'blind_type', coalesce(st.blind_type, 'double'),
      'ai_policy', coalesce(st.ai_policy, 'language_only'), 'named_discussion', coalesce(st.named_discussion, false),
      'discussion', coalesce(st.discussion, true), 'round2', coalesce(st.round2, true)),
    'ae', (select p.display_name from public.persons p where p.id = coalesce(s.handling_ae, r.invited_by)),
    'review', case when w.assignment_id is null then null else jsonb_build_object(
      'scores', w.scores, 'recommendation', w.recommendation, 'confidence', w.confidence, 'to_authors', w.to_authors,
      'to_editor', w.to_editor, 'round2', w.round2, 'remaining_concerns', w.remaining_concerns,
      'updated_at', w.updated_at, 'submitted_at', w.submitted_at) end,
    -- round 2: my earlier review for this paper and the authors' answers to it
    'previous', (select jsonb_build_object('assignment_id', p.id, 'to_authors', pw.to_authors, 'recommendation', pw.recommendation)
                 from public.review_assignments p join public.reviews pw on pw.assignment_id = p.id
                 where p.submission_id = s.id and p.reviewer_id = v_me and p.round < r.round order by p.round desc limit 1),
    'responses', coalesce((select jsonb_agg(jsonb_build_object('n', a.comment_no, 'quote', a.quote, 'response', a.response, 'where', a.changed_in)
                 order by a.comment_no nulls last)
                 from public.author_responses a
                 where a.submission_id = s.id and a.kind = 'revision'
                   and (a.assignment_id is null or a.assignment_id in (select x.id from public.review_assignments x
                        where x.submission_id = s.id and x.reviewer_id = v_me))), '[]'::jsonb),
    'extension', (select jsonb_build_object('id', e.id, 'option', e.option, 'status', e.status, 'requested_until', e.requested_until,
                    'offered_until', e.offered_until, 'editor_message', e.editor_message, 'created_at', e.created_at)
                  from public.extension_requests e where e.assignment_id = r.id order by e.created_at desc limit 1),
    'reminders', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'at', m.sent_at) order by m.sent_at)
                  from public.review_reminders m where m.assignment_id = r.id), '[]'::jsonb),
    'notes_in_review', (select count(*) from public.review_notes n where n.assignment_id = r.id and n.in_review),
    'dates', jsonb_build_object(
      'decisions', (select x.starts_at from public.venue_dates x where x.venue_id = v.id and x.key = 'decisions'),
      'discussion_close', (select x.starts_at from public.venue_dates x where x.venue_id = v.id and x.key = 'discussion_close')),
    'decision', case when d.submission_id is null then null else jsonb_build_object(
      'decision', d.decision, 'editor_summary', d.editor_summary, 'released_at', d.released_at) end
  );
end $$;

-- ---------------------------------------------------------------- RV04 / RV08: ORCID credit toggle
create or replace function public.set_review_orcid(p_assignment uuid, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.review_assignments set orcid_push = coalesce(p_on, false)
   where id = p_assignment and reviewer_id = private.current_person_id();
  if not found then raise exception 'not your review' using errcode = '42501'; end if;
end $$;

-- ---------------------------------------------------------------- RV06: withdraw my pending extension request
create or replace function public.cancel_extension(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.extension_requests e set status = 'cancelled'
    from public.review_assignments r
   where e.id = p_request and r.id = e.assignment_id and r.reviewer_id = private.current_person_id()
     and e.status in ('pending', 'counter_offered');
  if not found then raise exception 'nothing to cancel' using errcode = '42501'; end if;
end $$;

-- ---------------------------------------------------------------- RV01 aside: my year + open bidding
create or replace function public.reviewer_overview()
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (select private.current_person_id() id),
  mine as (select r.* from public.review_assignments r, me where r.reviewer_id = me.id),
  yr as (select * from mine where coalesce(submitted_at, due_at) >= date_trunc('year', now()))
  select jsonb_build_object(
    'submitted', (select count(*) from yr where status = 'submitted'),
    'due', (select count(*) from mine where status = 'accepted'),
    'invited', (select count(*) from mine where status = 'invited' and reply_by >= now()),
    'on_time_pct', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where submitted_at <= due_at) / count(*)) end
                    from yr where status = 'submitted'),
    'bidding', coalesce((select jsonb_agg(jsonb_build_object('slug', v.slug::text, 'name', coalesce(v.short_name, v.name),
                 'closes_at', (select x.starts_at from public.venue_dates x where x.venue_id = v.id and x.key = 'bidding_close'),
                 'bids', (select count(*) from public.bids b join public.submissions s on s.id = b.submission_id, me
                          where s.venue_id = v.id and b.person_id = me.id)))
               from public.venues v join public.venue_settings st on st.venue_id = v.id
               where st.bidding and private.has_venue_role(v.id, array['reviewer', 'associate_editor']::public.venue_role[])
                 and coalesce((select x.starts_at from public.venue_dates x where x.venue_id = v.id and x.key = 'bidding_close'), 'infinity') > now()),
               '[]'::jsonb))
$$;

-- ---------------------------------------------------------------- RV10: the venue behind /reviews/bidding/[slug]
create or replace function public.bidding_venue(p_slug text)
returns table (venue_id uuid, name text, open boolean, closes_at timestamptz, blind_type text)
language sql stable security definer set search_path = '' as $$
  select v.id, coalesce(v.short_name, v.name),
         st.bidding and coalesce(x.starts_at, 'infinity') > now(), x.starts_at, st.blind_type
  from public.venues v
  join public.venue_settings st on st.venue_id = v.id
  left join public.venue_dates x on x.venue_id = v.id and x.key = 'bidding_close'
  where v.slug::text = p_slug
    and private.has_venue_role(v.id, array['reviewer', 'associate_editor']::public.venue_role[])
$$;

revoke all on function public.review_form(uuid), public.set_review_orcid(uuid, boolean), public.cancel_extension(uuid),
  public.reviewer_overview(), public.bidding_venue(text) from public, anon;
grant execute on function public.review_form(uuid), public.set_review_orcid(uuid, boolean), public.cancel_extension(uuid),
  public.reviewer_overview(), public.bidding_venue(text) to authenticated;
