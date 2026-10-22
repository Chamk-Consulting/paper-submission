-- Per-visitor attempt counter for sign-up (and later other auth forms). The web app sends a keyed hash of the
-- visitor's IP (never the IP itself); Supabase's own limits only see Vercel's servers.
create table if not exists private.auth_attempts (
  id bigint generated always as identity primary key,
  kind text not null,
  key_hash text not null,
  at timestamptz not null default now()
);
create index if not exists auth_attempts_lookup on private.auth_attempts (kind, key_hash, at desc);
revoke all on private.auth_attempts from public, anon, authenticated;

-- Records one attempt and returns how many this key made in the window (including this one).
create or replace function public.note_auth_attempt(p_kind text, p_key_hash text, p_window_minutes integer default 60)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if p_kind not in ('signup') or p_key_hash !~ '^[0-9a-f]{32}$' or p_window_minutes not between 1 and 1440 then
    raise exception 'bad request' using errcode = '22023';
  end if;
  delete from private.auth_attempts where at < now() - interval '2 days' and random() < 0.05;
  insert into private.auth_attempts (kind, key_hash) values (p_kind, p_key_hash);
  select count(*) into v_n from private.auth_attempts
   where kind = p_kind and key_hash = p_key_hash and at > now() - make_interval(mins => p_window_minutes);
  return v_n;
end $$;
revoke all on function public.note_auth_attempt(text, text, integer) from public;
grant execute on function public.note_auth_attempt(text, text, integer) to anon, authenticated;
