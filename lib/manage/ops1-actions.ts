"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/auth/me";
import { friendlyDb, venueIdBySlug } from "@/lib/manage/actions-util";
import { absUrl, renderTemplate, sendEmail, sendMany, emailConfigured, type Mail } from "@/lib/email/send";
import { dropOptedOut } from "@/lib/email/optouts";
import { newToken } from "@/lib/tokens";
import { topicMatch, paperId, DECISION_LABEL } from "@/lib/manage/ops1-shared";
import { buildLetter } from "@/lib/manage/ops1-letters";
import {
  loadAEs, loadConflictPairs, loadLetterReviews, loadMilestones, loadPaperAuthors, loadPapers, loadSlots, loadTemplates,
} from "@/lib/manage/ops1-data";

/* Organizer operations (canvas EM21–EM27). Every write goes through a security-definer RPC that re-checks the role. */

export type OpsResult = { ok?: boolean; error?: string; info?: string; count?: number; emailed?: number; inbox?: number; skipped?: boolean; id?: string };

const slugZ = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);
const uuid = z.guid();

function touch(slug: string, ...subs: string[]) {
  for (const s of ["", ...subs]) revalidatePath(`/[lang]/manage/${slug}${s}`, "page");
}

async function venueOf(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("venues").select("id, name, short_name, slug").eq("slug", slug).maybeSingle();
  return data ? { id: data.id as string, name: data.name as string, short: ((data.short_name as string) || (data.name as string)), slug: data.slug as string } : null;
}

const fmtDue = (iso: string) => {
  const d = new Date(Date.parse(iso) - 12 * 3600e3);
  return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}, 23:59 AoE`;
};

/* ------------------------------------------------------------------ EM21 desk reject (D8) */
const deskZ = z.object({ slug: slugZ, submission: uuid, reason: z.string().trim().min(2).max(80), message: z.string().trim().min(20, "Write at least a sentence for the authors.").max(4000) });

export async function deskReject(input: z.input<typeof deskZ>): Promise<OpsResult> {
  const p = deskZ.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Bad request." };
  const { slug, submission, reason, message } = p.data;
  const venue = await venueOf(slug);
  if (!venue) return { error: "Event not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_decision", { p_submission: submission, p_decision: "desk_reject", p_reason: reason, p_letter: message });
  if (error) return { error: friendlyDb(error.message) };

  const [{ data: sub }, authors, tpls] = await Promise.all([
    supabase.from("submissions").select("number, title").eq("id", submission).maybeSingle(),
    loadPaperAuthors(venue.id).then((a) => a.filter((x) => x.submissionId === submission)),
    loadTemplates(venue.id, ["decision_reject"]),
  ]);
  const tpl = tpls.decision_reject ?? { subject: "Decision on [paper.id]", body: "Dear [author.first],\n\n[link]" };
  const pid = paperId((sub?.number as number) ?? null);
  const link = absUrl(`/submissions/${submission}`);
  const mails: Mail[] = authors.filter((a) => a.email).map((a) => {
    const vars = { "author.first": a.givenName || a.name, "paper.id": pid, "paper.title": (sub?.title as string) ?? "", "venue.short": venue.short, "venue.name": venue.name, link, deadline: "" };
    return { to: a.email!, subject: renderTemplate(tpl.subject, vars).text, text: `${renderTemplate(tpl.body, vars).text.replace(/\[deadline\]/g, "")}\n\nReason: ${reason}\n\n${message}` };
  });
  const sent = await sendMany(mails);
  const ids = authors.map((a) => a.personId);
  if (ids.length) {
    await supabase.rpc("notify_people", { p_venue: venue.id, p_people: ids, p_kind: "decision", p_subject: `Decision on ${pid} — desk rejected`,
      p_body: `Reason: ${reason}\n\n${message}`, p_submission: submission, p_cta_label: "Open submission", p_cta_url: `/submissions/${submission}` });
  }
  touch(slug, "/papers", "/decisions");
  return { ok: true, emailed: sent.sent, inbox: ids.length, skipped: sent.skipped > 0 };
}

/* ------------------------------------------------------------------ EM22 assignment (E1, E2, B4) */
const assignZ = z.object({ slug: slugZ, submission: uuid, ae: uuid.nullable() });

export async function assignAE(input: z.input<typeof assignZ>): Promise<OpsResult> {
  const p = assignZ.safeParse(input);
  if (!p.success) return { error: "Bad request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_ae", { p_submission: p.data.submission, p_ae: p.data.ae });
  if (error) return { error: friendlyDb(error.message) };
  touch(p.data.slug, "/assignment", "/papers");
  return { ok: true };
}

/** "Suggest all": greedy by topic match, skipping conflicts and AEs at their limit. */
export async function suggestAll(input: { slug: string }): Promise<OpsResult> {
  const slug = slugZ.safeParse(input.slug);
  if (!slug.success) return { error: "Bad request." };
  const venueId = await venueIdBySlug(slug.data);
  if (!venueId) return { error: "Event not found." };
  const [papers, aes, coi] = await Promise.all([loadPapers(venueId), loadAEs(venueId), loadConflictPairs(venueId)]);
  const blocked = new Set(coi.map((c) => `${c.submissionId}:${c.personId}`));
  const load = new Map(aes.map((a) => [a.personId, a.load]));
  const todo = papers.filter((x) => !x.aeId && ["submitted", "review"].includes(x.stage));
  const supabase = await createClient();
  let n = 0;
  const failed: string[] = [];
  for (const paper of todo) {
    let best: string | null = null, bv = -1;
    for (const a of aes) {
      if (blocked.has(`${paper.id}:${a.personId}`) || (load.get(a.personId) ?? 0) >= a.cap) continue;
      const m = topicMatch(paper.topic, a.topics);
      if (m > bv || (m === bv && best && (load.get(a.personId) ?? 0) < (load.get(best) ?? 0))) { bv = m; best = a.personId; }
    }
    if (!best) { failed.push(paperId(paper.number)); continue; }
    const { error } = await supabase.rpc("assign_ae", { p_submission: paper.id, p_ae: best });
    if (error) { failed.push(paperId(paper.number)); continue; }
    load.set(best, (load.get(best) ?? 0) + 1);
    n++;
  }
  touch(slug.data, "/assignment", "/papers");
  return { ok: true, count: n, info: failed.length ? `No AE without a conflict and below the limit for ${failed.slice(0, 6).join(", ")}${failed.length > 6 ? "…" : ""}.` : undefined };
}

/* ------------------------------------------------------------------ EM23 invite reviewers (E3–E5, B5, B6) */
const inviteZ = z.object({ slug: slugZ, submission: uuid, person: uuid.nullable(), email: z.string().trim().max(254).email("Enter a valid email address").nullable() })
  .refine((v) => v.person || v.email, "Choose a person or enter an email address.");

export async function inviteReviewer(input: z.input<typeof inviteZ>): Promise<OpsResult> {
  const p = inviteZ.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Bad request." };
  const { slug, submission, person } = p.data;
  const venue = await venueOf(slug);
  if (!venue) return { error: "Event not found." };
  const supabase = await createClient();
  const [ms, { data: sub }, me] = await Promise.all([
    loadMilestones(venue.id),
    supabase.from("submissions").select("number, title").eq("id", submission).maybeSingle(),
    getMe(),
  ]);
  const dueMs = ms.find((m) => m.key === "reviews_due")?.at;
  const due = dueMs && Date.parse(dueMs) > Date.now() ? dueMs : new Date(Date.now() + 21 * 864e5).toISOString();

  let email = p.data.email;
  let first = "colleague";
  if (person) {
    const { data: pe } = await supabase.rpc("people_emails", { p_venue: venue.id, p_people: [person] });
    const row = ((pe ?? []) as { email: string | null; given_name: string | null }[])[0];
    email = email ?? row?.email ?? null;
    first = row?.given_name || first;
  }
  const { token, hash } = newToken();
  const { data: id, error } = await supabase.rpc("invite_reviewer", { p_submission: submission, p_person: person, p_email: email, p_token_hash: hash, p_due: due });
  if (error) return { error: friendlyDb(error.message) };

  const link = absUrl(`/invite/review/${token}`);
  const tpls = await loadTemplates(venue.id, ["reviewer_invitation"]);
  const tpl = tpls.reviewer_invitation ?? { subject: "Invitation to review [paper.id] for [venue.short]", body: "Dear [reviewer.first],\n\nWould you review “[paper.title]”? Due [deadline].\n\n[link]" };
  const vars = { "reviewer.first": first, "paper.id": paperId((sub?.number as number) ?? null), "paper.title": (sub?.title as string) ?? "", "venue.short": venue.short, "venue.name": venue.name, deadline: fmtDue(due), link };
  const subject = renderTemplate(tpl.subject, vars).text;
  const text = renderTemplate(tpl.body, vars).text;
  const allowed = email ? await dropOptedOut(supabase, [{ to: email, subject, text, replyTo: me?.email || undefined }], "review_invitation") : [];
  const r = allowed.length ? await sendEmail(allowed[0]) : { ok: false, skipped: true };
  if (person) {
    await supabase.rpc("notify_people", { p_venue: venue.id, p_people: [person], p_kind: "invite", p_subject: subject, p_body: text.replace(link, "").trim(),
      p_submission: submission, p_cta_label: "Accept or decline", p_cta_url: `/invite/review/${token}` });
  }
  touch(slug, `/papers/${submission}/reviewers`);
  return { ok: true, id: id as string, emailed: r.ok ? 1 : 0, inbox: person ? 1 : 0, skipped: !!r.skipped };
}

const ovrZ = z.object({ slug: slugZ, submission: uuid, person: uuid, reason: z.string().trim().min(10, "Explain why this is not a real conflict (10 characters or more).").max(1000) });
export async function requestOverride(input: z.input<typeof ovrZ>): Promise<OpsResult> {
  const p = ovrZ.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Bad request." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_conflict_override", { p_submission: p.data.submission, p_person: p.data.person, p_reason: p.data.reason });
  if (error) return { error: friendlyDb(error.message) };
  touch(p.data.slug, `/papers/${p.data.submission}/reviewers`);
  return { ok: true, id: data as string };
}

/* ------------------------------------------------------------------ EM24 recommendation (F1, F2, F6) */
const recZ = z.object({ slug: slugZ, submission: uuid, summary: z.string().max(20000), rec: z.enum(["accept_oral", "accept_poster", "conditional", "reject"]).nullable(), note: z.string().max(5000), send: z.boolean() });
export async function saveRecommendation(input: z.input<typeof recZ>): Promise<OpsResult> {
  const p = recZ.safeParse(input);
  if (!p.success) return { error: "Bad request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_recommendation", { p_submission: p.data.submission, p_summary: p.data.summary, p_rec: p.data.rec, p_note: p.data.note || null, p_send: p.data.send });
  if (error) return { error: friendlyDb(error.message) };
  touch(p.data.slug, `/papers/${p.data.submission}/recommendation`, "/decisions");
  return { ok: true };
}

/* ------------------------------------------------------------------ EM25 reminders (E10, I3) + extensions (C7) */
const remZ = z.object({ slug: slugZ, assignments: z.array(uuid).min(1).max(2000), test: z.boolean() });
export async function sendReminders(input: z.input<typeof remZ>): Promise<OpsResult> {
  const p = remZ.safeParse(input);
  if (!p.success) return { error: "Choose at least one paper with reviews to chase." };
  const venue = await venueOf(p.data.slug);
  if (!venue) return { error: "Event not found." };
  const supabase = await createClient();
  const want = new Set(p.data.assignments);
  const [slots, papers, tpls, me] = await Promise.all([loadSlots(venue.id), loadPapers(venue.id), loadTemplates(venue.id, ["review_reminder"]), getMe()]);
  const num = new Map(papers.map((x) => [x.id, x]));
  const list = slots.filter((s) => want.has(s.id) && (s.status === "accepted" || s.status === "invited"));
  if (!list.length) return { error: "None of the selected reviews are waiting." };
  const tpl = tpls.review_reminder ?? { subject: "Reminder: review of [paper.id] due [deadline]", body: "Dear [reviewer.first],\n\nYour review of [paper.id] is due [deadline].\n\n[link]" };
  const mailFor = (s: (typeof list)[number]) => {
    const paper = num.get(s.submissionId);
    const vars = { "reviewer.first": s.reviewer.split(" ")[0] || "colleague", "paper.id": paperId(paper?.number ?? null), "paper.title": paper?.title ?? "", "venue.short": venue.short, "venue.name": venue.name,
      deadline: fmtDue(s.dueAt), link: absUrl(`/reviews/${s.id}`) };
    return { subject: renderTemplate(tpl.subject, vars).text, text: renderTemplate(tpl.body, vars).text };
  };
  if (p.data.test) {
    if (!me?.email) return { error: "Your account has no email address." };
    const m = mailFor(list[0]);
    const r = await sendEmail({ to: me.email, subject: `[Test] ${m.subject}`, text: m.text });
    return { ok: true, emailed: r.ok ? 1 : 0, skipped: !!r.skipped, info: r.ok ? `Test sent to ${me.email}.` : r.skipped ? "Email sending isn’t configured yet — nothing was sent." : r.error };
  }
  const mails: Mail[] = [];
  let inbox = 0;
  for (const s of list) {
    const m = mailFor(s);
    if (s.email) mails.push({ to: s.email, subject: m.subject, text: m.text, replyTo: me?.email || undefined });
    if (s.reviewerId) {
      const { error } = await supabase.rpc("notify_people", { p_venue: venue.id, p_people: [s.reviewerId], p_kind: "message", p_subject: m.subject, p_body: m.text.replace(/https?:\/\/\S+/g, "").trim(),
        p_submission: s.submissionId, p_cta_label: "Open review", p_cta_url: `/reviews/${s.id}` });
      if (!error) inbox++;
    }
  }
  const sent = await sendMany(mails);
  const { data: logged } = await supabase.rpc("log_reminders", { p_assignments: list.map((s) => s.id), p_kind: "manual" });
  touch(p.data.slug, "/reviews");
  return { ok: true, count: Number(logged ?? list.length), emailed: sent.sent, inbox, skipped: sent.skipped > 0 };
}

const extZ = z.object({ slug: slugZ, request: uuid, approve: z.boolean(), offer: z.string().datetime().nullable(), message: z.string().max(1000).nullable() });
export async function decideExtension(input: z.input<typeof extZ>): Promise<OpsResult> {
  const p = extZ.safeParse(input);
  if (!p.success) return { error: "Bad request." };
  const venueId = await venueIdBySlug(p.data.slug);
  if (!venueId) return { error: "Event not found." };
  const ms = await loadMilestones(venueId);
  const dec = ms.find((m) => m.key === "decisions")?.at;
  if (p.data.offer && dec && Date.parse(p.data.offer) >= Date.parse(dec)) return { error: "An extension can’t end after decisions start (C7)." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_extension", { p_request: p.data.request, p_approve: p.data.approve, p_offer: p.data.offer, p_message: p.data.message });
  if (error) return { error: friendlyDb(error.message) };
  touch(p.data.slug, "/reviews");
  return { ok: true, info: data as string };
}

/* ------------------------------------------------------------------ EM26 decisions (F1, F2, F4) */
const decZ = z.object({ slug: slugZ, submission: uuid, decision: z.enum(["accept_oral", "accept_poster", "conditional", "reject"]).nullable() });
export async function setDecision(input: z.input<typeof decZ>): Promise<OpsResult> {
  const p = decZ.safeParse(input);
  if (!p.success) return { error: "Bad request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_decision", { p_submission: p.data.submission, p_decision: p.data.decision, p_reason: null, p_letter: null });
  if (error) return { error: friendlyDb(error.message) };
  touch(p.data.slug, "/decisions", "/decisions/letters");
  return { ok: true };
}

/* ------------------------------------------------------------------ EM27 letters & release (F4–F6, I3, I4) */
type Pending = { submissionId: string; number: number | null; title: string; decision: string; letter: string | null; summary: string | null; revisionDue: string | null; paperType: string };

async function pendingDecisions(venueId: string, paperType: string | null, batch: string | null): Promise<Pending[]> {
  const supabase = await createClient();
  if (batch) {
    const { data } = await supabase.rpc("batch_letters", { p_batch: batch });
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ submissionId: r.submission_id as string, number: (r.number as number) ?? null, title: r.title as string, decision: r.decision as string,
      letter: (r.letter as string) ?? null, summary: (r.editor_summary as string) ?? null, revisionDue: (r.revision_due_at as string) ?? null, paperType: "" }));
  }
  const papers = (await loadPapers(venueId)).filter((x) => x.decision && x.decision !== "desk_reject" && !x.released && (!paperType || x.paperType === paperType));
  const { data: d } = await supabase.from("decisions").select("submission_id, letter").in("submission_id", papers.map((x) => x.id).slice(0, 1000));
  const letters = new Map(((d ?? []) as { submission_id: string; letter: string | null }[]).map((x) => [x.submission_id, x.letter]));
  const { data: recs } = await supabase.from("ae_recommendations").select("submission_id, summary").not("sent_at", "is", null).in("submission_id", papers.map((x) => x.id).slice(0, 1000));
  const sums = new Map(((recs ?? []) as { submission_id: string; summary: string }[]).map((x) => [x.submission_id, x.summary]));
  return papers.map((x) => ({ submissionId: x.id, number: x.number, title: x.title, decision: x.decision!, letter: letters.get(x.id) ?? null, summary: sums.get(x.id) ?? null, revisionDue: null, paperType: x.paperType }));
}

export async function sendTestLetters(input: { slug: string }): Promise<OpsResult> {
  const slug = slugZ.safeParse(input.slug);
  if (!slug.success) return { error: "Bad request." };
  const venue = await venueOf(slug.data);
  const me = await getMe();
  if (!venue || !me?.email) return { error: "Your account has no email address." };
  const [pend, tpls, reviews, ms] = await Promise.all([
    pendingDecisions(venue.id, null, null), loadTemplates(venue.id, ["decision_accept", "decision_conditional", "decision_reject"]), loadLetterReviews(venue.id), loadMilestones(venue.id),
  ]);
  const finals = ms.find((m) => m.key === "finals")?.at ?? null;
  const one = new Map<string, Pending>();
  for (const x of pend) if (!one.has(x.decision)) one.set(x.decision, x);
  if (!one.size) return { error: "No drafted decisions to preview yet." };
  const mails = [...one.values()].map((x) => {
    const l = buildLetter(x, me.person?.given_name ?? "", venue, tpls, reviews, finals);
    return { to: me.email, subject: `[Test · ${DECISION_LABEL[x.decision]}] ${l.subject}`, text: l.text };
  });
  const r = await sendMany(mails);
  return { ok: true, emailed: r.sent, count: mails.length, skipped: r.skipped > 0,
    info: r.skipped ? "Email sending isn’t configured yet — nothing was sent." : `${r.sent} test letter(s) sent to ${me.email}.` };
}

const relZ = z.object({ slug: slugZ, paperType: z.string().max(40).nullable(), confirmLarge: z.boolean(), checked: z.literal(true, { message: "Tick the confirmation first." }) });
export async function releaseDecisions(input: z.input<typeof relZ>): Promise<OpsResult> {
  const p = relZ.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Bad request." };
  const venue = await venueOf(p.data.slug);
  if (!venue) return { error: "Event not found." };
  const supabase = await createClient();
  const { data: n, error } = await supabase.rpc("release_decisions", { p_venue: venue.id, p_paper_type: p.data.paperType, p_confirm_large: p.data.confirmLarge });
  if (error) return { error: friendlyDb(error.message) };
  const { data: b } = await supabase.from("decision_batches").select("id").eq("venue_id", venue.id).order("released_at", { ascending: false }).limit(1).maybeSingle();
  const batch = (b?.id as string) ?? null;
  if (!batch) return { ok: true, count: Number(n ?? 0) };

  const [letters, authors, tpls, reviews, ms, me] = await Promise.all([
    pendingDecisions(venue.id, null, batch), loadPaperAuthors(venue.id), loadTemplates(venue.id, ["decision_accept", "decision_conditional", "decision_reject"]),
    loadLetterReviews(venue.id), loadMilestones(venue.id), getMe(),
  ]);
  const finals = ms.find((m) => m.key === "finals")?.at ?? null;
  const byPaper = new Map<string, typeof authors>();
  for (const a of authors) byPaper.set(a.submissionId, [...(byPaper.get(a.submissionId) ?? []), a]);
  const mails: Mail[] = [];
  let inbox = 0;
  for (const l of letters) {
    const people = byPaper.get(l.submissionId) ?? [];
    for (const a of people) {
      if (!a.email) continue;
      const m = buildLetter(l, a.givenName || a.name, venue, tpls, reviews, finals);
      mails.push({ to: a.email, subject: m.subject, text: m.text, replyTo: me?.email || undefined });
    }
    if (people.length) {
      const m = buildLetter(l, "", venue, tpls, reviews, finals);
      const { error: e } = await supabase.rpc("notify_people", { p_venue: venue.id, p_people: people.map((a) => a.personId), p_kind: "decision", p_subject: m.subject,
        p_body: m.text.replace(/^Dear [^\n]*\n+/, "").replace(/https?:\/\/\S+/g, "").trim(), p_submission: l.submissionId, p_cta_label: "Open decision", p_cta_url: `/submissions/${l.submissionId}` });
      if (!e) inbox += people.length;
    }
  }
  const sent = await sendMany(mails, 6);
  await supabase.rpc("record_batch_stats", { p_batch: batch, p_delivered: sent.sent, p_bounced: sent.failed });
  touch(p.data.slug, "/decisions", "/decisions/letters", "/papers");
  return { ok: true, count: Number(n ?? 0), emailed: sent.sent, inbox, skipped: !emailConfigured() };
}
