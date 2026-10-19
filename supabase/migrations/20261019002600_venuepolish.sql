-- Venue polish (canvas PV01c, PV01m, PV01p, PV02, VN01):
--  * venues.public_info: Attending / Venue & travel / Gallery content for the public venue page (organizer-edited)
--  * storage bucket 'venue-media' for gallery photos (public read, organizer write under {venue_id}/...)
--  * venue_public_info(slug): public read of that content + the fee table from the setup (anon)
--  * message_venue_organizers(): "Contact organizers" on the venue page -> inbox thread to the right chair
--  * my_venue_status(): "Your status here" card (own papers, reviews, roles at one venue)
--  * venue_archive(slug): past-edition stats + proceedings list (anon, past venues only)
-- Additive only.

-- ---------------------------------------------------------------- venues.public_info
alter table public.venues
  add column if not exists public_info jsonb not null default '{}'::jsonb
    check (jsonb_typeof(public_info) = 'object' and pg_column_size(public_info) <= 65536);
comment on column public.venues.public_info is
  'Public venue page content: {attending:{registration_note,registration_url,visa,grants,hotels_note,keynotes,conduct,accessibility}, travel:{address,summary,directions:[{mode,title,time,note}],hotels:[{name,meta,price}],hotel_code,hotel_deadline}, gallery:[{path,caption,credit}]}';

-- ---------------------------------------------------------------- save (organizers only)
create or replace function public.save_venue_public_info(p_venue uuid, p_info jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_gallery jsonb;
begin
  if private.current_person_id() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not private.is_organizer(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_info is null or jsonb_typeof(p_info) <> 'object' then raise exception 'bad content' using errcode = '22023'; end if;
  if pg_column_size(p_info) > 65536 then raise exception 'too long' using errcode = '22023'; end if;
  v_gallery := coalesce(p_info -> 'gallery', '[]'::jsonb);
  if jsonb_typeof(v_gallery) <> 'array' or jsonb_array_length(v_gallery) > 24 then raise exception 'gallery: up to 24 photos' using errcode = '22023'; end if;
  -- gallery photos must live in this venue's folder of the venue-media bucket
  if exists (select 1 from jsonb_array_elements(v_gallery) g
             where coalesce(g ->> 'path', '') !~ ('^' || p_venue::text || '/[A-Za-z0-9._-]{1,120}$')) then
    raise exception 'gallery: bad photo path' using errcode = '22023';
  end if;
  update public.venues set public_info = p_info where id = p_venue;
end $$;

-- ---------------------------------------------------------------- public read
create or replace function public.venue_public_info(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'info', v.public_info,
    'fees', coalesce(st.fee_types, '[]'::jsonb),
    'currency', coalesce(st.currency, 'USD'),
    'papers_per_registration', st.papers_per_registration,
    'lat', v.latitude, 'lng', v.longitude)
  from public.venues v
  left join public.venue_settings st on st.venue_id = v.id
  where v.slug = p_slug and v.is_published
$$;

-- ---------------------------------------------------------------- gallery storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('venue-media', 'venue-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- folder name -> venue id, null when the first folder is not a uuid
create or replace function private.media_venue(p_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
declare v_first text := split_part(coalesce(p_name, ''), '/', 1);
begin
  if v_first !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  return v_first::uuid;
end $$;
grant execute on function private.media_venue(text) to anon, authenticated;

drop policy if exists venue_media_read on storage.objects;
create policy venue_media_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'venue-media');
drop policy if exists venue_media_insert on storage.objects;
create policy venue_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'venue-media' and private.media_venue(name) is not null and (select private.is_organizer(private.media_venue(name))));
drop policy if exists venue_media_update on storage.objects;
create policy venue_media_update on storage.objects for update to authenticated
  using (bucket_id = 'venue-media' and private.media_venue(name) is not null and (select private.is_organizer(private.media_venue(name))));
drop policy if exists venue_media_delete on storage.objects;
create policy venue_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'venue-media' and private.media_venue(name) is not null and (select private.is_organizer(private.media_venue(name))));

-- ---------------------------------------------------------------- contact organizers (PV02 aside)
-- topic picks the chair: general -> general chair, submissions -> program chairs, publication -> publication chair,
-- registration -> registration chair; falls back to the general/program chairs when nobody holds that role.
create or replace function public.message_venue_organizers(p_venue uuid, p_subject text, p_body text, p_topic text default 'general')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  v_roles public.venue_role[];
  v_to uuid[];
  v_thread uuid;
  v_recent int;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.venues where id = p_venue and is_published) then raise exception 'venue not found' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_body, ''))) < 2 then raise exception 'write a message' using errcode = '22023'; end if;
  if char_length(p_body) > 8000 then raise exception 'message too long' using errcode = '22023'; end if;
  select count(*) into v_recent from public.inbox_messages m join public.inbox_threads t on t.id = m.thread_id
   where m.sender_id = v_me and t.kind = 'message' and t.submission_id is null and m.created_at > now() - interval '1 hour';
  if v_recent >= 3 then raise exception 'too many messages — try again later' using errcode = '53400'; end if;

  v_roles := case coalesce(p_topic, 'general')
    when 'submissions' then array['program_chair', 'deputy_chair']::public.venue_role[]
    when 'publication' then array['publication_chair']::public.venue_role[]
    when 'registration' then array['registration_chair']::public.venue_role[]
    else array['chair', 'owner']::public.venue_role[] end;
  v_to := array(select distinct m.person_id from public.venue_members m
                where m.venue_id = p_venue and m.role = any (v_roles) and m.person_id <> v_me);
  if cardinality(v_to) = 0 then
    v_to := array(select distinct m.person_id from public.venue_members m
                  where m.venue_id = p_venue and m.role in ('chair', 'program_chair', 'owner') and m.person_id <> v_me);
  end if;
  if cardinality(v_to) = 0 then raise exception 'this venue has no chair yet' using errcode = '22023'; end if;

  insert into public.inbox_threads (venue_id, kind, subject, reply_allowed)
  values (p_venue, 'message', left(coalesce(nullif(btrim(p_subject), ''), 'Question about the venue'), 300), true)
  returning id into v_thread;
  insert into public.inbox_messages (thread_id, sender_id, body) values (v_thread, v_me, btrim(p_body));
  insert into public.inbox_participants (thread_id, person_id, read_at) values (v_thread, v_me, now()) on conflict do nothing;
  insert into public.inbox_participants (thread_id, person_id) select v_thread, x from unnest(v_to) x on conflict do nothing;
  return v_thread;
end $$;

-- ---------------------------------------------------------------- your status here (PV02 aside, VN01)
create or replace function public.my_venue_status(p_venue uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (select private.current_person_id() as id)
  select case when (select id from me) is null then null else jsonb_build_object(
    'roles', coalesce((select jsonb_agg(distinct m.role) from public.venue_members m where m.venue_id = p_venue and m.person_id = (select id from me)), '[]'::jsonb),
    'papers', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'number', s.number, 'title', s.title, 'stage', s.stage, 'draft_step', s.draft_step) order by s.updated_at desc)
                        from public.submission_authors a join public.submissions s on s.id = a.submission_id
                        where a.person_id = (select id from me) and s.venue_id = p_venue), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'number', s.number, 'status', r.status, 'due_at', r.due_at) order by r.due_at)
                         from public.review_assignments r join public.submissions s on s.id = r.submission_id
                         where r.reviewer_id = (select id from me) and s.venue_id = p_venue and r.status in ('invited', 'accepted', 'submitted')), '[]'::jsonb)
  ) end
$$;

-- ---------------------------------------------------------------- archive of a past edition (PV01p)
create or replace function public.venue_archive(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v record;
  v_submitted int; v_accepted int; v_countries int;
  v_papers jsonb;
begin
  select id, slug, name, short_name, starts_on, ends_on, papers_count, acceptance_rate, best_paper, imported_from, location, city, country
    into v from public.venues where slug = p_slug and is_published;
  if v.id is null then return null; end if;
  -- archives open once the event is over
  if coalesce(v.ends_on, v.starts_on) is null or coalesce(v.ends_on, v.starts_on) >= current_date then return null; end if;

  select count(*) filter (where s.number is not null and s.stage <> 'withdrawn'),
         count(*) filter (where s.stage in ('final', 'done'))
    into v_submitted, v_accepted
    from public.submissions s where s.venue_id = v.id;
  select count(distinct coalesce(af.country, p.country)) into v_countries
    from public.submissions s join public.submission_authors a on a.submission_id = s.id join public.persons p on p.id = a.person_id
    left join lateral (select country from public.affiliations f where f.person_id = p.id and f.country is not null order by f.starts_on desc nulls last limit 1) af on true
   where s.venue_id = v.id and s.stage in ('final', 'done') and coalesce(af.country, p.country) is not null;
  select coalesce(jsonb_agg(jsonb_build_object('number', s.number, 'title', s.title, 'type', s.paper_type,
           'authors', (select string_agg(ap.display_name, ', ' order by a.position) from public.submission_authors a join public.persons ap on ap.id = a.person_id where a.submission_id = s.id))
           order by s.number), '[]'::jsonb)
    into v_papers from public.submissions s where s.venue_id = v.id and s.stage in ('final', 'done');

  return jsonb_build_object(
    'venue_id', v.id, 'slug', v.slug, 'name', v.name, 'acr', coalesce(v.short_name, v.name), 'starts_on', v.starts_on, 'ends_on', v.ends_on,
    'where', coalesce(v.location, concat_ws(', ', v.city, v.country)), 'imported_from', v.imported_from, 'best_paper', v.best_paper,
    'submitted', case when v_submitted > 0 then v_submitted else v.papers_count end,
    'accepted', case when v_submitted > 0 then v_accepted else null end,
    'acceptance_rate', case when v_submitted > 0 then round(100.0 * v_accepted / v_submitted, 1) else v.acceptance_rate end,
    'countries', nullif(v_countries, 0),
    'papers', v_papers,
    'program_published', private.program_published(v.id));
end $$;

-- ---------------------------------------------------------------- grants
revoke all on function public.save_venue_public_info(uuid, jsonb), public.message_venue_organizers(uuid, text, text, text),
  public.my_venue_status(uuid) from public, anon;
grant execute on function public.save_venue_public_info(uuid, jsonb), public.message_venue_organizers(uuid, text, text, text),
  public.my_venue_status(uuid) to authenticated;
grant execute on function public.venue_public_info(text), public.venue_archive(text) to anon, authenticated;
