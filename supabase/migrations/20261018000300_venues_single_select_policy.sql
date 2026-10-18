-- Performance advisor: one permissive SELECT policy per role on venues.
drop policy venues_select_public on public.venues;
drop policy venues_select_member on public.venues;
create policy venues_select_anon on public.venues for select to anon using (is_published);
create policy venues_select_auth on public.venues for select to authenticated
  using (is_published or (select private.is_venue_member(id)));
