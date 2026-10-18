-- Storage buckets. Paper policies are added with the papers tables (week 3).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('papers', 'papers', false, 52428800, array['application/pdf', 'application/zip', 'video/mp4']),
  ('public-assets', 'public-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- public-assets: anyone reads (bucket is public); owners/chairs of a venue upload under venues/{venue_id}/...
create policy public_assets_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = 'venues'
    and (select private.has_venue_role(((storage.foldername(name))[2])::uuid, array['owner', 'chair']::public.venue_role[]))
  );
create policy public_assets_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = 'venues'
    and (select private.has_venue_role(((storage.foldername(name))[2])::uuid, array['owner', 'chair']::public.venue_role[]))
  );
-- 'papers' bucket: no policies yet = no client access at all (deny by default).
