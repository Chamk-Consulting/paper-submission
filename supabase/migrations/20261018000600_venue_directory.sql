-- Venue directory (PV01) and venue page (PV02): filterable fields, dated milestones, follows.

create type public.venue_format as enum ('in_person', 'hybrid', 'online');
create type public.venue_date_kind as enum ('submission', 'proposal', 'notification', 'conference', 'final', 'registration', 'other');

alter table public.venues
  add column society          text check (char_length(society) <= 60),
  add column field            text check (field in ('control', 'robotics', 'ocean', 'systems')),
  add column format           public.venue_format,
  add column review_mode      text check (char_length(review_mode) <= 60),      -- 'Double-blind', 'Single-blind', 'Committee'
  add column page_limit       text check (char_length(page_limit) <= 40),       -- '6 + 2 pp'
  add column indexed_in       text[] not null default '{}',
  add column accepting        text check (char_length(accepting) <= 200),
  add column city             text check (char_length(city) <= 120),
  add column country          text check (char_length(country) <= 120),
  add column region           text check (region in ('Europe', 'Americas', 'Asia–Pacific', 'Africa & Middle East', 'Online')),
  add column latitude         double precision check (latitude between -90 and 90),
  add column longitude        double precision check (longitude between -180 and 180),
  add column place_hint       text check (char_length(place_hint) <= 80),       -- 'Brussels area'
  add column details          jsonb not null default '{}',                      -- CFP text, topics, types, policies, publication, organizers
  add column papers_count     integer check (papers_count >= 0),                -- past editions
  add column acceptance_rate  numeric(5, 2) check (acceptance_rate between 0 and 100),
  add column best_paper       text check (char_length(best_paper) <= 300),
  add column imported_from    text check (char_length(imported_from) <= 40);


create table public.venue_dates (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid not null references public.venues (id) on delete cascade,
  kind           public.venue_date_kind not null,
  label          text not null check (char_length(label) between 1 and 200),
  starts_at      timestamptz not null,                 -- the deadline instant, or the first day
  ends_at        timestamptz,                          -- multi-day items (conference)
  is_hard        boolean not null default true,
  is_extended    boolean not null default false,
  extended_from  timestamptz,
  created_at     timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index venue_dates_venue_idx on public.venue_dates (venue_id, starts_at);
create index venue_dates_time_idx on public.venue_dates (starts_at);

alter table public.venue_dates enable row level security;
-- Visible whenever the venue itself is visible (the venues RLS decides: published, or you're a member).
create policy venue_dates_select on public.venue_dates for select to anon, authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id));
create policy venue_dates_write on public.venue_dates for all to authenticated
  using ((select private.has_venue_role(venue_id, array['owner', 'chair']::public.venue_role[])))
  with check ((select private.has_venue_role(venue_id, array['owner', 'chair']::public.venue_role[])));

create table public.venue_follows (
  person_id   uuid not null references public.persons (id) on delete cascade,
  venue_id    uuid not null references public.venues (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (person_id, venue_id)
);
create index venue_follows_venue_idx on public.venue_follows (venue_id);

alter table public.venue_follows enable row level security;
create policy venue_follows_own on public.venue_follows for all to authenticated
  using (person_id = (select private.current_person_id()))
  with check (person_id = (select private.current_person_id()));
-- TODO(email): deadline reminders 14/7/1 days before, and on deadline changes, for followers.
