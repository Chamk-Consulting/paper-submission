-- Folio builds run as the signed-in member (no service key on the web server).
-- The server signs what it records with the shared signing secret (private.signed), so a member cannot
-- forge a build result or swap the TeX snapshot from the browser.

create or replace function public.folio_record_compile(
  p_id uuid, p_paper uuid, p_hash text, p_engine text, p_mode text, p_status text, p_ms integer, p_pages integer,
  p_pdf_key text, p_diagnostics jsonb, p_log text, p_expires bigint, p_sig text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.folio_can_read(p_paper)) then raise exception 'forbidden'; end if;
  if not private.signed(concat_ws(':', 'folio_compile', p_id, p_paper, p_hash, p_status, coalesce(p_pdf_key, '')), p_expires, p_sig) then
    raise exception 'bad signature';
  end if;
  if p_pdf_key is not null and split_part(p_pdf_key, '/', 1) <> p_paper::text then raise exception 'bad key'; end if;
  insert into public.folio_compiles(id, paper_id, requested_by, input_hash, engine, mode, status, ms, pages, pdf_key, diagnostics, log_tail)
  values (p_id, p_paper, (select private.current_person_id()), p_hash, p_engine, p_mode, p_status, p_ms, p_pages, p_pdf_key,
          coalesce(p_diagnostics, '[]'::jsonb), left(p_log, 8000));
end $$;
revoke all on function public.folio_record_compile(uuid, uuid, text, text, text, text, integer, integer, text, jsonb, text, bigint, text) from public, anon;
grant execute on function public.folio_record_compile(uuid, uuid, text, text, text, text, integer, integer, text, jsonb, text, bigint, text) to authenticated;

create or replace function public.folio_tex_snapshot()
returns text language sql stable security definer set search_path = '' as $$
  select value from public.folio_settings where key = 'tex_snapshot'
$$;
revoke all on function public.folio_tex_snapshot() from public, anon;
grant execute on function public.folio_tex_snapshot() to authenticated;

create or replace function public.folio_set_tex_snapshot(p_id text, p_expires bigint, p_sig text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_id !~ '^snap_[A-Za-z0-9]{20,40}$' or not private.signed('folio_tex_snapshot:' || p_id, p_expires, p_sig) then
    raise exception 'bad signature';
  end if;
  insert into public.folio_settings(key, value, updated_at) values ('tex_snapshot', p_id, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke all on function public.folio_set_tex_snapshot(text, bigint, text) from public, anon;
grant execute on function public.folio_set_tex_snapshot(text, bigint, text) to authenticated;

-- Built PDFs and SyncTeX files: written under {paper_id}/build/ by the build route acting as a member.
create policy folio_storage_build_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'folio' and (storage.foldername(name))[2] = 'build'
    and (select private.folio_can_read(((storage.foldername(name))[1])::uuid)));
