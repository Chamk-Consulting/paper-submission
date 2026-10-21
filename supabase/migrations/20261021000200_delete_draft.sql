-- Authors can delete a draft they started (never a submitted paper). Uploaded files are removed from storage too.
create or replace function public.delete_draft(p_submission uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  s public.submissions;
begin
  if v_me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into s from public.submissions where id = p_submission for update;
  if s.id is null or s.created_by is distinct from v_me then raise exception 'not your draft' using errcode = '42501'; end if;
  if s.stage <> 'draft' or s.submitted_at is not null then raise exception 'only drafts can be deleted' using errcode = '22023'; end if;
  delete from storage.objects where bucket_id = 'papers' and (storage.foldername(name))[1] = p_submission::text;
  delete from public.submissions where id = p_submission;
  insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id)
  values (v_me, s.venue_id, 'submission.draft_deleted', 'submission', p_submission);
end $$;
revoke all on function public.delete_draft(uuid) from public, anon;
grant execute on function public.delete_draft(uuid) to authenticated;
