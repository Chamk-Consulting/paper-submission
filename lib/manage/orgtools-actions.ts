"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEvent } from "@/lib/manage/data";
import { friendlyDb, type ManageState } from "@/lib/manage/actions-util";
import { absUrl, emailConfigured, sendEmail, textToHtml } from "@/lib/email/send";

/* Organizer tools: EM33 similarity check, EM34 awards, BL01 billing. Messages are English keys, translated by the forms. */

export type OrgState = ManageState & { matched?: number; unmatched?: number[]; emailed?: boolean; email?: string };

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);
const uuid = z.string().uuid();
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function load(fd: FormData, allow: "organizer" | "chair" | "owner" | "ae" = "organizer") {
  const slug = s(fd, "slug");
  if (!slugSchema.safeParse(slug).success) throw new Error("Bad request.");
  const ctx = await requireEvent(slug, allow);
  return { slug, ctx, supabase: await createClient(), venueId: ctx.venue.id };
}
const done = (slug: string, sub: string) => revalidatePath(`/[lang]/manage/${slug}/${sub}`, "page");
async function guard<T extends ManageState>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect / notFound from requireEvent
    return { error: e instanceof Error ? friendlyDb(e.message) : friendlyDb() } as T;
  }
}
const pct = (v: string) => {
  if (!v) return null;
  const n = Number(v.replace("%", "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 10) / 10 : NaN;
};

/* ================================================================ EM33 — similarity */

export async function saveSimilaritySettings(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, supabase, venueId } = await load(fd, "chair");
    const th = Number(s(fd, "threshold"));
    if (!Number.isInteger(th) || th < 1 || th > 100) return { fieldErrors: { threshold: "Enter a whole number from 1 to 100." } };
    const { error } = await supabase.rpc("set_similarity_settings", { p_venue: venueId, p_threshold: th, p_ignore_refs: s(fd, "ignore_refs") === "on" || s(fd, "ignore_refs") === "true" });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "similarity");
    return { ok: true, savedAt: new Date().toISOString() };
  });
}

export async function recordSimilarity(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, supabase } = await load(fd, "ae");
    const id = s(fd, "submissionId");
    if (!uuid.safeParse(id).success) return { error: "Bad request." };
    const score = pct(s(fd, "score")), excl = pct(s(fd, "score_excl"));
    const fe: Record<string, string> = {};
    if (score === null && excl === null) fe.score = "Enter a score.";
    if (Number.isNaN(score)) fe.score = "Use a number from 0 to 100.";
    if (Number.isNaN(excl)) fe.score_excl = "Use a number from 0 to 100.";
    const url = s(fd, "report_url");
    if (url && !/^https:\/\/\S+$/.test(url)) fe.report_url = "The report link must start with https://";
    if (Object.keys(fe).length) return { fieldErrors: fe };
    // sources: one per line, "title — 12%" or "title, 12"
    const sources = s(fd, "sources").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20).map((l) => {
      const m = l.match(/^(.*?)[\s,;—–-]+(\d{1,3}(?:[.,]\d)?)\s*%?$/);
      return m ? { title: m[1].trim().slice(0, 300), pct: Number(m[2].replace(",", ".")) } : { title: l.slice(0, 300), pct: null };
    });
    const top = s(fd, "top_source") || sources[0]?.title || null;
    const { error } = await supabase.rpc("save_similarity", {
      p_submission: id, p_score: score, p_score_excl: excl, p_top_source: top, p_sources: sources, p_report_url: url || null, p_provider: "manual",
    });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "similarity");
    return { ok: true, savedAt: new Date().toISOString() };
  });
}

/** CSV with columns: paper number, score, top source. A header row is skipped. */
export async function importSimilarity(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, supabase, venueId } = await load(fd, "chair");
    const file = fd.get("file");
    let text = s(fd, "csv");
    if (file && typeof file === "object" && "size" in file && file.size > 0) {
      if (file.size > 2_000_000) return { error: "The file is too large (2 MB at most)." };
      text = await file.text();
    }
    const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const cells = l.match(/("([^"]|"")*"|[^,;\t]+)/g)?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];
      const number = Number((cells[0] ?? "").replace(/^#/, ""));
      const score = Number((cells[1] ?? "").replace("%", "").replace(",", "."));
      return { number, score, source: cells.slice(2).join(", ") || null };
    }).filter((r) => Number.isInteger(r.number) && r.number > 0 && Number.isFinite(r.score));
    if (!rows.length) return { error: "No rows found. Use: paper number, score, top source." };
    const { data, error } = await supabase.rpc("import_similarity", { p_venue: venueId, p_rows: rows });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "similarity");
    const r = data as { matched: number; unmatched: number[] };
    return { ok: true, matched: r.matched, unmatched: r.unmatched };
  });
}

export async function markSimilarityChecked(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, supabase } = await load(fd, "ae");
    const id = s(fd, "submissionId");
    if (!uuid.safeParse(id).success) return { error: "Bad request." };
    const { error } = await supabase.rpc("mark_similarity_checked", { p_submission: id, p_checked: s(fd, "checked") !== "false" });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "similarity");
    return { ok: true };
  });
}

/* ================================================================ EM34 — awards */

export async function createAward(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, supabase, venueId } = await load(fd, "chair");
    const name = s(fd, "name");
    if (name.length < 3 || name.length > 80) return { fieldErrors: { name: "Name the award (3–80 characters)." } };
    const { error } = await supabase.rpc("create_award", { p_venue: venueId, p_name: name });
    if (error) return { error: /duplicate|23505/.test(error.message) ? "An award with this name already exists." : friendlyDb(error.message) };
    done(slug, "awards");
    return { ok: true };
  });
}

export async function setAwardCommittee(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, supabase } = await load(fd, "chair");
    const award = s(fd, "awardId");
    const people = fd.getAll("people").map(String).filter((x) => uuid.safeParse(x).success);
    if (!uuid.safeParse(award).success) return { error: "Bad request." };
    const { error } = await supabase.rpc("set_award_committee", { p_award: award, p_people: people });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "awards");
    return { ok: true, savedAt: new Date().toISOString() };
  });
}

export async function nominatePaper(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, supabase } = await load(fd, "ae");
    const award = s(fd, "awardId"), sub = s(fd, "submissionId");
    if (!uuid.safeParse(award).success) return { error: "Bad request." };
    if (!uuid.safeParse(sub).success) return { fieldErrors: { submissionId: "Choose an accepted paper." } };
    const reason = s(fd, "reason");
    if (reason.length > 1000) return { fieldErrors: { reason: "Keep the reason under 1,000 characters." } };
    const { error } = await supabase.rpc("nominate_paper", { p_award: award, p_submission: sub, p_reason: reason || null });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "awards");
    return { ok: true };
  });
}

export async function toggleShortlist(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, supabase } = await load(fd, "chair");
    const id = s(fd, "nominationId");
    if (!uuid.safeParse(id).success) return { error: "Bad request." };
    const { error } = await supabase.rpc("set_award_shortlist", { p_nomination: id, p_on: s(fd, "on") === "true" });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "awards");
    return { ok: true };
  });
}

export async function castVote(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const slug = s(fd, "slug");
    if (!slugSchema.safeParse(slug).success) return { error: "Bad request." };
    const award = s(fd, "awardId"), sub = s(fd, "submissionId");
    if (!uuid.safeParse(award).success || !uuid.safeParse(sub).success) return { error: "Bad request." };
    const supabase = await createClient();   // committee members may hold no organizer role: the RPC checks membership
    const { error } = await supabase.rpc("cast_award_vote", { p_award: award, p_submission: sub });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "awards");
    return { ok: true };
  });
}

export async function pickWinner(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, supabase } = await load(fd, "chair");
    const award = s(fd, "awardId"), sub = s(fd, "submissionId");
    if (!uuid.safeParse(award).success || !uuid.safeParse(sub).success) return { error: "Bad request." };
    const { error } = await supabase.rpc("pick_award_winner", { p_award: award, p_submission: sub });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "awards");
    return { ok: true };
  });
}

export async function announceAward(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, supabase } = await load(fd, "chair");
    const award = s(fd, "awardId");
    if (!uuid.safeParse(award).success) return { error: "Bad request." };
    const { error } = await supabase.rpc("announce_award", { p_award: award });
    if (error) return { error: friendlyDb(error.message) };
    revalidatePath(`/[lang]/program/${slug}`, "layout");
    done(slug, "awards");
    return { ok: true };
  });
}

/* ================================================================ BL01 — billing (owner) */

const PLANS = ["workshop", "conference", "society"] as const;

export async function changePlan(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, supabase, venueId } = await load(fd, "owner");
    const plan = s(fd, "plan");
    if (!(PLANS as readonly string[]).includes(plan)) return { error: "Bad request." };
    const { error } = await supabase.rpc("change_plan", { p_venue: venueId, p_plan: plan });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "billing");
    return { ok: true };
  });
}

const detailsSchema = z.object({
  billing_name: z.string().max(200, "Keep it under 200 characters."),
  vat_number: z.string().max(40, "Keep it under 40 characters."),
  billing_address: z.string().max(500, "Keep it under 500 characters."),
  po_number: z.string().max(80, "Keep it under 80 characters."),
  invoice_email: z.union([z.literal(""), z.string().email("Enter a valid email address.")]),
});

export async function saveBillingDetails(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, supabase, venueId } = await load(fd, "owner");
    const parsed = detailsSchema.safeParse({
      billing_name: s(fd, "billing_name"), vat_number: s(fd, "vat_number"), billing_address: s(fd, "billing_address"),
      po_number: s(fd, "po_number"), invoice_email: s(fd, "invoice_email"),
    });
    if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
    const { error } = await supabase.rpc("save_billing_details", { p_venue: venueId, p: parsed.data });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "billing");
    return { ok: true, savedAt: new Date().toISOString() };
  });
}

/** "Bank transfer — send me an invoice": records the request and emails the PDF link to the billing address. */
export async function requestInvoice(_: OrgState, fd: FormData): Promise<OrgState> {
  return guard<OrgState>(async (): Promise<OrgState> => {
    const { slug, ctx, supabase } = await load(fd, "owner");
    const id = s(fd, "invoiceId");
    if (!uuid.safeParse(id).success) return { error: "Bad request." };
    const { data, error } = await supabase.rpc("request_invoice", { p_invoice: id });
    if (error) return { error: friendlyDb(error.message) };
    const r = data as { number: string; email: string };
    const to = r.email || ctx.ws.me.email;
    let emailed = false;
    if (to && emailConfigured()) {
      const link = absUrl(`/api/manage/${slug}/invoices/${id}`);
      const body = `Invoice ${r.number} for ${ctx.label} is ready.\n\nDownload it here (sign-in required): ${link}\n\nPay by bank transfer using the details on the invoice and quote the invoice number.`;
      const res = await sendEmail({ to, subject: `Invoice ${r.number} · ${ctx.label}`, text: body, html: textToHtml(body) });
      emailed = res.ok;
    }
    done(slug, "billing");
    return { ok: true, emailed, email: to ?? "" };
  });
}
