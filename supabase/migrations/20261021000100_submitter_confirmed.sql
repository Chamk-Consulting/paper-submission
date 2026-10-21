-- The person who submits a paper has confirmed their own authorship by submitting.
-- submit_paper never set it (only a one-time backfill did), so submitters were asked to "confirm you are a co-author".
create or replace function private.confirm_submitter()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.submitted_at is not null and old.submitted_at is null then
    update public.submission_authors
       set confirmation = 'confirmed', responded_at = coalesce(responded_at, new.submitted_at)
     where submission_id = new.id and confirmation = 'pending'
       and person_id in (new.created_by, private.current_person_id());
  end if;
  return new;
end $$;

drop trigger if exists submissions_confirm_submitter on public.submissions;
create trigger submissions_confirm_submitter after update of submitted_at on public.submissions
  for each row execute function private.confirm_submitter();

-- backfill papers submitted since the first backfill
update public.submission_authors a set confirmation = 'confirmed', responded_at = coalesce(a.responded_at, s.submitted_at)
from public.submissions s
where s.id = a.submission_id and a.person_id = s.created_by and s.submitted_at is not null and a.confirmation = 'pending';
