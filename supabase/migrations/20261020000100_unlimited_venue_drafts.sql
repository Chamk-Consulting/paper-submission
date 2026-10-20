-- ---------------------------------------------------------------- 1. drafts: no cap for venues marked "unlimited"
create or replace function public.create_draft(p_venue uuid, p_paper_type text, p_track text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_person uuid := private.current_person_id();
  v_id uuid;
begin
  if v_person is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not private.venue_open(p_venue) then raise exception 'submissions are closed' using errcode = '22023'; end if;
  if coalesce(btrim(p_paper_type), '') = '' or char_length(p_paper_type) > 80 then raise exception 'choose a type' using errcode = '22023'; end if;
  if coalesce((select (v.details ->> 'unlimited')::boolean from public.venues v where v.id = p_venue), false) is not true
     and (select count(*) from public.submissions s join public.submission_authors a on a.submission_id = s.id
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

