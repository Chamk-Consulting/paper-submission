-- A submission type's own deadline (submission_types.deadline_at) wins, earlier or later than the event's paper
-- deadline (e.g. CoDIT work-in-progress papers close 27 April, after regular papers on 2 February).
-- Types without one follow the event's dates as before.
create or replace function private.type_deadline(p_venue uuid, p_type text)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.submission_types t where t.venue_id = p_venue and t.name = p_type and t.deadline_at is not null)
      then (select t.deadline_at from public.submission_types t where t.venue_id = p_venue and t.name = p_type and t.deadline_at > now())
    else (select min(d.starts_at) from public.venue_dates d
          where d.venue_id = p_venue and d.starts_at > now() and d.kind::text = private.date_kind_for(p_venue, p_type))
  end
$$;
