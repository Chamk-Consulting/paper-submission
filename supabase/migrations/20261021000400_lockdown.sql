-- Lockdown (fix plan 1.1–1.7, 1.10). Safe to run more than once.
--   1.1  only the payment webhook (service role) can mark invoices paid
--   1.2  submitting needs a published, non-draft venue with an owner (imported listings stay listing-only)
--   1.3  review invites: signed in, the invited account/email, and no conflict of interest to accept
--   1.4  committee invites: accepted only by the invited email (or the invited account)
--   1.5  locked, deleted or merged accounts lose access; locking also bans the Auth user
--   1.6  decisions and desk rejects only for papers that are actually submitted
--   1.7  the old one-click withdraw is gone (only the confirmed withdraw remains)
--   1.10 signed-in-only functions closed to anonymous callers; masked email lookup; venue dates follow venue visibility
-- (Hiding profile fields from other users is in 20261021000500_hide_person_fields.sql — apply it after the app reads its own
--  profile through my_person().)

-- ---------------------------------------------------------------- 1.1 payments
revoke all on function public.stripe_mark_paid(text, uuid) from public, anon, authenticated;
grant execute on function public.stripe_mark_paid(text, uuid) to service_role;

-- ---------------------------------------------------------------- 1.5 who "me" is
-- A locked, deleted or merged account is nobody: every policy and function that asks "who is calling" gets null.
create or replace function private.current_person_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.persons p
  where p.user_id = (select auth.uid()) and p.locked_at is null and p.deleted_at is null and p.merged_into is null
$$;

-- Locking also bans the sign-in (Supabase Auth refuses new sessions and token refreshes); unlocking lifts the ban.
create or replace function public.admin_lock_person(p_person uuid, p_reason text, p_lock boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_me uuid := private.require_admin();
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'give a reason' using errcode = '22023'; end if;
  if p_person = v_me then raise exception 'you cannot lock your own account' using errcode = '22023'; end if;
  if coalesce(p_lock, true) then
    update public.persons set locked_at = now(), locked_reason = left(btrim(p_reason), 300) where id = p_person returning user_id into v_user;
    if not found then raise exception 'not found' using errcode = 'P0002'; end if;
    if v_user is not null then
      if to_regclass('auth.sessions') is not null then
        begin
          execute 'delete from auth.sessions where user_id = $1' using v_user;
        exception when others then raise notice 'session cleanup failed: %', sqlerrm;
        end;
      end if;
      begin
        execute 'update auth.users set banned_until = ''infinity''::timestamptz where id = $1' using v_user;
      exception when others then raise notice 'auth ban failed: %', sqlerrm;
      end;
    end if;
  else
    update public.persons set locked_at = null, locked_reason = null where id = p_person and merged_into is null returning user_id into v_user;
    if not found then raise exception 'not found or merged' using errcode = 'P0002'; end if;
    if v_user is not null then
      begin
        execute 'update auth.users set banned_until = null where id = $1' using v_user;
      exception when others then raise notice 'auth unban failed: %', sqlerrm;
      end;
    end if;
  end if;
  perform private.admin_log(case when coalesce(p_lock, true) then 'person.locked' else 'person.unlocked' end, p_person, null, null, btrim(p_reason));
end $$;

-- accounts locked before this change get the same ban now
do $$
begin
  execute 'update auth.users u set banned_until = ''infinity''::timestamptz from public.persons p
           where p.user_id = u.id and p.locked_at is not null and u.banned_until is distinct from ''infinity''::timestamptz';
exception when others then raise notice 'auth ban backfill skipped: %', sqlerrm;
end $$;

create or replace function public.admin_note(p_action text, p_person uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_action not in ('verification.resent', 'person.signed_out', 'merge.started_by_support') then raise exception 'bad action' using errcode = '22023'; end if;
  if p_action = 'person.signed_out' and to_regclass('auth.sessions') is not null then
    begin
      execute 'delete from auth.sessions where user_id = (select user_id from public.persons where id = $1)' using p_person;
    exception when others then raise notice 'session cleanup failed: %', sqlerrm;
    end;
  end if;
  perform private.admin_log(p_action, p_person, null, null, p_reason);
end $$;

-- ---------------------------------------------------------------- 1.2 open for submissions
-- Open = published + not a draft/closed/archived listing + has an owner + (a deadline ahead, or a journal).
create or replace function private.venue_open(p_venue uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.venues v
                 where v.id = p_venue and v.is_published and coalesce(v.status, '') not in ('draft', 'closed', 'archived'))
     and exists (select 1 from public.venue_members m where m.venue_id = p_venue and m.role = 'owner')
     and (
       private.venue_deadline(p_venue) is not null
       or exists (select 1 from public.venues v where v.id = p_venue and v.kind = 'journal')
     )
$$;

-- ---------------------------------------------------------------- 1.3 conflicts of interest
-- True when the person must not review the paper: an author, a conflict the authors listed (person or the person's
-- current institution), a "conflict" bid, or a conflict either side declared on their profile (unless expired).
-- A chair-approved override clears every reason except authorship.
create or replace function private.has_conflict(p_person uuid, p_submission uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_person is not null and (
    exists (select 1 from public.submission_authors a where a.submission_id = p_submission and a.person_id = p_person)
    or (
      not exists (select 1 from public.conflict_overrides o
                  where o.submission_id = p_submission and o.person_id = p_person and o.status = 'approved')
      and (
        exists (select 1 from public.submission_conflicts c where c.submission_id = p_submission and c.person_id = p_person)
        or exists (select 1 from public.submission_conflicts c join public.affiliations f on f.person_id = p_person and f.ends_on is null
                   where c.submission_id = p_submission and c.person_id is null and c.institution is not null
                     and lower(btrim(c.institution)) = lower(btrim(f.institution)))
        or exists (select 1 from public.bids b where b.submission_id = p_submission and b.person_id = p_person and b.level = 'conflict')
        or exists (select 1 from public.declared_conflicts d join public.submission_authors a on a.submission_id = p_submission
                   where (d.until_year is null or d.until_year >= extract(year from now()))
                     and ((d.person_id = p_person and d.other_person = a.person_id)
                          or (d.person_id = a.person_id and d.other_person = p_person)))
      )
    )
  )
$$;
revoke all on function private.has_conflict(uuid, uuid) from public, anon, authenticated;

-- Is one of my verified addresses this email?
create or replace function private.my_verified_email(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_email is not null and exists (
    select 1 from public.person_emails e
    where e.person_id = (select private.current_person_id()) and e.verified_at is not null
      and lower(e.email::text) = lower(btrim(p_email)))
$$;
revoke all on function private.my_verified_email(text) from public, anon;
grant execute on function private.my_verified_email(text) to authenticated;

-- ---------------------------------------------------------------- 1.3 review invitations
-- Declining by the emailed link still works without signing in. Accepting needs: signed in, the invited account (or one
-- of my verified emails is the invited address), the no-conflict box, and no recorded conflict.
create or replace function public.respond_review_invitation(p_assignment uuid, p_token_hash text, p_accept boolean, p_coi boolean,
  p_reason text default null, p_suggestion text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  r public.review_assignments;
  v_me uuid := private.current_person_id();
begin
  select * into r from public.review_assignments
   where (p_token_hash is not null and token_hash = p_token_hash) or (p_token_hash is null and id = p_assignment) for update;
  if r.id is null then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if p_token_hash is null and (v_me is null or r.reviewer_id is distinct from v_me) then raise exception 'not your invitation' using errcode = '42501'; end if;
  if r.status <> 'invited' then return r.status; end if;
  if r.reply_by < now() then update public.review_assignments set status = 'expired' where id = r.id; return 'expired'; end if;
  if p_accept then
    if v_me is null then raise exception 'sign in to accept this review' using errcode = '42501'; end if;
    if r.reviewer_id is not null and r.reviewer_id <> v_me then
      raise exception 'this invitation is for another account' using errcode = '42501';
    end if;
    if r.reviewer_id is null and not private.my_verified_email(r.invited_email::text) then
      raise exception 'this invitation was sent to another email address — add and verify it on your account first' using errcode = '42501';
    end if;
    if not coalesce(p_coi, false) then raise exception 'confirm you have no conflict of interest' using errcode = '22023'; end if;
    if private.has_conflict(v_me, r.submission_id) then
      raise exception 'you have a conflict of interest with this paper' using errcode = '42501';
    end if;
    if exists (select 1 from public.review_assignments x where x.submission_id = r.submission_id and x.round = r.round
               and x.reviewer_id = v_me and x.id <> r.id and x.status in ('accepted', 'submitted')) then
      raise exception 'you already review this paper' using errcode = '23505';
    end if;
    perform 1 from public.submissions where id = r.submission_id for update;   -- one ordinal at a time per paper
    update public.review_assignments set status = 'accepted', responded_at = now(), coi_confirmed_at = now(),
      reviewer_id = v_me,
      ordinal = (select coalesce(max(x.ordinal), 0) + 1 from public.review_assignments x where x.submission_id = r.submission_id and x.round = r.round)
    where id = r.id;
    insert into public.reviews (assignment_id) values (r.id) on conflict do nothing;
  else
    update public.review_assignments set status = 'declined', responded_at = now(),
      decline_reason = coalesce(p_reason, 'other'), decline_suggestion = nullif(btrim(coalesce(p_suggestion, '')), '')
    where id = r.id;
  end if;
  insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id, details)
  select case when p_accept then v_me else coalesce(v_me, r.reviewer_id) end, s.venue_id,
         case when p_accept then 'review.accepted' else 'review.declined' end, 'submission', s.id,
         jsonb_build_object('assignment', r.id, 'reason', p_reason)
  from public.submissions s where s.id = r.submission_id;
  return case when p_accept then 'accepted' else 'declined' end;
end $$;
revoke all on function public.respond_review_invitation(uuid, text, boolean, boolean, text, text) from public;
grant execute on function public.respond_review_invitation(uuid, text, boolean, boolean, text, text) to anon, authenticated;

-- ---------------------------------------------------------------- 1.4 committee invitations
create or replace function public.respond_invitation(p_token_hash text, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  i public.invitations;
  v_me uuid := private.current_person_id();
  v_mine boolean;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into i from public.invitations where token_hash = p_token_hash for update;
  if i.id is null then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if i.status <> 'pending' then return i.status; end if;
  if i.expires_at < now() then update public.invitations set status = 'expired' where id = i.id; return 'expired'; end if;
  if i.person_id is not null and i.person_id <> v_me then raise exception 'this invitation is for another account' using errcode = '42501'; end if;
  v_mine := coalesce(i.person_id = v_me, false) or coalesce(private.my_verified_email(i.email::text), false);
  if p_accept and not v_mine then
    raise exception 'this invitation was sent to another email address — add and verify it on your account first' using errcode = '42501';
  end if;
  update public.invitations set status = case when p_accept then 'accepted' else 'declined' end,
    person_id = case when v_mine then v_me else person_id end, responded_at = now()
  where id = i.id;
  if p_accept then
    insert into public.venue_members (venue_id, person_id, role, load_cap, invited_by)
    values (i.venue_id, v_me, i.role, i.load_cap, i.invited_by) on conflict do nothing;
  end if;
  insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id, details)
  values (v_me, i.venue_id, case when p_accept then 'role.accepted' else 'role.declined' end, 'invitation', i.id, jsonb_build_object('role', i.role));
  return case when p_accept then 'accepted' else 'declined' end;
end $$;
revoke all on function public.respond_invitation(text, boolean) from public, anon;
grant execute on function public.respond_invitation(text, boolean) to authenticated;

-- ---------------------------------------------------------------- 1.6 decisions
create or replace function public.set_decision(p_submission uuid, p_decision text, p_reason text default null, p_letter text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  v_min int;
  v_in int;
begin
  select * into s from public.submissions where id = p_submission for update;
  if s.id is null or not private.is_venue_chair(s.venue_id) or private.is_submission_author(p_submission) then
    raise exception 'only a program chair without a conflict decides (F1, B1)' using errcode = '42501';
  end if;
  if s.stage in ('draft', 'withdrawn') then
    raise exception 'this paper is not submitted (it is %)', s.stage using errcode = '22023';
  end if;
  if exists (select 1 from public.decisions d where d.submission_id = p_submission and d.released_at is not null)
     and not private.is_venue_owner(s.venue_id) then
    raise exception 'released decisions change only with owner approval (F5)' using errcode = '42501';
  end if;
  if p_decision is null then delete from public.decisions where submission_id = p_submission and released_at is null; return; end if;
  if p_decision = 'desk_reject' and s.stage not in ('submitted', 'review') then
    raise exception 'desk reject is only for papers waiting for or in review' using errcode = '22023';
  end if;
  if p_decision <> 'desk_reject' then
    select min_reviews into v_min from public.venue_settings where venue_id = s.venue_id;
    select count(*) into v_in from public.review_assignments r where r.submission_id = p_submission and r.status = 'submitted' and r.round = 1;
    if v_in < v_min then raise exception 'needs % reviews (has %) (F2)', v_min, v_in using errcode = '22023'; end if;
  end if;
  insert into public.decisions (submission_id, decision, reason, letter, drafted_by, drafted_at)
  values (p_submission, p_decision, p_reason, p_letter, private.current_person_id(), now())
  on conflict (submission_id) do update set decision = excluded.decision, reason = excluded.reason, letter = excluded.letter,
    drafted_by = excluded.drafted_by, drafted_at = now();
  if p_decision = 'desk_reject' then   -- desk rejects go out at once
    update public.decisions set released_at = now() where submission_id = p_submission;
    update public.submissions set stage = 'rejected', stage_detail = 'Desk rejected', updated_at = now() where id = p_submission;
    update public.review_assignments set status = 'cancelled' where submission_id = p_submission and status in ('invited', 'accepted');
  end if;
  perform private.log(s.venue_id, 'decision.' || p_decision, 'submission', p_submission, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.release_decisions(p_venue uuid, p_paper_type text default null, p_confirm_large boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_batch uuid;
  v_n int;
begin
  if not private.has_venue_role(p_venue, array['owner', 'chair', 'program_chair']::public.venue_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.submissions s left join public.decisions d on d.submission_id = s.id
             where s.venue_id = p_venue and s.stage in ('submitted', 'review', 'decision') and (p_paper_type is null or s.paper_type = p_paper_type)
               and d.submission_id is null) then
    raise exception 'undecided papers block the release' using errcode = '22023';
  end if;
  select count(*) into v_n from public.decisions d join public.submissions s on s.id = d.submission_id
   where s.venue_id = p_venue and d.released_at is null and s.stage not in ('draft', 'withdrawn')
     and (p_paper_type is null or s.paper_type = p_paper_type);
  if v_n > 500 and not coalesce(p_confirm_large, false) then raise exception 'confirm twice to send more than 500 letters (I3)' using errcode = '22023'; end if;
  insert into public.decision_batches (venue_id, scope, paper_type, released_at, released_by, recipients)
  values (p_venue, case when p_paper_type is null then 'all' else 'by_type' end, p_paper_type, now(), private.current_person_id(), v_n)
  returning id into v_batch;
  update public.decisions d set released_at = now(), batch_id = v_batch,
    revision_due_at = case when d.decision = 'conditional' then now() + interval '30 days' end
  from public.submissions s
  where s.id = d.submission_id and s.venue_id = p_venue and d.released_at is null and s.stage not in ('draft', 'withdrawn')
    and (p_paper_type is null or s.paper_type = p_paper_type);
  update public.submissions s set
    stage = case d.decision when 'conditional' then 'revise'::public.submission_stage when 'reject' then 'rejected'::public.submission_stage
                            else 'final'::public.submission_stage end,
    stage_detail = case d.decision when 'accept_oral' then 'Accepted · oral' when 'accept_poster' then 'Accepted · poster'
                                   when 'conditional' then 'Conditionally accepted' else 'Not accepted' end,
    updated_at = now()
  from public.decisions d where d.submission_id = s.id and d.batch_id = v_batch and s.stage not in ('draft', 'withdrawn');
  update public.review_assignments r set locked_at = now()
  from public.decisions d where d.batch_id = v_batch and r.submission_id = d.submission_id and r.locked_at is null;
  perform private.log(p_venue, 'decision.released', 'venue', p_venue, jsonb_build_object('count', v_n, 'type', p_paper_type));
  return v_n;
end $$;

-- ---------------------------------------------------------------- 1.7 old withdraw
drop function if exists public.withdraw_paper(uuid);

-- ---------------------------------------------------------------- 1.10 anonymous callers
-- Functions that only make sense signed in. (Public pages, token links, unsubscribe, contact and account help stay open.)
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_event(jsonb)',
    'public.go_live_checks(uuid)',
    'public.invite_member(uuid, text, uuid, public.venue_role, text, integer, text)',
    'public.issue_unsub_tokens(uuid, jsonb)',
    'public.my_events()',
    'public.open_submissions(uuid, boolean)',
    'public.remove_member(uuid, uuid, public.venue_role)',
    'public.save_milestones(uuid, jsonb)',
    'public.set_section_status(uuid, text, text)',
    'public.venue_people(uuid)',
    'public.find_person(text)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- 1.10 email lookup without harvesting
-- By Plenary ID: name, institution and ID as before. By email: only the person id and initials, so an email list can't be
-- turned into names and affiliations. Deleted and merged accounts are never returned.
create or replace function public.find_person(p_query text)
returns table(person_id uuid, display_name text, institution text, plenary_id text)
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(btrim(coalesce(p_query, '')));
begin
  if private.current_person_id() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if q ~ '^pl-\d{4}-\d{4}$' then
    return query select p.id, p.display_name,
      (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1), p.plenary_id
      from public.persons p where lower(p.plenary_id) = q and p.deleted_at is null and p.merged_into is null;
  elsif q ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return query select p.id,
      btrim(upper(left(coalesce(p.given_name, ''), 1)) || '. ' || upper(left(coalesce(p.family_name, ''), 1)) || '.'),
      null::text, null::text
      from public.person_emails e join public.persons p on p.id = e.person_id
      where e.email = q::extensions.citext and p.deleted_at is null and p.merged_into is null;
  end if;
end $$;
revoke all on function public.find_person(text) from public, anon;
grant execute on function public.find_person(text) to authenticated, service_role;

-- ---------------------------------------------------------------- 1.10 venue dates follow venue visibility
-- Written out instead of relying on the venues policy underneath, so a policy change there can't expose draft dates.
drop policy if exists venue_dates_select on public.venue_dates;
drop policy if exists venue_dates_select_anon on public.venue_dates;
drop policy if exists venue_dates_select_auth on public.venue_dates;
create policy venue_dates_select_anon on public.venue_dates for select to anon
  using (exists (select 1 from public.venues v where v.id = venue_dates.venue_id and v.is_published));
create policy venue_dates_select_auth on public.venue_dates for select to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_dates.venue_id
                 and (v.is_published or (select private.is_venue_member(v.id)))));
