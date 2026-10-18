-- Plenary · core identity, venues, roles, audit
-- People (persons) are separate from logins (auth.users): a person can exist
-- before signing up (e.g. a co-author added by email) and claims it later.

create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------- types
create type public.venue_role as enum ('owner', 'chair', 'associate_editor', 'reviewer', 'author', 'staff');
create type public.venue_kind as enum ('conference', 'workshop', 'journal', 'award');

-- ---------------------------------------------------------------- helpers
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- persons
create table public.persons (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references auth.users (id) on delete set null,
  given_name   text not null default '' check (char_length(given_name) <= 120),
  family_name  text not null default '' check (char_length(family_name) <= 120),
  display_name text generated always as (btrim(given_name || ' ' || family_name)) stored,
  other_names  text[] not null default '{}',
  orcid        text unique check (orcid ~ '^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$'),
  country      text check (country is null or country ~ '^[A-Z]{2}$'),
  is_public    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.persons is 'A researcher. May exist without a login (user_id null) until claimed.';
create trigger persons_updated_at before update on public.persons
  for each row execute function private.set_updated_at();

create table public.person_emails (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.persons (id) on delete cascade,
  email       extensions.citext not null unique check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  is_primary  boolean not null default false,
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);
comment on table public.person_emails is 'Every email is unique system-wide; this is what prevents duplicate people.';
create unique index person_emails_one_primary on public.person_emails (person_id) where is_primary;
create index person_emails_person_idx on public.person_emails (person_id);

create table public.affiliations (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references public.persons (id) on delete cascade,
  institution  text not null check (char_length(institution) between 2 and 200),
  department   text,
  country      text check (country is null or country ~ '^[A-Z]{2}$'),
  email_domain extensions.citext,
  starts_on    date,
  ends_on      date check (ends_on is null or starts_on is null or ends_on >= starts_on),
  created_at   timestamptz not null default now()
);
comment on table public.affiliations is 'Affiliation history; used later for conflict-of-interest detection.';
create index affiliations_person_idx on public.affiliations (person_id);
create index affiliations_domain_idx on public.affiliations (email_domain);

-- ---------------------------------------------------------------- venues
create table public.venues (
  id           uuid primary key default gen_random_uuid(),
  slug         extensions.citext not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  name         text not null check (char_length(name) between 3 and 300),
  short_name   text check (char_length(short_name) <= 40),
  kind         public.venue_kind not null default 'conference',
  starts_on    date,
  ends_on      date check (ends_on is null or starts_on is null or ends_on >= starts_on),
  location     text,
  timezone     text not null default 'UTC',
  website      text check (website is null or website ~ '^https://'),
  double_blind boolean not null default true,
  is_published boolean not null default false,
  created_by   uuid references public.persons (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger venues_updated_at before update on public.venues
  for each row execute function private.set_updated_at();
create index venues_published_idx on public.venues (is_published, starts_on);
create index venues_created_by_idx on public.venues (created_by);

create table public.venue_members (
  venue_id   uuid not null references public.venues (id) on delete cascade,
  person_id  uuid not null references public.persons (id) on delete cascade,
  role       public.venue_role not null,
  created_at timestamptz not null default now(),
  primary key (venue_id, person_id, role)
);
create index venue_members_person_idx on public.venue_members (person_id);
create index venue_members_venue_role_idx on public.venue_members (venue_id, role);

-- ---------------------------------------------------------------- audit
create table public.audit_log (
  id              bigint generated always as identity primary key,
  at              timestamptz not null default now(),
  actor_user_id   uuid default auth.uid(),
  actor_person_id uuid,
  venue_id        uuid references public.venues (id) on delete set null,
  action          text not null,
  entity          text,
  entity_id       uuid,
  details         jsonb not null default '{}'
);
create index audit_log_venue_idx on public.audit_log (venue_id, at desc);
create index audit_log_actor_idx on public.audit_log (actor_person_id, at desc);
create index audit_log_actor_user_idx on public.audit_log (actor_user_id);

-- ---------------------------------------------------------------- security helpers
create or replace function private.current_person_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.persons p where p.user_id = (select auth.uid())
$$;

create or replace function private.has_venue_role(p_venue uuid, p_roles public.venue_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.venue_members m
    where m.venue_id = p_venue
      and m.person_id = (select private.current_person_id())
      and m.role = any (p_roles)
  )
$$;

create or replace function private.is_venue_member(p_venue uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.venue_members m
    where m.venue_id = p_venue and m.person_id = (select private.current_person_id())
  )
$$;

-- chairs/owners may see people who belong to their venues
create or replace function private.can_see_person(p_person uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.venue_members them
    join public.venue_members me
      on me.venue_id = them.venue_id
     and me.person_id = (select private.current_person_id())
     and me.role in ('owner', 'chair', 'staff')
    where them.person_id = p_person
  )
$$;

create or replace function private.log(p_venue uuid, p_action text, p_entity text, p_entity_id uuid, p_details jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id, details)
  values ((select private.current_person_id()), p_venue, p_action, p_entity, p_entity_id, coalesce(p_details, '{}'))
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.current_person_id(), private.has_venue_role(uuid, public.venue_role[]),
  private.is_venue_member(uuid), private.can_see_person(uuid) to authenticated;
grant execute on all functions in schema private to service_role;

-- ---------------------------------------------------------------- new login -> person
-- Link happens only once the email is CONFIRMED, so nobody can claim
-- someone else's papers by signing up with their address.
create or replace function private.link_confirmed_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_person uuid;
  v_meta   jsonb := coalesce(new.raw_user_meta_data, '{}');
begin
  if new.email_confirmed_at is null or new.email is null then
    return new;
  end if;
  if exists (select 1 from public.persons where user_id = new.id) then
    return new;
  end if;

  -- placeholder person already created for this email (co-author / reviewer invite)?
  select e.person_id into v_person
  from public.person_emails e
  join public.persons p on p.id = e.person_id
  where e.email = new.email and p.user_id is null
  limit 1;

  if v_person is not null then
    update public.persons set user_id = new.id where id = v_person;
    update public.person_emails set verified_at = coalesce(verified_at, now())
      where person_id = v_person and email = new.email;
  else
    insert into public.persons (user_id, given_name, family_name)
    values (new.id,
            left(coalesce(v_meta ->> 'given_name', v_meta ->> 'first_name', ''), 120),
            left(coalesce(v_meta ->> 'family_name', v_meta ->> 'last_name', ''), 120))
    returning id into v_person;
    insert into public.person_emails (person_id, email, is_primary, verified_at)
    values (v_person, new.email, true, now())
    on conflict (email) do nothing;
  end if;

  insert into public.audit_log (actor_user_id, actor_person_id, action, entity, entity_id)
  values (new.id, v_person, 'account.linked', 'person', v_person);
  return new;
end $$;

create trigger on_auth_user_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function private.link_confirmed_user();
-- TODO(auth): handle auth.users email changes (secure email change) -> person_emails.

-- new venue -> creator becomes owner
create or replace function private.venue_owner_on_create()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.venue_members (venue_id, person_id, role)
    values (new.id, new.created_by, 'owner') on conflict do nothing;
  end if;
  insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id)
  values (new.created_by, new.id, 'venue.created', 'venue', new.id);
  return new;
end $$;
create trigger venues_owner_on_create after insert on public.venues
  for each row execute function private.venue_owner_on_create();

-- ---------------------------------------------------------------- RLS
alter table public.persons       enable row level security;
alter table public.person_emails enable row level security;
alter table public.affiliations  enable row level security;
alter table public.venues        enable row level security;
alter table public.venue_members enable row level security;
alter table public.audit_log     enable row level security;

-- no anonymous access except published venues
revoke all on public.persons, public.person_emails, public.affiliations, public.venue_members, public.audit_log from anon;
revoke insert, update, delete on public.venues from anon;

-- persons: see self, public profiles, people in venues you run. Edit only safe columns of self.
create policy persons_select on public.persons for select to authenticated
  using (user_id = (select auth.uid()) or is_public or (select private.can_see_person(id)));
revoke insert, update, delete on public.persons from authenticated;
grant update (given_name, family_name, other_names, country, is_public) on public.persons to authenticated;
create policy persons_update_self on public.persons for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- person_emails: read your own; changes go through server-side verification flows only.
create policy person_emails_select_own on public.person_emails for select to authenticated
  using (person_id = (select private.current_person_id()));
revoke insert, update, delete on public.person_emails from authenticated;

-- affiliations: manage your own; visible with the person.
create policy affiliations_select on public.affiliations for select to authenticated
  using (person_id = (select private.current_person_id())
         or exists (select 1 from public.persons p where p.id = person_id and p.is_public)
         or (select private.can_see_person(person_id)));
create policy affiliations_insert_own on public.affiliations for insert to authenticated
  with check (person_id = (select private.current_person_id()));
create policy affiliations_update_own on public.affiliations for update to authenticated
  using (person_id = (select private.current_person_id()))
  with check (person_id = (select private.current_person_id()));
create policy affiliations_delete_own on public.affiliations for delete to authenticated
  using (person_id = (select private.current_person_id()));

-- venues: published ones are public; members see theirs; owners/chairs edit; owner deletes.
create policy venues_select_public on public.venues for select to anon, authenticated
  using (is_published);
create policy venues_select_member on public.venues for select to authenticated
  using ((select private.is_venue_member(id)));
create policy venues_insert on public.venues for insert to authenticated
  with check (created_by = (select private.current_person_id()));
create policy venues_update on public.venues for update to authenticated
  using ((select private.has_venue_role(id, array['owner', 'chair']::public.venue_role[])))
  with check ((select private.has_venue_role(id, array['owner', 'chair']::public.venue_role[])));
create policy venues_delete on public.venues for delete to authenticated
  using ((select private.has_venue_role(id, array['owner']::public.venue_role[])) and not is_published);

-- venue_members: see your own rows and, if you run the venue, everyone's.
-- Owners/chairs manage members; only owners grant or remove 'owner'.
create policy venue_members_select on public.venue_members for select to authenticated
  using (person_id = (select private.current_person_id())
         or (select private.has_venue_role(venue_id, array['owner', 'chair', 'staff']::public.venue_role[])));
create policy venue_members_insert on public.venue_members for insert to authenticated
  with check ((select private.has_venue_role(venue_id, array['owner', 'chair']::public.venue_role[]))
              and (role <> 'owner' or (select private.has_venue_role(venue_id, array['owner']::public.venue_role[]))));
create policy venue_members_delete on public.venue_members for delete to authenticated
  using ((select private.has_venue_role(venue_id, array['owner', 'chair']::public.venue_role[]))
         and (role <> 'owner' or (select private.has_venue_role(venue_id, array['owner']::public.venue_role[]))));
revoke update on public.venue_members from authenticated;

-- audit_log: read-only; venue owners/chairs see their venue, everyone sees their own actions.
create policy audit_select on public.audit_log for select to authenticated
  using (actor_user_id = (select auth.uid())
         or (venue_id is not null and (select private.has_venue_role(venue_id, array['owner', 'chair']::public.venue_role[]))));
revoke insert, update, delete on public.audit_log from authenticated;
