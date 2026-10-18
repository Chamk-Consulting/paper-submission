-- IN02 from an author's paper: "Message the program chair".
-- Authors can't see who the chairs are, so the recipients are picked here.
create or replace function public.message_chairs(p_submission uuid, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  v_venue uuid;
  v_to uuid[];
  v_thread uuid;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not private.is_submission_author(p_submission) then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_body, ''))) < 2 then raise exception 'write a message' using errcode = '22023'; end if;
  select venue_id into v_venue from public.submissions where id = p_submission;
  v_to := array(select distinct m.person_id from public.venue_members m
                where m.venue_id = v_venue and m.role in ('chair', 'program_chair', 'owner') and m.person_id <> v_me);
  if cardinality(v_to) = 0 then raise exception 'this venue has no chair yet' using errcode = '22023'; end if;
  insert into public.inbox_threads (venue_id, submission_id, kind, subject, reply_allowed)
  values (v_venue, p_submission, 'message', left(coalesce(nullif(btrim(p_subject), ''), 'Question about my paper'), 300), true)
  returning id into v_thread;
  insert into public.inbox_messages (thread_id, sender_id, body) values (v_thread, v_me, left(btrim(p_body), 8000));
  insert into public.inbox_participants (thread_id, person_id, read_at) values (v_thread, v_me, now()) on conflict do nothing;
  insert into public.inbox_participants (thread_id, person_id) select v_thread, x from unnest(v_to) x on conflict do nothing;
  return v_thread;
end $$;
revoke all on function public.message_chairs(uuid, text, text) from public, anon;
grant execute on function public.message_chairs(uuid, text, text) to authenticated;
