-- Plenary ID, research profile (canvas PR08/PR09), affiliation from sign-up.
alter table public.persons
  add column if not exists plenary_id text unique check (plenary_id ~ '^PL-\d{4}-\d{4}$'),
  add column if not exists paper_name text check (char_length(paper_name) <= 200),
  add column if not exists name_scripts jsonb not null default '[]'::jsonb,
  add column if not exists profile_completed_at timestamptz;

comment on column public.persons.plenary_id is 'Public researcher ID (PL-XXXX-XXXX). Finds a person; never signs anyone in.';
comment on column public.persons.name_scripts is 'Names in other scripts: [{"script":"zh","name":"李明"}]';

-- Random, non-sequential 8-digit ID, retried until unique.
create or replace function private.new_plenary_id()
returns text language plpgsql volatile set search_path = '' as $$
declare v text;
begin
  loop
    v := 'PL-' || lpad((floor(random() * 10000))::int::text, 4, '0') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.persons where plenary_id = v);
  end loop;
  return v;
end $$;

create or replace function private.persons_assign_plenary_id()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.plenary_id is null then new.plenary_id := private.new_plenary_id(); end if;
  return new;
end $$;
create trigger persons_plenary_id before insert on public.persons
  for each row execute function private.persons_assign_plenary_id();
update public.persons set plenary_id = private.new_plenary_id() where plenary_id is null;

-- Sign-up affiliation (raw_user_meta_data.affiliation) becomes the first affiliation row.
create or replace function private.link_confirmed_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_person uuid;
  v_meta   jsonb := coalesce(new.raw_user_meta_data, '{}');
  v_aff    text := nullif(btrim(coalesce(v_meta ->> 'affiliation', '')), '');
begin
  if new.email_confirmed_at is null or new.email is null then return new; end if;
  if exists (select 1 from public.persons where user_id = new.id) then return new; end if;

  select e.person_id into v_person
  from public.person_emails e join public.persons p on p.id = e.person_id
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

  if v_aff is not null and char_length(v_aff) between 2 and 200
     and not exists (select 1 from public.affiliations where person_id = v_person) then
    insert into public.affiliations (person_id, institution, email_domain)
    values (v_person, v_aff, split_part(new.email, '@', 2));
  end if;

  insert into public.audit_log (actor_user_id, actor_person_id, action, entity, entity_id)
  values (new.id, v_person, 'account.linked', 'person', v_person);
  return new;
end $$;

-- Finish the research profile in one call (PR08). Runs as the signed-in person only.
create or replace function public.complete_profile(
  p_paper_name   text,
  p_name_scripts jsonb,
  p_institution  text,
  p_ror_id       text,
  p_department   text,
  p_country      text,
  p_other_email  text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_person uuid := private.current_person_id();
  v_domain text;
  v_id     text;
begin
  if v_person is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if coalesce(btrim(p_paper_name), '') = '' or char_length(p_paper_name) > 200 then
    raise exception 'name required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_institution), '') = '' or char_length(p_institution) > 200 then
    raise exception 'affiliation required' using errcode = '22023';
  end if;
  if p_country is not null and p_country !~ '^[A-Z]{2}$' then
    raise exception 'bad country' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_name_scripts, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_name_scripts, '[]'::jsonb)) > 6 then
    raise exception 'bad scripts' using errcode = '22023';
  end if;

  update public.persons
     set paper_name = btrim(p_paper_name),
         name_scripts = coalesce(p_name_scripts, '[]'::jsonb),
         country = p_country,
         profile_completed_at = coalesce(profile_completed_at, now())
   where id = v_person
  returning plenary_id into v_id;

  select split_part(e.email::text, '@', 2) into v_domain
    from public.person_emails e where e.person_id = v_person and e.is_primary limit 1;

  -- current affiliation: replace the open-ended one, keep history rows with an end date
  delete from public.affiliations where person_id = v_person and ends_on is null;
  insert into public.affiliations (person_id, institution, department, country, email_domain)
  values (v_person, btrim(p_institution), nullif(btrim(coalesce(p_department, '')), ''), p_country,
          case when p_institution = 'Independent researcher' then null else v_domain end);

  -- other email: stored unverified; it only links co-author invites after it's confirmed.
  -- TODO(auth): send a confirmation email for added addresses.
  if coalesce(btrim(p_other_email), '') <> '' then
    if p_other_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email' using errcode = '22023'; end if;
    insert into public.person_emails (person_id, email, is_primary)
    values (v_person, lower(btrim(p_other_email)), false)
    on conflict (email) do nothing;
  end if;

  insert into public.audit_log (actor_person_id, action, entity, entity_id, details)
  values (v_person, 'profile.completed', 'person', v_person, jsonb_build_object('ror', p_ror_id));
  return v_id;
end $$;

revoke all on function public.complete_profile(text, jsonb, text, text, text, text, text) from public, anon;
grant execute on function public.complete_profile(text, jsonb, text, text, text, text, text) to authenticated;
revoke all on function private.new_plenary_id() from public, anon, authenticated;
