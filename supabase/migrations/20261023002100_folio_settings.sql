create table public.folio_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.folio_settings enable row level security;
-- No policies: only the server (service role) reads or writes these.
revoke all on public.folio_settings from anon, authenticated;
