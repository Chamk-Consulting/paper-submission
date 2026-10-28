-- Login alias (28 Oct 2026): a name a person picks to sign in with, besides their email and PIN ("jdoe", "m.rossi").
-- 3–32 characters, starts with a letter; letters, digits, dot, dash, underscore; unique, case-insensitive.

alter table public.persons add column if not exists login_alias text;
alter table public.persons drop constraint if exists persons_login_alias_check;
alter table public.persons add constraint persons_login_alias_check
  check (login_alias is null or (login_alias ~ '^[a-z][a-z0-9._-]{2,31}$' and login_alias !~ '^pin[\s:#-]*[0-9]'));
create unique index if not exists persons_login_alias_key on public.persons (login_alias) where login_alias is not null;
comment on column public.persons.login_alias is 'Login alias: a name the person chose to sign in with (lower case). Not shown to others.';

-- The sign-in email of an alias. Answers only requests the web server signed, like email_for_plenary_id.
create or replace function public.email_for_login_alias(p_alias text, p_expires bigint, p_sig text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_alias text := lower(btrim(coalesce(p_alias, '')));
begin
  if not private.signed('alias|' || v_alias, p_expires, p_sig) then return null; end if;
  return (select e.email::text from public.persons p join public.person_emails e on e.person_id = p.id and e.is_primary
          where p.login_alias = v_alias and p.user_id is not null and p.deleted_at is null and p.merged_into is null limit 1);
end $$;
revoke all on function public.email_for_login_alias(text, bigint, text) from public;
grant execute on function public.email_for_login_alias(text, bigint, text) to anon, authenticated;

-- Set or clear one's own alias. Returns 'ok', 'cleared', 'invalid' or 'taken'.
create or replace function public.set_my_login_alias(p_alias text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_me uuid := private.current_person_id(); v_alias text := nullif(lower(btrim(coalesce(p_alias, ''))), '');
begin
  if v_me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if v_alias is null then
    update public.persons set login_alias = null where id = v_me;
    return 'cleared';
  end if;
  if v_alias !~ '^[a-z][a-z0-9._-]{2,31}$' or v_alias ~ '^pin[\s:#-]*[0-9]' then return 'invalid'; end if;
  if exists (select 1 from public.persons where login_alias = v_alias and id <> v_me) then return 'taken'; end if;
  update public.persons set login_alias = v_alias where id = v_me;
  return 'ok';
exception when unique_violation then
  return 'taken';
end $$;
revoke all on function public.set_my_login_alias(text) from public, anon;
grant execute on function public.set_my_login_alias(text) to authenticated;

-- The column is not readable by others (persons has column-level grants); people read their own here.
create or replace function public.my_login_alias()
returns text language sql stable security definer set search_path = '' as $$
  select p.login_alias from public.persons p where p.id = private.current_person_id()
$$;
revoke all on function public.my_login_alias() from public, anon;
grant execute on function public.my_login_alias() to authenticated;
