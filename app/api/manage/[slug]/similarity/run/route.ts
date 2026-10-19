import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/*
 * EM33 — run a similarity check through an external service. Off unless SIMILARITY_API_URL and SIMILARITY_API_KEY are set.
 *
 * Request sent to SIMILARITY_API_URL (POST, JSON, header "Authorization: Bearer <SIMILARITY_API_KEY>"):
 *   { "paper_id": "#0745", "title": "…", "filename": "paper.pdf", "pdf_base64": "<base64 PDF>" }
 * Expected response (200, JSON):
 *   { "score": 41, "score_excluding_references": 35, "report_url": "https://…",
 *     "sources": [{ "title": "Journal article, 2025", "percent": 24, "url": "https://…" }] }
 * Only "score" or "score_excluding_references" is required. The result is saved through save_similarity (chairs / the paper's AE only).
 */

export const maxDuration = 60;
const body = z.object({ submissionId: z.string().uuid() });
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });
const pct = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 10) / 10 : null; };

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) return json({ error: "not_found" }, 404);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "sign_in" }, 401);
  const url = process.env.SIMILARITY_API_URL, key = process.env.SIMILARITY_API_KEY;
  if (!url || !key) return json({ error: "provider_off" }, 503);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const id = parsed.data.submissionId;

  // the overview only returns papers the caller manages, so it doubles as the permission check
  const { data: venue } = await supabase.from("venues").select("id").eq("slug", slug).maybeSingle();
  if (!venue) return json({ error: "not_found" }, 404);
  const { data: rows } = await supabase.rpc("similarity_overview", { p_venue: venue.id });
  const row = ((rows ?? []) as { submission_id: string; number: number; title: string }[]).find((r) => r.submission_id === id);
  if (!row) return json({ error: "forbidden" }, 403);

  const { data: file } = await supabase.from("submission_files").select("storage_path, file_name, mime_type")
    .eq("submission_id", id).eq("role", "paper").eq("is_current", true).eq("mime_type", "application/pdf").maybeSingle();
  if (!file) return json({ error: "no_pdf" }, 404);
  const { data: blob, error: dl } = await supabase.storage.from("papers").download(file.storage_path as string);
  if (dl || !blob) return json({ error: "no_pdf" }, 404);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ paper_id: `#${String(row.number).padStart(4, "0")}`, title: row.title, filename: file.file_name, pdf_base64: Buffer.from(await blob.arrayBuffer()).toString("base64") }),
    signal: AbortSignal.timeout(50_000),
  }).catch(() => null);
  if (!res || !res.ok) return json({ error: "upstream" }, 502);
  const out = (await res.json().catch(() => null)) as null | { score?: unknown; score_excluding_references?: unknown; report_url?: unknown; sources?: unknown };
  if (!out) return json({ error: "upstream" }, 502);
  const score = pct(out.score), excl = pct(out.score_excluding_references);
  if (score === null && excl === null) return json({ error: "upstream" }, 502);
  const sources = (Array.isArray(out.sources) ? out.sources : []).slice(0, 20).map((s: Record<string, unknown>) => ({
    title: String(s.title ?? "").slice(0, 300), pct: pct(s.percent ?? s.pct), url: typeof s.url === "string" && /^https:\/\//.test(s.url) ? s.url.slice(0, 1000) : undefined,
  }));
  const report = typeof out.report_url === "string" && /^https:\/\//.test(out.report_url) ? out.report_url.slice(0, 1000) : null;
  const { error } = await supabase.rpc("save_similarity", {
    p_submission: id, p_score: score, p_score_excl: excl, p_top_source: sources[0]?.title || null, p_sources: sources, p_report_url: report, p_provider: "api",
  });
  if (error) return json({ error: "forbidden" }, 403);
  return json({ ok: true, score, score_excl: excl });
}
