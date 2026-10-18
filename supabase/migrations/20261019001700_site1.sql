-- site1 slice: workspace home (WS01), my venue page (VN01).

-- VN01 "Email me venue announcements" (per followed venue)
alter table public.venue_follows add column if not exists email_announcements boolean not null default true;

-- Who to contact at a venue (VN01): organizers only, names + roles, for any signed-in person.
create or replace function public.venue_contacts(p_venue uuid)
returns table (person_id uuid, display_name text, role text)
language sql stable security definer set search_path = '' as $$
  select distinct on (m.role, p.id) p.id, p.display_name, m.role::text
  from public.venue_members m join public.persons p on p.id = m.person_id
  join public.venues v on v.id = m.venue_id
  where m.venue_id = p_venue
    and m.role in ('program_chair', 'chair', 'ceb_chair', 'publication_chair', 'registration_chair', 'owner')
    and private.current_person_id() is not null
    and (v.is_published or private.is_venue_member(p_venue))
  order by m.role, p.id
$$;
revoke all on function public.venue_contacts(uuid) from public, anon;
grant execute on function public.venue_contacts(uuid) to authenticated;

-- Pending co-author confirmations for me (WS01 "CO-AUTHOR" items, CA01 entry point).
create or replace function public.my_coauthor_requests()
returns table (submission_id uuid, number integer, title text, venue_short text, submitted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.number, s.title, coalesce(v.short_name, v.name), s.submitted_at
  from public.submission_authors a
  join public.submissions s on s.id = a.submission_id
  join public.venues v on v.id = s.venue_id
  where a.person_id = private.current_person_id() and a.confirmation = 'pending'
    and s.stage not in ('draft', 'withdrawn', 'rejected') and s.created_by is distinct from a.person_id
  order by s.submitted_at desc nulls last
$$;
revoke all on function public.my_coauthor_requests() from public, anon;
grant execute on function public.my_coauthor_requests() to authenticated;
