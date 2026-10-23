import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { compileProject, inputHash, safePath, sha256, type CompileFile, type Engine } from "@/lib/folio/compile";

// Folio build: members of the paper send the current text of its files (from the live editor); figures and
// other binary files are read from storage on the server. The PDF and SyncTeX go to the private 'folio'
// bucket and come back as short-lived signed links. An identical build is served from the cache.

export const maxDuration = 120;

const body = z.object({
  paperId: z.guid(),
  mode: z.enum(["draft", "full"]).default("draft"),
  texts: z.array(z.object({ path: z.string().max(240), content: z.string().max(2_000_000) })).max(400),
});

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "sign_in" }, 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const { paperId, mode, texts } = parsed.data;
  if (texts.reduce((n, t) => n + t.content.length, 0) > 8_000_000) return json({ error: "too_large" }, 413);
  if (texts.some((t) => !safePath(t.path))) return json({ error: "bad_path" }, 400);

  // RLS: only members see the paper and its files.
  const [{ data: paper }, { data: files }, { data: me }] = await Promise.all([
    supabase.from("folio_papers").select("id, engine, main_file").eq("id", paperId).maybeSingle(),
    supabase.from("folio_files").select("path, kind, storage_key, content_hash").eq("paper_id", paperId),
    supabase.from("persons").select("id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!paper) return json({ error: "not_found" }, 404);

  const admin = createAdminClient();
  const textPaths = new Set(texts.map((t) => t.path));
  const all: CompileFile[] = texts.map((t) => {
    const bytes = new TextEncoder().encode(t.content);
    return { path: t.path, hash: sha256(bytes), load: async () => bytes };
  });
  for (const f of files ?? []) {
    if (f.kind !== "binary" || !f.storage_key || textPaths.has(f.path) || !safePath(f.path)) continue;
    all.push({
      path: f.path,
      hash: f.content_hash ?? f.storage_key,
      load: async () => {
        const { data, error } = await admin.storage.from("folio").download(f.storage_key!);
        if (error || !data) throw new Error(`missing ${f.path}`);
        return new Uint8Array(await data.arrayBuffer());
      },
    });
  }
  if (!all.some((f) => f.path === paper.main_file)) return json({ error: "no_main", main: paper.main_file }, 400);

  const hash = inputHash(all, paper.engine, paper.main_file, mode);
  const sign = async (key: string | null) => (key ? (await admin.storage.from("folio").createSignedUrl(key, 600)).data?.signedUrl ?? null : null);

  // Same inputs as an earlier good build: no compile needed.
  const { data: cached } = await admin.from("folio_compiles")
    .select("id, pdf_key, pages, diagnostics, ms").eq("paper_id", paperId).eq("input_hash", hash).eq("status", "ok")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (cached?.pdf_key) {
    return json({ id: cached.id, status: "ok", cached: true, pages: cached.pages, ms: 0, diagnostics: cached.diagnostics,
      pdfUrl: await sign(cached.pdf_key), synctexUrl: await sign(cached.pdf_key.replace(/\.pdf$/, ".synctex.gz")) });
  }

  let result;
  try {
    result = await compileProject({ paperId, files: all, main: paper.main_file, engine: paper.engine as Engine, mode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return json({ error: msg === "compile_off" ? "compile_off" : "compile_failed" }, 503);
  }

  const id = crypto.randomUUID();
  let pdfKey: string | null = null;
  if (result.pdf) {
    pdfKey = `${paperId}/build/${id}.pdf`;
    await admin.storage.from("folio").upload(pdfKey, result.pdf, { contentType: "application/pdf", upsert: true });
    if (result.synctex) await admin.storage.from("folio").upload(`${paperId}/build/${id}.synctex.gz`, result.synctex, { contentType: "application/gzip", upsert: true });
  }
  await admin.from("folio_compiles").insert({
    id, paper_id: paperId, requested_by: me?.id ?? null, input_hash: hash, engine: paper.engine, mode,
    status: result.status, ms: result.ms, pages: result.pages, pdf_key: pdfKey, diagnostics: result.diagnostics, log_tail: result.logTail,
  });

  return json({
    id, status: result.status, cached: false, pages: result.pages, ms: result.ms, diagnostics: result.diagnostics,
    pdfUrl: await sign(pdfKey), synctexUrl: result.synctex && pdfKey ? await sign(pdfKey.replace(/\.pdf$/, ".synctex.gz")) : null,
    logTail: result.status === "ok" ? undefined : result.logTail,
  });
}
