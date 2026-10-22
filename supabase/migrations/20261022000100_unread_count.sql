-- Unread inbox count for the header badge (one number instead of the whole inbox on every page).
create or replace function public.my_unread_count()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from public.inbox_participants pa
  join lateral (select max(x.created_at) as last_at from public.inbox_messages x where x.thread_id = pa.thread_id) m on true
  where pa.person_id = private.current_person_id() and pa.archived_at is null
    and m.last_at is not null and (pa.read_at is null or pa.read_at < m.last_at)
$$;
revoke all on function public.my_unread_count() from public, anon;
grant execute on function public.my_unread_count() to authenticated;
