-- Database advisor fixes (28 Oct 2026).
-- 1. An index for every foreign key in public that has none (96 at the time): faster joins and deletes.
-- 2. Tables with a "write" policy FOR ALL next to a SELECT policy: Postgres ran both for every read. The ALL policy is
--    split into INSERT / UPDATE / DELETE, and where the SELECT policy is for signed-in people only, it now also allows
--    what the ALL policy allowed — so who can read or change what stays exactly the same.
-- 3. email_unsubscribes gets a primary key.

-- 1 ---------------------------------------------------------------------------------------------------------------
do $$
declare r record; cols text; names text;
begin
  for r in
    select c.conrelid, c.conkey, t.relname
    from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f' and n.nspname = 'public'
      and not exists (
        select 1 from pg_index i where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey
          and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] <@ c.conkey)
  loop
    select string_agg(quote_ident(a.attname), ', ' order by array_position(r.conkey, a.attnum)),
           string_agg(a.attname, '_' order by array_position(r.conkey, a.attnum))
      into cols, names
      from pg_attribute a where a.attrelid = r.conrelid and a.attnum = any (r.conkey);
    execute format('create index if not exists %I on public.%I (%s)', left(r.relname || '_' || names || '_fk_idx', 63), r.relname, cols);
  end loop;
end $$;

-- 2 ---------------------------------------------------------------------------------------------------------------
do $$
declare
  r record; s record;
  tbls text[] := array['announcements', 'email_campaigns', 'email_templates', 'folio_files', 'folio_members', 'person_topics',
    'proceedings_exports', 'registration_papers', 'registrations', 'rooms', 'session_talks', 'sessions', 'submission_conflicts',
    'submission_types', 'venue_dates'];
begin
  for r in select * from pg_policies where schemaname = 'public' and tablename = any (tbls) and cmd = 'ALL' and permissive = 'PERMISSIVE'
  loop
    -- A SELECT policy for signed-in people only: let it also cover what the ALL policy let them read.
    select * into s from pg_policies
      where schemaname = 'public' and tablename = r.tablename and cmd = 'SELECT' and roles = '{authenticated}'::name[] limit 1;
    if found then
      execute format('alter policy %I on public.%I using ((%s) or (%s))', s.policyname, r.tablename, s.qual, r.qual);
    end if;
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', left(r.policyname || '_ins', 63), r.tablename, coalesce(r.with_check, r.qual));
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', left(r.policyname || '_upd', 63), r.tablename, r.qual, coalesce(r.with_check, r.qual));
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', left(r.policyname || '_del', 63), r.tablename, r.qual);
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- bids: two SELECT policies (own bids, chairs) become one.
do $$
declare a text; b text;
begin
  select qual into a from pg_policies where schemaname = 'public' and tablename = 'bids' and policyname = 'bids_chairs';
  select qual into b from pg_policies where schemaname = 'public' and tablename = 'bids' and policyname = 'bids_own';
  if a is not null and b is not null then
    execute format('alter policy bids_chairs on public.bids using ((%s) or (%s))', a, b);
    drop policy bids_own on public.bids;
  end if;
end $$;

-- 3 ---------------------------------------------------------------------------------------------------------------
alter table public.email_unsubscribes add column if not exists id bigint generated always as identity;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.email_unsubscribes'::regclass and contype = 'p') then
    alter table public.email_unsubscribes add primary key (id);
  end if;
end $$;
