-- Supabase blocks deleting storage.objects rows from SQL (protect_objects_delete), so delete_draft failed on live.
-- The app now removes the draft's files through the Storage API first (papers_delete policy: the draft's author),
-- and this function only deletes the database row.
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
  delete from public.submissions where id = p_submission;
  insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id)
  values (v_me, s.venue_id, 'submission.draft_deleted', 'submission', p_submission);
end $$;
revoke all on function public.delete_draft(uuid) from public, anon;
grant execute on function public.delete_draft(uuid) to authenticated;

-- Contact form: also limit per sender IP (the web app puts a hash of it in details.ip_hash), not only per email address,
-- so rotating addresses can't be used to send confirmation emails in bulk.
create or replace function public.submit_contact(p_kind text, p_topic text, p_name text, p_email text, p_subject text, p_body text, p_details jsonb, p_allow_access boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v_ref text; v_ip text := nullif(coalesce(p_details, '{}') ->> 'ip_hash', '');
begin
  if p_kind not in ('support', 'sales') then raise exception 'bad kind' using errcode = '22023'; end if;
  if (select count(*) from public.contact_messages where email = p_email::extensions.citext and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many messages — try again later' using errcode = '53400';
  end if;
  if v_ip is not null and (select count(*) from public.contact_messages where details ->> 'ip_hash' = v_ip and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many messages — try again later' using errcode = '53400';
  end if;
  v_ref := case p_kind when 'support' then 'SUP-' else 'SAL-' end || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
  insert into public.contact_messages (reference, kind, topic, name, email, person_id, subject, body, details, allow_access)
  values (v_ref, p_kind, p_topic, nullif(btrim(coalesce(p_name, '')), ''), p_email, private.current_person_id(), nullif(btrim(coalesce(p_subject, '')), ''),
          btrim(p_body), coalesce(p_details, '{}'), coalesce(p_allow_access, false));
  return v_ref;
end $$;
