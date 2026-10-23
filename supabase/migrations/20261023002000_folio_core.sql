-- Folio editor core (phase 1, foundations).
-- A Folio paper is a project tree. Text files live as Yjs documents (append-only updates + compacted snapshots);
-- binary files (figures, data) and built PDFs live in the private 'folio' storage bucket under {paper_id}/...
-- Live co-editing relays Yjs updates over Supabase Realtime private channels named 'folio:{paper_id}'.

create type public.folio_role as enum ('owner', 'editor', 'commenter', 'viewer');

create table public.folio_papers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.persons(id) on delete cascade,
  title text not null default 'Untitled paper' check (char_length(title) between 1 and 300),
  engine text not null default 'pdflatex' check (engine in ('pdflatex', 'lualatex', 'xelatex')),
  main_file text not null default 'main.tex',
  template_key text,
  venue_id uuid references public.venues(id) on delete set null,
  submission_id uuid references public.submissions(id) on delete set null,
  copilot_enabled boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'archived', 'trashed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index folio_papers_owner_idx on public.folio_papers(owner_id);

create table public.folio_members (
  paper_id uuid not null references public.folio_papers(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  role public.folio_role not null default 'editor',
  added_at timestamptz not null default now(),
  primary key (paper_id, person_id)
);
create index folio_members_person_idx on public.folio_members(person_id);

create table public.folio_files (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.folio_papers(id) on delete cascade,
  path text not null check (path ~ '^[A-Za-z0-9._/-]{1,240}$' and path !~ '(^|/)\.\.(/|$)' and left(path, 1) <> '/'),
  kind text not null check (kind in ('text', 'binary')),
  storage_key text,
  size_bytes bigint not null default 0,
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paper_id, path)
);

create table public.folio_updates (
  id bigint generated always as identity primary key,
  paper_id uuid not null references public.folio_papers(id) on delete cascade,
  file_id uuid not null references public.folio_files(id) on delete cascade,
  update bytea not null check (octet_length(update) <= 1048576),
  author_id uuid references public.persons(id) on delete set null,
  created_at timestamptz not null default now()
);
create index folio_updates_file_idx on public.folio_updates(file_id, id);

create table public.folio_snapshots (
  id bigint generated always as identity primary key,
  paper_id uuid not null references public.folio_papers(id) on delete cascade,
  file_id uuid references public.folio_files(id) on delete cascade,
  upto_update_id bigint not null default 0,
  state bytea,
  label text,
  locked boolean not null default false,
  created_by uuid references public.persons(id) on delete set null,
  created_at timestamptz not null default now()
);
create index folio_snapshots_file_idx on public.folio_snapshots(file_id, id desc);

create table public.folio_comments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.folio_papers(id) on delete cascade,
  file_id uuid references public.folio_files(id) on delete cascade,
  parent_id uuid references public.folio_comments(id) on delete cascade,
  anchor jsonb,
  body text not null check (char_length(body) between 1 and 5000),
  kind text not null default 'comment' check (kind in ('comment', 'suggestion')),
  status text not null default 'open' check (status in ('open', 'resolved', 'accepted', 'rejected')),
  author_id uuid references public.persons(id) on delete set null,
  created_at timestamptz not null default now()
);
create index folio_comments_paper_idx on public.folio_comments(paper_id);

create table public.folio_compiles (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.folio_papers(id) on delete cascade,
  requested_by uuid references public.persons(id) on delete set null,
  input_hash text not null,
  engine text not null,
  mode text not null default 'draft' check (mode in ('draft', 'full')),
  status text not null check (status in ('running', 'ok', 'error', 'timeout')),
  ms integer,
  pages integer,
  pdf_key text,
  diagnostics jsonb not null default '[]'::jsonb,
  log_tail text,
  created_at timestamptz not null default now()
);
create index folio_compiles_paper_idx on public.folio_compiles(paper_id, created_at desc);
create index folio_compiles_hash_idx on public.folio_compiles(paper_id, input_hash) where status = 'ok';

create table public.folio_copilot_runs (
  id bigint generated always as identity primary key,
  paper_id uuid references public.folio_papers(id) on delete set null,
  person_id uuid references public.persons(id) on delete set null,
  assist text not null,
  model text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_usd numeric(10, 5) not null default 0,
  accepted boolean,
  created_at timestamptz not null default now()
);
create index folio_copilot_runs_person_idx on public.folio_copilot_runs(person_id, created_at desc);

-- ---------- access helpers ----------
create or replace function private.folio_role_of(p_paper uuid)
returns public.folio_role language sql stable security definer set search_path = '' as $$
  select m.role from public.folio_members m
  where m.paper_id = p_paper and m.person_id = (select private.current_person_id())
$$;
revoke all on function private.folio_role_of(uuid) from public, anon;
grant execute on function private.folio_role_of(uuid) to authenticated;

create or replace function private.folio_can_read(p_paper uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.folio_role_of(p_paper)) is not null
$$;
create or replace function private.folio_can_write(p_paper uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.folio_role_of(p_paper)) in ('owner', 'editor')
    and exists (select 1 from public.folio_papers p where p.id = p_paper and p.status = 'draft')
$$;
create or replace function private.folio_can_comment(p_paper uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.folio_role_of(p_paper)) in ('owner', 'editor', 'commenter')
$$;
revoke all on function private.folio_can_read(uuid), private.folio_can_write(uuid), private.folio_can_comment(uuid) from public, anon;
grant execute on function private.folio_can_read(uuid), private.folio_can_write(uuid), private.folio_can_comment(uuid) to authenticated;

-- The owner is always a member.
create or replace function private.folio_add_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.folio_members(paper_id, person_id, role) values (new.id, new.owner_id, 'owner')
  on conflict (paper_id, person_id) do update set role = 'owner';
  return new;
end $$;
create trigger folio_papers_add_owner after insert on public.folio_papers
  for each row execute function private.folio_add_owner();

create or replace function private.folio_touch()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger folio_papers_touch before update on public.folio_papers for each row execute function private.folio_touch();
create trigger folio_files_touch before update on public.folio_files for each row execute function private.folio_touch();

-- ---------- row level security ----------
alter table public.folio_papers enable row level security;
alter table public.folio_members enable row level security;
alter table public.folio_files enable row level security;
alter table public.folio_updates enable row level security;
alter table public.folio_snapshots enable row level security;
alter table public.folio_comments enable row level security;
alter table public.folio_compiles enable row level security;
alter table public.folio_copilot_runs enable row level security;

create policy folio_papers_select on public.folio_papers for select to authenticated
  using ((select private.folio_can_read(id)));
create policy folio_papers_insert on public.folio_papers for insert to authenticated
  with check (owner_id = (select private.current_person_id()));
create policy folio_papers_update on public.folio_papers for update to authenticated
  using ((select private.folio_role_of(id)) in ('owner', 'editor'))
  with check ((select private.folio_role_of(id)) in ('owner', 'editor'));
create policy folio_papers_delete on public.folio_papers for delete to authenticated
  using (owner_id = (select private.current_person_id()));

create policy folio_members_select on public.folio_members for select to authenticated
  using ((select private.folio_can_read(paper_id)));
create policy folio_members_write on public.folio_members for all to authenticated
  using ((select private.folio_role_of(paper_id)) = 'owner' and role <> 'owner')
  with check ((select private.folio_role_of(paper_id)) = 'owner' and role <> 'owner');

create policy folio_files_select on public.folio_files for select to authenticated
  using ((select private.folio_can_read(paper_id)));
create policy folio_files_write on public.folio_files for all to authenticated
  using ((select private.folio_can_write(paper_id)))
  with check ((select private.folio_can_write(paper_id)));

create policy folio_updates_select on public.folio_updates for select to authenticated
  using ((select private.folio_can_read(paper_id)));
create policy folio_updates_insert on public.folio_updates for insert to authenticated
  with check ((select private.folio_can_write(paper_id)) and author_id = (select private.current_person_id())
    and exists (select 1 from public.folio_files f where f.id = file_id and f.paper_id = folio_updates.paper_id));

create policy folio_snapshots_select on public.folio_snapshots for select to authenticated
  using ((select private.folio_can_read(paper_id)));
create policy folio_snapshots_insert on public.folio_snapshots for insert to authenticated
  with check ((select private.folio_can_write(paper_id)) and created_by = (select private.current_person_id()));

create policy folio_comments_select on public.folio_comments for select to authenticated
  using ((select private.folio_can_read(paper_id)));
create policy folio_comments_insert on public.folio_comments for insert to authenticated
  with check ((select private.folio_can_comment(paper_id)) and author_id = (select private.current_person_id()));
create policy folio_comments_update on public.folio_comments for update to authenticated
  using ((select private.folio_can_comment(paper_id)))
  with check ((select private.folio_can_comment(paper_id)));

-- Compiles and Copilot runs are written by the server (service role) only.
create policy folio_compiles_select on public.folio_compiles for select to authenticated
  using ((select private.folio_can_read(paper_id)));
create policy folio_copilot_runs_select on public.folio_copilot_runs for select to authenticated
  using (person_id = (select private.current_person_id()));

-- ---------- storage: private 'folio' bucket, {paper_id}/files/... and {paper_id}/build/... ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('folio', 'folio', false, 524288000)
on conflict (id) do nothing;

create policy folio_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'folio' and (select private.folio_can_read(((storage.foldername(name))[1])::uuid)));
create policy folio_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'folio' and (storage.foldername(name))[2] = 'files'
    and (select private.folio_can_write(((storage.foldername(name))[1])::uuid)));
create policy folio_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'folio' and (storage.foldername(name))[2] = 'files'
    and (select private.folio_can_write(((storage.foldername(name))[1])::uuid)));
create policy folio_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'folio' and (storage.foldername(name))[2] = 'files'
    and (select private.folio_can_write(((storage.foldername(name))[1])::uuid)));

-- ---------- realtime: private broadcast/presence channels 'folio:{paper_id}' ----------
create policy folio_realtime_read on realtime.messages for select to authenticated
  using (
    realtime.topic() like 'folio:%'
    and (select private.folio_can_read((split_part(realtime.topic(), ':', 2))::uuid))
  );
create policy folio_realtime_write on realtime.messages for insert to authenticated
  with check (
    realtime.topic() like 'folio:%'
    and (
      (extension = 'presence' and (select private.folio_can_read((split_part(realtime.topic(), ':', 2))::uuid)))
      or (extension = 'broadcast' and (select private.folio_can_write((split_part(realtime.topic(), ':', 2))::uuid)))
    )
  );
