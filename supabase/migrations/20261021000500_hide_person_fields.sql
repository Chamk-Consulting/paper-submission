-- Hide private profile fields from other signed-in users (fix plan 1.10, part 2). Safe to run more than once.
-- APPLY ONLY AFTER the app stops reading these columns straight from public.persons:
--   lib/auth/me.ts, lib/account/data.ts (own row, select("*"))  -> rpc("my_person")
--   lib/review/data.ts (availability, select("*"))             -> rpc("my_person")
-- A select("*") on persons fails once any column is not readable.
--
-- Hidden: lock and deletion state, former names, reviewing availability. Everything shown on profiles and author lists
-- stays readable (still filtered row-by-row by the persons_select policy).

-- the caller's own row, every column (works while locked too, so the lock screen can explain itself)
create or replace function public.my_person()
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(p) from public.persons p where p.user_id = (select auth.uid())
$$;
revoke all on function public.my_person() from public, anon;
grant execute on function public.my_person() to authenticated;

-- every column except the hidden ones (computed, so columns added later default to readable as before)
do $$
declare v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'persons'
    and column_name not in ('locked_at', 'locked_reason', 'merged_into', 'deleted_at', 'former_names',
                            'availability', 'available_from', 'monthly_limit');
  revoke select on public.persons from anon, authenticated;
  execute format('grant select (%s) on public.persons to authenticated', v_cols);
end $$;
