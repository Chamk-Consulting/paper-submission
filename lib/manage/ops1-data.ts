import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventCtx } from "@/lib/manage/data";

/* Read models for organizer operations (canvas EM20–EM27). All queries go through RLS / security-definer RPCs. */

export type PaperRow = {
  id: string; number: number | null; title: string; paperType: string; topic: string | null; stage: string;
  authorCount: number; countries: string[]; pdf: string; similarity: number | null; aeId: string | null; aeName: string | null;
  reviewsIn: number; reviewsNeeded: number; reviewsOut: number; overdue: number; avg: number | null; spread: number | null;
  aeRec: string | null; decision: string | null; released: boolean;
};

export async function loadPapers(venueId: string): Promise<PaperRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("venue_papers", { p_venue: venueId });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.submission_id as string, number: (r.number as number) ?? null, title: r.title as string, paperType: r.paper_type as string,
    topic: (r.topic as string) ?? null, stage: r.stage as string, authorCount: Number(r.author_count ?? 0), countries: (r.countries as string[]) ?? [],
    pdf: (r.pdf_check as string) ?? "no", similarity: r.similarity_pct == null ? null : Number(r.similarity_pct),
    aeId: (r.handling_ae as string) ?? null, aeName: (r.ae_name as string) ?? null,
    reviewsIn: Number(r.reviews_in ?? 0), reviewsNeeded: Number(r.reviews_needed ?? 3), reviewsOut: Number(r.reviews_out ?? 0), overdue: Number(r.overdue ?? 0),
    avg: r.avg_score == null ? null : Number(r.avg_score), spread: r.spread == null ? null : Number(r.spread),
    aeRec: (r.ae_rec as string) ?? null, decision: (r.decision as string) ?? null, released: !!r.released,
  }));
}

export type PaperAuthor = { submissionId: string; personId: string; name: string; givenName: string; email: string | null; position: number; corresponding: boolean; confirmation: string; country: string | null; institution: string | null };
export async function loadPaperAuthors(venueId: string): Promise<PaperAuthor[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("venue_paper_authors", { p_venue: venueId });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    submissionId: r.submission_id as string, personId: r.person_id as string, name: (r.display_name as string) || "—", givenName: (r.given_name as string) || "",
    email: (r.email as string) ?? null, position: Number(r.author_position ?? 1), corresponding: !!r.is_corresponding, confirmation: (r.confirmation as string) ?? "pending",
    country: (r.country as string) ?? null, institution: (r.institution as string) ?? null,
  }));
}

/** Papers the signed-in person wrote at this event (B1/B3 "1 paper hidden"). */
export async function myPaperCount(venueId: string, personId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("submission_authors").select("submission_id, submissions!inner(venue_id, stage)").eq("person_id", personId).eq("submissions.venue_id", venueId).neq("submissions.stage", "draft");
  return (data ?? []).length;
}

export type Milestone = { key: string; label: string; at: string; hard: boolean; kind: string };
export async function loadMilestones(venueId: string): Promise<Milestone[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("venue_dates").select("key, label, starts_at, is_hard, kind").eq("venue_id", venueId).order("starts_at");
  return ((data ?? []) as Record<string, unknown>[]).map((d) => ({ key: (d.key as string) ?? "", label: d.label as string, at: d.starts_at as string, hard: !!d.is_hard, kind: d.kind as string }));
}

export type DashCounts = { drafts: number; submitted: number; pdfFailed: number; similarityFlags: number; unconfirmedCoauthorPapers: number; pendingInvitations: number;
  committeeAccepted: number; committeeTotal: number; pendingExtensions: number; aesOverLoad: number; myPapers: number; deputyName: string | null };
export async function loadDashCounts(venueId: string): Promise<DashCounts> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("venue_dashboard_counts", { p_venue: venueId });
  const r = ((data ?? []) as Record<string, unknown>[])[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0);
  return { drafts: n("drafts"), submitted: n("submitted"), pdfFailed: n("pdf_failed"), similarityFlags: n("similarity_flags"), unconfirmedCoauthorPapers: n("unconfirmed_coauthor_papers"),
    pendingInvitations: n("pending_invitations"), committeeAccepted: n("committee_accepted"), committeeTotal: n("committee_total"), pendingExtensions: n("pending_extensions"),
    aesOverLoad: n("aes_over_load"), myPapers: n("my_papers"), deputyName: (r.deputy_name as string) ?? null };
}

export async function loadGoLive(venueId: string): Promise<{ key: string; ok: boolean; note: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("go_live_checks", { p_venue: venueId });
  return (data ?? []) as { key: string; ok: boolean; note: string }[];
}

export type AeRow = { personId: string; name: string; institution: string | null; load: number; cap: number; topics: string[] };
export async function loadAEs(venueId: string): Promise<AeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("venue_aes", { p_venue: venueId });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ personId: r.person_id as string, name: (r.display_name as string) || "—", institution: (r.institution as string) ?? null,
    load: Number(r.load ?? 0), cap: Number(r.cap ?? 15), topics: (r.topics as string[]) ?? [] }));
}

export async function loadConflictPairs(venueId: string): Promise<{ submissionId: string; personId: string; reason: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("venue_conflict_pairs", { p_venue: venueId });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ submissionId: r.submission_id as string, personId: r.person_id as string, reason: r.reason as string }));
}

export type PaperDetail = { id: string; venueId: string; number: number | null; title: string; abstract: string | null; keywords: string[]; topic: string | null; paperType: string; stage: string; handlingAe: string | null };
/** One paper for an AE/chair page (EM23, EM24). Only managers of the paper get through. */
export async function requirePaper(ctx: EventCtx, id: string): Promise<PaperDetail> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: s } = await supabase.from("submissions").select("id, venue_id, number, title, abstract, keywords, topic, track, paper_type, stage, handling_ae").eq("id", id).maybeSingle();
  if (!s || s.venue_id !== ctx.venue.id) notFound();
  const me = ctx.ws.me.person?.id;
  const { data: mine } = await supabase.from("submission_authors").select("person_id").eq("submission_id", id).eq("person_id", me ?? "");
  const manages = (ctx.isChair && !(mine ?? []).length) || s.handling_ae === me;
  if (!manages) redirect(`/no-access?from=${encodeURIComponent(`/manage/${ctx.venue.slug}/papers/${id}`)}`);
  return { id: s.id, venueId: s.venue_id, number: s.number, title: s.title, abstract: s.abstract, keywords: s.keywords ?? [], topic: s.topic ?? s.track ?? null, paperType: s.paper_type, stage: s.stage, handlingAe: s.handling_ae };
}

export async function loadAuthorSummary(id: string): Promise<{ count: number; institutions: string[]; countries: string[] }> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("paper_author_summary", { p_submission: id });
  const r = ((data ?? []) as Record<string, unknown>[])[0] ?? {};
  return { count: Number(r.author_count ?? 0), institutions: (r.institutions as string[]) ?? [], countries: (r.countries as string[]) ?? [] };
}

export type Invitation = { id: string; reviewerId: string | null; name: string; email: string | null; status: string; round: number; replyBy: string; dueAt: string; respondedAt: string | null; declineReason: string | null; suggestion: string | null; createdAt: string };
export async function loadInvitations(id: string): Promise<Invitation[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("paper_invitations", { p_submission: id });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ id: r.assignment_id as string, reviewerId: (r.reviewer_id as string) ?? null, name: (r.name as string) || "—", email: (r.email as string) ?? null,
    status: r.status as string, round: Number(r.round ?? 1), replyBy: r.reply_by as string, dueAt: r.due_at as string, respondedAt: (r.responded_at as string) ?? null,
    declineReason: (r.decline_reason as string) ?? null, suggestion: (r.decline_suggestion as string) ?? null, createdAt: r.created_at as string }));
}

export type Suggestion = { personId: string; name: string; institution: string | null; topics: string[]; match: number; load: number; cap: number; onTime: number; conflict: string | null; override: string | null; already: boolean };
export async function loadSuggestions(id: string): Promise<Suggestion[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("suggest_reviewers", { p_submission: id });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ personId: r.person_id as string, name: (r.display_name as string) || "—", institution: (r.institution as string) ?? null,
    topics: (r.topics as string[]) ?? [], match: Number(r.match ?? 0), load: Number(r.load ?? 0), cap: Number(r.cap ?? 4), onTime: Number(r.on_time ?? 100),
    conflict: (r.conflict as string) ?? null, override: (r.override_status as string) ?? null, already: !!r.already }))
    .sort((a, b) => Number(!!a.conflict) - Number(!!b.conflict) || b.match - a.match || a.load - b.load);
}

export type ReviewView = { id: string; label: string; reviewer: string | null; status: string; round: number; scores: Record<string, number>; recommendation: string | null; confidence: string | null; toAuthors: string; toEditor: string | null; submittedAt: string | null; dueAt: string | null };
export async function loadPaperReviews(id: string): Promise<ReviewView[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("paper_reviews", { p_submission: id });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ id: r.assignment_id as string, label: r.label as string, reviewer: (r.reviewer_name as string) ?? null, status: r.status as string,
    round: Number(r.round ?? 1), scores: (r.scores as Record<string, number>) ?? {}, recommendation: (r.recommendation as string) ?? null, confidence: (r.confidence as string) ?? null,
    toAuthors: (r.to_authors as string) ?? "", toEditor: (r.to_editor as string) ?? null, submittedAt: (r.submitted_at as string) ?? null, dueAt: (r.due_at as string) ?? null }));
}

export async function loadRecommendation(id: string): Promise<{ summary: string; recommendation: string | null; note: string | null; sentAt: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("ae_recommendations").select("summary, recommendation, confidential_note, sent_at").eq("submission_id", id).maybeSingle();
  return data ? { summary: data.summary ?? "", recommendation: data.recommendation ?? null, note: data.confidential_note ?? null, sentAt: data.sent_at ?? null } : null;
}

export async function loadScoreChanges(id: string): Promise<{ assignmentId: string; field: string; from: string | null; to: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("review_changes").select("assignment_id, field, old_value, new_value, review_assignments!inner(submission_id)").eq("review_assignments.submission_id", id).order("changed_at");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ assignmentId: r.assignment_id as string, field: r.field as string, from: (r.old_value as string) ?? null, to: (r.new_value as string) ?? null }));
}

export async function discussionCount(id: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("discussion_posts").select("id", { count: "exact", head: true }).eq("submission_id", id);
  return count ?? 0;
}

export type Slot = { id: string; submissionId: string; reviewerId: string | null; reviewer: string; email: string | null; status: string; round: number; dueAt: string; submittedAt: string | null; ordinal: number | null; reminders: number; lastReminder: string | null };
export async function loadSlots(venueId: string): Promise<Slot[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("venue_review_slots", { p_venue: venueId });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ id: r.assignment_id as string, submissionId: r.submission_id as string, reviewerId: (r.reviewer_id as string) ?? null,
    reviewer: (r.reviewer as string) || "—", email: (r.email as string) ?? null, status: r.status as string, round: Number(r.round ?? 1), dueAt: r.due_at as string,
    submittedAt: (r.submitted_at as string) ?? null, ordinal: (r.ordinal as number) ?? null, reminders: Number(r.reminders ?? 0), lastReminder: (r.last_reminder as string) ?? null }));
}

export type ExtRequest = { id: string; assignmentId: string; submissionId: string; number: number | null; reviewer: string; option: string; requestedUntil: string | null; dueAt: string; message: string | null; status: string; offeredUntil: string | null };
export async function loadExtensions(venueId: string): Promise<ExtRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("venue_extension_requests", { p_venue: venueId });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ id: r.request_id as string, assignmentId: r.assignment_id as string, submissionId: r.submission_id as string,
    number: (r.paper_number as number) ?? null, reviewer: (r.reviewer as string) || "—", option: r.option as string, requestedUntil: (r.requested_until as string) ?? null,
    dueAt: r.due_at as string, message: (r.message as string) ?? null, status: r.status as string, offeredUntil: (r.offered_until as string) ?? null }));
}

export type LetterReview = { submissionId: string; ordinal: number | null; scores: Record<string, number>; recommendation: string | null; toAuthors: string };
export async function loadLetterReviews(venueId: string): Promise<LetterReview[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("venue_letter_reviews", { p_venue: venueId });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ submissionId: r.submission_id as string, ordinal: (r.ordinal as number) ?? null, scores: (r.scores as Record<string, number>) ?? {},
    recommendation: (r.recommendation as string) ?? null, toAuthors: (r.to_authors as string) ?? "" }));
}

export type Template = { key: string; subject: string; body: string };
export async function loadTemplates(venueId: string, keys: string[]): Promise<Record<string, Template>> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_templates").select("venue_id, key, subject, body").in("key", keys);
  const out: Record<string, Template> = {};
  for (const r of (data ?? []) as { venue_id: string | null; key: string; subject: string; body: string }[]) {
    if (r.venue_id === venueId || (!out[r.key] && r.venue_id === null)) out[r.key] = { key: r.key, subject: r.subject, body: r.body };
  }
  return out;
}

export async function loadBatches(venueId: string): Promise<{ id: string; scope: string; paperType: string | null; releasedAt: string | null; recipients: number; delivered: number; bounced: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("decision_batches").select("id, scope, paper_type, released_at, recipients, delivered, bounced").eq("venue_id", venueId).order("released_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((b) => ({ id: b.id as string, scope: b.scope as string, paperType: (b.paper_type as string) ?? null, releasedAt: (b.released_at as string) ?? null,
    recipients: Number(b.recipients ?? 0), delivered: Number(b.delivered ?? 0), bounced: Number(b.bounced ?? 0) }));
}

/** Criteria keys → names for score columns. */
export function criteriaOf(ctx: EventCtx): { key: string; name: string }[] {
  const c = (ctx.settings?.criteria as { key: string; name: string }[] | undefined) ?? [];
  return c.length ? c : [{ key: "novelty", name: "Novelty" }, { key: "quality", name: "Technical quality" }, { key: "clarity", name: "Clarity" }, { key: "relevance", name: "Relevance" }];
}


/** The signed-in AE's papers at this event (EM23/EM24 side panels). */
export async function myAePapers(venueId: string, personId: string, minReviews: number): Promise<{ total: number; needReviewers: number; covered: number; recsSent: number }> {
  const supabase = await createClient();
  const { data: subs } = await supabase.from("submissions").select("id").eq("venue_id", venueId).eq("handling_ae", personId).not("stage", "in", "(withdrawn,rejected,draft)");
  const ids = ((subs ?? []) as { id: string }[]).map((s) => s.id);
  if (!ids.length) return { total: 0, needReviewers: 0, covered: 0, recsSent: 0 };
  const [{ data: ra }, { data: recs }] = await Promise.all([
    supabase.from("review_assignments").select("submission_id, status").in("submission_id", ids).eq("round", 1).in("status", ["accepted", "submitted"]),
    supabase.from("ae_recommendations").select("submission_id").in("submission_id", ids).not("sent_at", "is", null),
  ]);
  const n = new Map<string, number>();
  for (const r of (ra ?? []) as { submission_id: string }[]) n.set(r.submission_id, (n.get(r.submission_id) ?? 0) + 1);
  const covered = ids.filter((id) => (n.get(id) ?? 0) >= minReviews).length;
  return { total: ids.length, needReviewers: ids.length - covered, covered, recsSent: (recs ?? []).length };
}
