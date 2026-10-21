import { z } from "zod";
import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";

// AI side panel of the in-app viewer (SB05v Summary, SB05t Translate, SB05a Ask).
// Signed-in authors/reviewers/managers of the paper only; public.use_ai enforces access and the hourly limit.
// The key is read from the server environment only — never sent to the browser.

export const maxDuration = 60;

const LANGS = { fr: "French", ar: "Arabic", es: "Spanish", pt: "Portuguese", de: "German", zh: "Simplified Chinese" } as const;

const body = z.object({
  submissionId: z.guid(),
  fileId: z.guid().optional(),
  // review_* come from the reviewer's viewer (RV03): no file id, plain-text answer
  kind: z.enum(["summary", "translate", "ask", "review_summary", "review_ask"]),
  assignmentId: z.guid().optional(),
  mode: z.enum(["brief", "detailed", "reviewers"]).optional(),
  lang: z.enum(["fr", "ar", "es", "pt", "de", "zh"]).optional(),
  scope: z.enum(["abstract", "page", "summary"]).optional(),
  page: z.number().int().min(1).max(2000).optional(),
  question: z.string().trim().min(2).max(1000).optional(),
  summary: z.string().max(8000).optional(),
  history: z.array(z.object({ q: z.string().max(1000), a: z.string().max(4000) })).max(6).optional(),
});

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

function prompt(b: z.infer<typeof body>, pages: string[], abstract: string | null): { system: string; user: string } {
  const doc = pages.map((p, i) => `[Page ${i + 1}]\n${p}`).join("\n\n").slice(0, 150_000);
  const base = "You help researchers read a scientific paper. Be accurate and concise; never invent content that is not in the paper. Reply with JSON only, no prose around it.";
  if (b.kind === "summary") {
    const how = b.mode === "detailed" ? "Summarise section by section: one item per section (Introduction, Method, Results, …), 2–3 sentences each."
      : b.mode === "reviewers" ? "Summarise for a reviewer: contribution, method, evidence, limitations, open questions — one item each, 1–2 sentences."
      : "Summarise in one paragraph split into 3–4 items: problem, approach, main result, significance — one sentence each.";
    return { system: base, user: `${how}\nReturn {"items":[{"key":"short label","text":"…","page":<page number where this is supported>}]}.\n\n${doc}` };
  }
  if (b.kind === "translate") {
    const lang = LANGS[b.lang ?? "fr"];
    const src = b.scope === "summary" ? (b.summary ?? "") : b.scope === "page" ? (pages[(b.page ?? 1) - 1] ?? "") : (abstract || pages[0]?.slice(0, 4000) || "");
    return { system: base, user: `Translate the following text into ${lang}. Keep technical terms, symbols and citations exact; keep paragraph breaks. Return {"text":"…"}.\n\n${src.slice(0, 20_000)}` };
  }
  const hist = (b.history ?? []).map((h) => `Q: ${h.q}\nA: ${h.a}`).join("\n\n");
  return { system: base, user: `Answer the question using only the paper. If the paper does not say, answer that it does not. Return {"answer":"…","pages":[page numbers you used]}.\n\n${hist ? `Earlier in this chat:\n${hist}\n\n` : ""}Question: ${b.question ?? ""}\n\n${doc}` };
}

function parse(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "sign_in" }, 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const raw = parsed.data;
  const review = raw.kind === "review_summary" || raw.kind === "review_ask";
  const b = { ...raw, kind: raw.kind === "review_summary" ? "summary" : raw.kind === "review_ask" ? "ask" : raw.kind, mode: raw.kind === "review_summary" ? "reviewers" : raw.mode } as z.infer<typeof body> & { kind: "summary" | "translate" | "ask" };
  if (b.kind === "ask" && !b.question) return json({ error: "bad_request" }, 400);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "ai_off" }, 503);

  let fileQuery = supabase.from("submission_files").select("storage_path, mime_type, submission_id").eq("submission_id", b.submissionId);
  fileQuery = b.fileId ? fileQuery.eq("id", b.fileId) : fileQuery.eq("mime_type", "application/pdf").eq("is_current", true).order("role").order("created_at", { ascending: false }).limit(1);
  const { data: file } = await fileQuery.maybeSingle();
  if (!file || file.mime_type !== "application/pdf") return json({ error: "not_found" }, 404);

  const { data: left, error: limitErr } = await supabase.rpc("use_ai", { p_submission: b.submissionId, p_kind: b.kind });
  if (limitErr) return /limit/i.test(limitErr.message) ? json({ error: "limit" }, 429) : json({ error: "forbidden" }, 403);

  const { data: blob, error: dlErr } = await supabase.storage.from("papers").download(file.storage_path);
  if (dlErr || !blob) return json({ error: "not_found" }, 404);
  let pages: string[];
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
    pages = (await extractText(pdf, { mergePages: false })).text as string[];
  } catch {
    return json({ error: "unreadable" }, 422);
  }
  const { data: sub } = await supabase.from("submissions").select("abstract").eq("id", b.submissionId).maybeSingle();
  const { system, user: content } = prompt(b, pages, (sub?.abstract as string) ?? null);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: b.kind === "translate" ? 4000 : 1500, system, messages: [{ role: "user", content }] }),
  }).catch(() => null);
  if (!res || !res.ok) return json({ error: "upstream" }, 502);
  const out = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (out.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  const data = parse(text);
  if (!data) return b.kind === "translate" ? json({ text, left }) : json({ error: "upstream" }, 502);
  const clampPage = (p: unknown) => { const n = Number(p); return Number.isInteger(n) && n >= 1 && n <= pages.length ? n : null; };
  if (review) {
    const text = b.kind === "summary"
      ? (Array.isArray(data.items) ? data.items : []).map((i: Record<string, unknown>) => `${String(i.key ?? "")}${clampPage(i.page) ? ` (p. ${clampPage(i.page)})` : ""}: ${String(i.text ?? "")}`).join("\n\n")
      : String(data.answer ?? "");
    return json({ text: text.slice(0, 6000), left });
  }
  if (b.kind === "summary") {
    const items = (Array.isArray(data.items) ? data.items : []).slice(0, 12).map((i: Record<string, unknown>) => ({ key: String(i.key ?? "").slice(0, 60), text: String(i.text ?? "").slice(0, 1200), page: clampPage(i.page) }));
    return json({ items, pages: pages.length, left });
  }
  if (b.kind === "translate") return json({ text: String(data.text ?? "").slice(0, 30_000), left });
  return json({ answer: String(data.answer ?? "").slice(0, 4000), pages: (Array.isArray(data.pages) ? data.pages : []).map(clampPage).filter(Boolean).slice(0, 8), left });
}
