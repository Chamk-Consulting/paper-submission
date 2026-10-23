-- Real (imported) events only accept papers when they have an owner. A clearly named demo organizer with no login
-- owns every real event that has no owner yet, so submissions open on events whose deadline hasn't passed.
-- When the real organizers join, add them as owners and remove this person from venue_members.
do $$
declare p uuid;
begin
  select id into p from public.persons where given_name = 'Plenary' and family_name = 'Demo Organizer' and user_id is null limit 1;
  if p is null then
    insert into public.persons (given_name, family_name, is_public) values ('Plenary', 'Demo Organizer', false) returning id into p;
  end if;
  insert into public.venue_members (venue_id, person_id, role)
  select v.id, p, 'owner' from public.venues v
  where v.slug <> 'plenary-sandbox-2027'
    and not exists (select 1 from public.venue_members m where m.venue_id = v.id and m.role = 'owner')
  on conflict do nothing;
end $$;
