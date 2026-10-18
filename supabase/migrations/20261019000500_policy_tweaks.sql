-- Program and deputy chairs edit event basics and dates too (not only owner/general chair).
drop policy if exists venues_update on public.venues;
create policy venues_update on public.venues for update to authenticated
  using ((select private.is_venue_chair(id))) with check ((select private.is_venue_chair(id)));

drop policy if exists venue_dates_write on public.venue_dates;
create policy venue_dates_write on public.venue_dates for all to authenticated
  using ((select private.is_venue_chair(venue_id))) with check ((select private.is_venue_chair(venue_id)));

-- Inbox copy of an email (I2), callable by organizers and handling AEs for people at their event.
create or replace function public.notify_people(p_venue uuid, p_people uuid[], p_kind text, p_subject text, p_body text,
                                                p_submission uuid default null, p_cta_label text default null, p_cta_url text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not (private.is_organizer(p_venue) or (p_submission is not null and private.handles_paper(p_submission))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind not in ('decision', 'invite', 'coauthor', 'venue', 'system', 'message') then raise exception 'bad kind' using errcode = '22023'; end if;
  return private.notify(p_people, p_kind, p_subject, p_body, p_venue, p_submission, p_cta_label, p_cta_url,
    (select coalesce(v.short_name, v.name) from public.venues v where v.id = p_venue), false);
end $$;
revoke all on function public.notify_people(uuid, uuid[], text, text, text, uuid, text, text) from public, anon;
grant execute on function public.notify_people(uuid, uuid[], text, text, text, uuid, text, text) to authenticated;

-- People's primary email for sending (organizers of an event, for people at that event; handling AE for reviewers they invite).
create or replace function public.people_emails(p_venue uuid, p_people uuid[])
returns table (person_id uuid, email text, given_name text, display_name text, locale text)
language sql stable security definer set search_path = '' as $$
  select p.id, (select e.email::text from public.person_emails e where e.person_id = p.id and e.is_primary limit 1), p.given_name, p.display_name, p.locale
  from public.persons p
  where p.id = any (p_people)
    and (private.is_organizer(p_venue) or exists (select 1 from public.venue_members m where m.venue_id = p_venue and m.person_id = private.current_person_id() and m.role = 'associate_editor'))
$$;
revoke all on function public.people_emails(uuid, uuid[]) from public, anon;
grant execute on function public.people_emails(uuid, uuid[]) to authenticated;
