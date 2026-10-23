"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkPdf } from "@/lib/submission/pdf-check";
import { loadSubmission } from "@/lib/submission/data";
import { absUrl, sendMany, textToHtml } from "@/lib/email/send";
import { dropOptedOut } from "@/lib/email/optouts";
import type { ActionState } from "@/lib/submission/actions";
import { wordCount } from "@/lib/rich-text/plain";
import { pageLimitFor } from "@/lib/venues/window";

/* Server actions for the author follow-up flows (SB10–SB15, CA01). Messages are English keys, translated by the forms. */

const MSG = {
  bad: "Bad request.",
  generic: "Something went wrong. Please try again.",
  agree: "Confirm that all co-authors agree.",
  nothing: "Nothing has changed since the last version.",
  cannotEdit: "You can't edit this paper any more.",
  reason: "Choose a reason.",
  understand: "Confirm that you understand this cannot be undone.",
  typed: "Type the paper ID exactly as shown.",
  cannotWithdraw: "This paper can't be withdrawn now.",
  title: "Enter the title (10–200 characters).",
  abstract: "The abstract is limited to 250 words.",
  lock: "Tick the box to lock the title and authors.",
  lockFirst: "Lock the title and authors first.",
  copyright: "Choose a copyright type.",
  presenter: "Choose who presents.",
  presenterAuthor: "The presenter must be an author.",
  attest: "Tick both statements.",
  finalPdf: "Upload the final PDF first.",
  finalLocked: "The final version is already submitted — ask the publication chair to change it.",
  finalClosed: "The final version isn't open for this paper.",
  answerAll: "Answer every comment before submitting.",
  revisedPdf: "Upload the revised paper first.",
  revisionClosed: "No revision is open for this paper.",
  tooLong: "A response is over 2,000 characters.",
  rebuttalClosed: "The rebuttal window is closed.",
  tickAll: "Tick all three boxes.",
  notListed: "You are not listed on this paper.",
  upload: "We couldn't read the uploaded file. Try again.",
  uploadClosed: "You can't upload files to this paper now.",
};

const uuid = z.guid();
const no4 = (n: number | null) => `#${String(n ?? 0).padStart(4, "0")}`;

function friendly(msg?: string): string {
  if (!msg) return MSG.generic;
  const m = msg.toLowerCase();
  if (m.includes("co-authors agree")) return MSG.agree;
  if (m.includes("nothing has changed")) return MSG.nothing;
  if (m.includes("cannot edit")) return MSG.cannotEdit;
  if (m.includes("paper number")) return MSG.typed;
  if (m.includes("cannot withdraw")) return MSG.cannotWithdraw;
  if (m.includes("lock the title")) return MSG.lockFirst;
  if (m.includes("presenter must")) return MSG.presenterAuthor;
  if (m.includes("tick both")) return MSG.attest;
  if (m.includes("final pdf")) return MSG.finalPdf;
  if (m.includes("already submitted")) return MSG.finalLocked;
  if (m.includes("final version not open")) return MSG.finalClosed;
  if (m.includes("answer every")) return MSG.answerAll;
  if (m.includes("revised paper")) return MSG.revisedPdf;
  if (m.includes("no revision")) return MSG.revisionClosed;
  if (m.includes("2,000")) return MSG.tooLong;
  if (m.includes("rebuttal window")) return MSG.rebuttalClosed;
  if (m.includes("three statements")) return MSG.tickAll;
  if (m.includes("not listed")) return MSG.notListed;
  if (m.includes("cannot upload")) return MSG.uploadClosed;
  return MSG.generic;
}

const idOf = (fd: FormData) => {
  const id = String(fd.get("submissionId") ?? "");
  return uuid.safeParse(id).success ? id : null;
};
const refresh = (id: string) => {
  revalidatePath(`/submissions/${id}`, "layout");
  revalidatePath("/workspace", "layout");
};
const on = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

/** Email the other authors (best-effort; skipped when email isn't configured). */
async function emailCoauthors(id: string, subject: string, body: string) {
  const ctx = await loadSubmission(id);
  if (!ctx) return 0;
  const to = ctx.authors.filter((a) => !a.isYou && a.email).map((a) => a.email!);
  if (!to.length) return 0;
  const text = `${body}\n\n${absUrl(`/submissions/${id}`)}`;
  const supabase = await createClient();
  const r = await sendMany(await dropOptedOut(supabase, to.map((addr) => ({ to: addr, subject, text, html: textToHtml(text) })), "coauthor_changes"));
  return r.sent;
}

/* ---------------------------------------------------------------- SB10 edit */

const editSchema = z.object({
  title: z.string().trim().min(10, MSG.title).max(200, MSG.title),
  abstract: z.string().trim().max(4000).refine((s) => !s || wordCount(s) <= 250, MSG.abstract),
  shortTitle: z.string().trim().max(80).optional(),
});

export async function saveEditFields(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd);
  if (!id) return { error: MSG.bad };
  const parsed = editSchema.safeParse({ title: fd.get("title") ?? "", abstract: fd.get("abstract") ?? "", shortTitle: fd.get("shortTitle") ?? undefined });
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("submissions")
    .update({ title: parsed.data.title, abstract: parsed.data.abstract || null, short_title: parsed.data.shortTitle || null })
    .eq("id", id).eq("stage", "submitted").select("id");
  if (error || !data?.length) return { error: MSG.cannotEdit };
  refresh(id);
  if (fd.get("intent") === "review") redirect(`/submissions/${id}/edit/review`);
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function saveEditVersion(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd);
  if (!id) return { error: MSG.bad };
  if (!on(fd, "agree")) return { fieldErrors: { agree: MSG.agree } };
  const notify = on(fd, "notify");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_edit_version", { p_submission: id, p_agree: true, p_notify: notify });
  if (error || !data) return { error: friendly(error?.message) };
  const r = data as { receipt: string; version: number; changed: string[] };
  if (notify) {
    const ctx = await loadSubmission(id);
    if (ctx) {
      const who = ctx.me.person ? `${ctx.me.person.given_name} ${ctx.me.person.family_name}`.trim() : ctx.me.email;
      await emailCoauthors(id, `${no4(ctx.sub.number)} is now version ${r.version} · ${ctx.venue.acr}`,
        `${who} saved version ${r.version} of “${ctx.sub.title}”.\n\nChanged: ${r.changed.join(", ")}.\nReceipt: ${r.receipt}`);
    }
  }
  refresh(id);
  redirect(`/submissions/${id}/edit/done`);
}

/* ---------------------------------------------------------------- SB11 withdraw */

const REASONS = ["error", "other_venue", "not_ready", "disagreement", "other"] as const;

export async function startWithdraw(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd);
  if (!id) return { error: MSG.bad };
  const reason = String(fd.get("reason") ?? "");
  if (!REASONS.includes(reason as (typeof REASONS)[number])) return { fieldErrors: { reason: MSG.reason } };
  const note = String(fd.get("note") ?? "").trim().slice(0, 1000);
  const q = new URLSearchParams({ reason });
  if (note) q.set("note", note);
  redirect(`/submissions/${id}/withdraw/confirm?${q}`);
}

export async function confirmWithdraw(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd);
  if (!id) return { error: MSG.bad };
  const reason = String(fd.get("reason") ?? "");
  const errs: Record<string, string> = {};
  if (!REASONS.includes(reason as (typeof REASONS)[number])) errs.reason = MSG.reason;
  if (!on(fd, "understand")) errs.understand = MSG.understand;
  if (!on(fd, "agree")) errs.agree = MSG.agree;
  const typed = String(fd.get("typed") ?? "").trim();
  if (!typed) errs.typed = MSG.typed;
  if (Object.keys(errs).length) return { fieldErrors: errs };
  const supabase = await createClient();
  const { data: receipt, error } = await supabase.rpc("withdraw_paper", { p_submission: id, p_reason: reason, p_note: String(fd.get("note") ?? "").slice(0, 2000), p_typed_number: typed.replace(/^#/, "") });
  if (error) return /paper number/i.test(error.message) ? { fieldErrors: { typed: MSG.typed } } : { error: friendly(error.message) };
  await supabase.rpc("after_withdraw", { p_submission: id });
  const ctx = await loadSubmission(id);
  if (ctx) {
    const who = ctx.me.person ? `${ctx.me.person.given_name} ${ctx.me.person.family_name}`.trim() : ctx.me.email;
    await emailCoauthors(id, `Paper ${no4(ctx.sub.number)} withdrawn · ${ctx.venue.acr}`, `${who} withdrew “${ctx.sub.title}” from ${ctx.venue.acr}. This cannot be undone.`);
  }
  refresh(id);
  redirect(`/submissions/${id}/withdraw/done?r=${encodeURIComponent(String(receipt ?? ""))}`);
}

/* ---------------------------------------------------------------- follow-up uploads (SB12, SB14b) */

const FOLLOWUP_ROLES = ["revision", "highlighted", "final", "slides", "supplementary"] as const;

export async function finishFollowupUpload(input: { submissionId: string; role: (typeof FOLLOWUP_ROLES)[number]; path: string; name: string; size: number; mime: string }): Promise<{ error?: string; status?: string }> {
  if (!uuid.safeParse(input.submissionId).success || !FOLLOWUP_ROLES.includes(input.role) || !input.path.startsWith(`${input.submissionId}/`)) return { error: MSG.bad };
  const ctx = await loadSubmission(input.submissionId);
  if (!ctx || !["revise", "final", "done"].includes(ctx.sub.stage)) return { error: MSG.uploadClosed };
  const supabase = await createClient();
  let pages: number | null = null;
  let check: Record<string, unknown> = {};
  if (input.mime === "application/pdf" && input.role !== "supplementary") {
    const { data: blob, error } = await supabase.storage.from("papers").download(input.path);
    if (error || !blob) return { error: MSG.upload };
    const result = await checkPdf(new Uint8Array(await blob.arrayBuffer()), {
      pageLimit: await pageLimitFor(ctx.venue, ctx.sub.paperType),
      doubleBlind: input.role === "revision" || input.role === "highlighted" ? ctx.venue.doubleBlind : false,
      names: ctx.authors.flatMap((a) => a.name.split(/\s+/).filter((p) => p.length >= 4)),
      institutions: ctx.authors.map((a) => a.institution ?? "").filter(Boolean),
    });
    pages = result.pages;
    check = result;
  }
  const { error } = await supabase.rpc("record_followup_file", {
    p_submission: input.submissionId, p_role: input.role, p_path: input.path, p_name: input.name.slice(0, 200), p_size: input.size, p_mime: input.mime, p_pages: pages, p_check: check,
  });
  if (error) return { error: friendly(error.message) };
  refresh(input.submissionId);
  return { status: (check.status as string) ?? "recorded" };
}

/* ---------------------------------------------------------------- SB12 final version */

async function saveFinal(id: string, p: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_final", { p_submission: id, p });
  return { data: data as string | null, error: error ? friendly(error.message) : null };
}

export async function saveFinalTitle(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd);
  if (!id) return { error: MSG.bad };
  const title = String(fd.get("title") ?? "").trim();
  if (title.length < 10 || title.length > 200) return { fieldErrors: { title: MSG.title } };
  const lock = on(fd, "lock");
  if (fd.get("intent") !== "save" && !lock) return { fieldErrors: { lock: MSG.lock } };
  const r = await saveFinal(id, { step: "title", title, lock });
  if (r.error) return { error: r.error };
  refresh(id);
  if (fd.get("intent") === "save") return { ok: true, savedAt: new Date().toISOString() };
  redirect(`/submissions/${id}/final/copyright`);
}

export async function saveFinalCopyright(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd);
  if (!id) return { error: MSG.bad };
  const type = String(fd.get("type") ?? "");
  if (!["ieee", "open_access", "us_gov", "crown"].includes(type)) return { fieldErrors: { type: MSG.copyright } };
  const intent = String(fd.get("intent") ?? "next");
  const r = await saveFinal(id, { step: "copyright", type, started: intent === "start" });
  if (r.error) return { error: r.error };
  refresh(id);
  if (intent === "next") redirect(`/submissions/${id}/final/registration`);
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function saveFinalPresenter(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd);
  if (!id) return { error: MSG.bad };
  const presenter = String(fd.get("presenter") ?? "");
  if (!uuid.safeParse(presenter).success) return { fieldErrors: { presenter: MSG.presenter } };
  const r = await saveFinal(id, { step: "presenter", presenter, remote: on(fd, "remote") });
  if (r.error) return { error: r.error };
  refresh(id);
  redirect(`/submissions/${id}/final/review`);
}

export async function submitFinal(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd);
  if (!id) return { error: MSG.bad };
  const errs: Record<string, string> = {};
  if (!on(fd, "attestComments")) errs.attestComments = MSG.attest;
  if (!on(fd, "attestNoshow")) errs.attestNoshow = MSG.attest;
  if (Object.keys(errs).length) return { fieldErrors: errs };
  const r = await saveFinal(id, { step: "submit", attest_comments: true, attest_noshow: true });
  if (r.error) return { error: r.error };
  refresh(id);
  redirect(`/submissions/${id}/final/done`);
}

/* ---------------------------------------------------------------- SB14 revision */

const responseItem = z.object({
  assignment_id: z.guid().nullable().optional(),
  comment_no: z.number().int().min(1).max(200),
  quote: z.string().max(3900).optional(),
  response: z.string().max(6000),
  changed_in: z.string().max(200).optional(),
});

export async function saveRevision(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd);
  if (!id) return { error: MSG.bad };
  const intent = String(fd.get("intent") ?? "save");
  let responses: z.infer<typeof responseItem>[] = [];
  let summary: { item: string }[] | null = null;
  try {
    if (fd.get("responses")) responses = z.array(responseItem).max(200).parse(JSON.parse(String(fd.get("responses"))));
    if (fd.get("summary")) summary = z.array(z.object({ item: z.string().trim().min(1).max(300) })).max(30).parse(JSON.parse(String(fd.get("summary"))));
  } catch {
    return { error: MSG.bad };
  }
  const submit = intent === "submit";
  if (submit && !on(fd, "agree")) return { fieldErrors: { agree: MSG.agree } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_revision", { p_submission: id, p_responses: responses, p_summary: summary, p_submit: submit, p_agree: submit });
  if (error) return { error: friendly(error.message) };
  if (submit && on(fd, "notify")) {
    const ctx = await loadSubmission(id);
    if (ctx) await emailCoauthors(id, `Revision submitted for ${no4(ctx.sub.number)} · ${ctx.venue.acr}`, `The revision of “${ctx.sub.title}” was submitted. Receipt: ${data as string}.`);
  }
  refresh(id);
  if (submit) redirect(`/submissions/${id}/revision/done`);
  if (intent === "files") redirect(`/submissions/${id}/revision/files`);
  if (intent === "review") redirect(`/submissions/${id}/revision/review`);
  return { ok: true, savedAt: new Date().toISOString() };
}

/* ---------------------------------------------------------------- SB15 rebuttal */

export async function saveRebuttal(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd);
  if (!id) return { error: MSG.bad };
  let responses: { assignment_id: string; response: string }[];
  try {
    responses = z.array(z.object({ assignment_id: z.guid(), response: z.string().max(2000, MSG.tooLong) })).max(20).parse(JSON.parse(String(fd.get("responses") ?? "[]")));
  } catch {
    return { error: MSG.tooLong };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_rebuttal", { p_submission: id, p_responses: responses });
  if (error) return { error: friendly(error.message) };
  refresh(id);
  return { ok: true, savedAt: new Date().toISOString() };
}

/* ---------------------------------------------------------------- CA01 co-author confirmation */

export async function confirmCoauthor(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd);
  if (!id) return { error: MSG.bad };
  const accept = fd.get("intent") !== "decline";
  const attest = { contributed: on(fd, "contributed"), read: on(fd, "read"), conflicts: on(fd, "conflicts") };
  if (accept && !(attest.contributed && attest.read && attest.conflicts)) return { error: MSG.tickAll };
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_coauthorship", { p_submission: id, p_accept: accept, p_affiliation: String(fd.get("affiliation") ?? "").slice(0, 200), p_attest: attest });
  if (error) return { error: friendly(error.message) };
  refresh(id);
  return { ok: true };
}
