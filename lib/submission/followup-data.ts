import "server-only";
import { createClient } from "@/lib/supabase/server";

/* Loaders for the author follow-up screens (SB10–SB15, CA01). RLS + author RPCs decide what comes back. */

export type FollowInfo = {
  rebuttal: boolean; withdrawReason: string | null; aiPolicy: string; copyrightMode: string; dates: Record<string, string>;
  reviews: { cancelled: number; active: number; submitted: number };
  stats: { papers: number; accepted: number } | null; chair: string | null; addedBy: string | null; myAffiliations: string[];
  authors: { personId: string; confirmation: "pending" | "confirmed" | "declined"; affiliation: string | null; respondedAt: string | null; isMe: boolean }[];
};
export type Decision = { decision: "accept_oral" | "accept_poster" | "conditional" | "reject" | "desk_reject"; letter: string | null; editorSummary: string | null; releasedAt: string; revisionDueAt: string | null };
export type PaperReview = { assignmentId: string; label: string; round: number; scores: Record<string, number>; recommendation: string | null; toAuthors: string };
export type Snapshot = { title?: string; abstract?: string | null; short_title?: string | null; keywords?: string[]; authors?: string[]; conflicts?: number; paper?: { id: string; name: string; pages: number | null; version: number } | null };
export type Version = { no: number; kind: string; changed: string[]; snapshot: Snapshot; receipt: string; notified: boolean; createdAt: string };
export type FinalState = {
  finalTitle: string | null; lockedAt: string | null; copyrightType: string | null; copyrightStatus: "not_started" | "waiting" | "signed"; copyrightSigner: string | null; copyrightSignedAt: string | null;
  presenterId: string | null; remoteRequested: boolean; status: string; receipt: string | null; submittedAt: string | null; attestComments: boolean; attestNoshow: boolean;
};
export type Registration = { personId: string; name: string; registered: boolean; coversPaper: boolean; number: string | null };
export type RevisionState = { round: number; status: string; summary: { item: string }[]; receipt: string | null; submittedAt: string | null; responses: { assignmentId: string | null; commentNo: number; quote: string | null; response: string; changedIn: string | null }[] };
export type RebuttalReview = { assignmentId: string; label: string; scores: Record<string, number>; recommendation: string | null; toAuthors: string; response: string; closesAt: string };

export async function loadInfo(id: string): Promise<FollowInfo | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("author_followup_info", { p_submission: id });
  if (!data) return null;
  const d = data as Record<string, unknown>;
  const r = (d.reviews ?? {}) as Record<string, number>;
  return {
    rebuttal: !!d.rebuttal, withdrawReason: (d.withdraw_reason as string) ?? null, aiPolicy: String(d.ai_policy ?? "language_only"), copyrightMode: String(d.copyright_mode ?? "ieee_ecf"),
    dates: (d.dates as Record<string, string>) ?? {}, reviews: { cancelled: Number(r.cancelled ?? 0), active: Number(r.active ?? 0), submitted: Number(r.submitted ?? 0) },
    stats: d.stats ? { papers: Number((d.stats as Record<string, number>).papers), accepted: Number((d.stats as Record<string, number>).accepted) } : null,
    chair: (d.chair as string) ?? null, addedBy: (d.added_by as string) ?? null, myAffiliations: ((d.my_affiliations as string[]) ?? []).filter(Boolean),
    authors: ((d.authors as Record<string, unknown>[]) ?? []).map((a) => ({ personId: a.person_id as string, confirmation: (a.confirmation as FollowInfo["authors"][number]["confirmation"]) ?? "pending", affiliation: (a.affiliation as string) ?? null, respondedAt: (a.responded_at as string) ?? null, isMe: !!a.is_me })),
  };
}

export async function loadDecision(id: string): Promise<Decision | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("decisions").select("decision, letter, editor_summary, released_at, revision_due_at").eq("submission_id", id).not("released_at", "is", null).maybeSingle();
  return data ? { decision: data.decision, letter: data.letter, editorSummary: data.editor_summary, releasedAt: data.released_at, revisionDueAt: data.revision_due_at } : null;
}

export async function loadPaperReviews(id: string): Promise<PaperReview[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("paper_reviews", { p_submission: id });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ assignmentId: r.assignment_id as string, label: r.label as string, round: Number(r.round ?? 1), scores: (r.scores as Record<string, number>) ?? {}, recommendation: (r.recommendation as string) ?? null, toAuthors: (r.to_authors as string) ?? "" }));
}

export async function loadVersions(id: string, ensure = false): Promise<Version[]> {
  const supabase = await createClient();
  if (ensure) await supabase.rpc("ensure_version_baseline", { p_submission: id });
  const { data } = await supabase.from("submission_versions").select("version_no, kind, changed_fields, snapshot, receipt, coauthors_notified, created_at").eq("submission_id", id).order("version_no", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((v) => ({ no: v.version_no as number, kind: v.kind as string, changed: (v.changed_fields as string[]) ?? [], snapshot: (v.snapshot as Snapshot) ?? {}, receipt: v.receipt as string, notified: !!v.coauthors_notified, createdAt: v.created_at as string }));
}

export type EditPreview = { version: number; previous: Snapshot; current: Snapshot; changed: string[] };
export async function loadEditPreview(id: string): Promise<EditPreview | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("edit_preview", { p_submission: id });
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return { version: Number(d.version ?? 0), previous: (d.previous as Snapshot) ?? {}, current: (d.current as Snapshot) ?? {}, changed: (d.changed as string[]) ?? [] };
}

export const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  abstract: "Abstract",
  short_title: "Short title",
  authors: "Authors",
  keywords: "Keywords",
  conflicts: "Conflicts",
  paper: "PDF",
};

export async function loadFinal(id: string): Promise<FinalState | null> {
  const supabase = await createClient();
  const { data: f } = await supabase.from("final_versions").select("*").eq("submission_id", id).maybeSingle();
  if (!f) return null;
  return {
    finalTitle: f.final_title, lockedAt: f.title_locked_at, copyrightType: f.copyright_type, copyrightStatus: f.copyright_status, copyrightSigner: f.copyright_signer, copyrightSignedAt: f.copyright_signed_at,
    presenterId: f.presenter_id, remoteRequested: !!f.remote_requested, status: f.status, receipt: f.receipt, submittedAt: f.submitted_at, attestComments: !!f.attest_comments, attestNoshow: !!f.attest_noshow,
  };
}

export async function loadRegistrations(id: string): Promise<Registration[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("paper_registrations", { p_submission: id });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ personId: r.person_id as string, name: (r.display_name as string) ?? "", registered: !!r.registered, coversPaper: !!r.covers_paper, number: (r.reg_number as string) ?? null }));
}

export async function loadRevision(id: string): Promise<RevisionState | null> {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("revisions").select("round, status, change_summary, receipt, submitted_at").eq("submission_id", id).order("round", { ascending: false }).limit(1);
  const rev = rows?.[0];
  const round = rev?.round ?? 1;
  const { data: resp } = await supabase.from("author_responses").select("assignment_id, comment_no, quote, response, changed_in").eq("submission_id", id).eq("kind", "revision").eq("round", round);
  return {
    round, status: rev?.status ?? "draft", summary: ((rev?.change_summary as { item: string }[]) ?? []).filter((x) => x && typeof x.item === "string"), receipt: rev?.receipt ?? null, submittedAt: rev?.submitted_at ?? null,
    responses: ((resp ?? []) as Record<string, unknown>[]).map((r) => ({ assignmentId: (r.assignment_id as string) ?? null, commentNo: Number(r.comment_no ?? 1), quote: (r.quote as string) ?? null, response: (r.response as string) ?? "", changedIn: (r.changed_in as string) ?? null })),
  };
}

export async function loadRebuttal(id: string): Promise<RebuttalReview[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("rebuttal_reviews", { p_submission: id });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ assignmentId: r.assignment_id as string, label: r.label as string, scores: (r.scores as Record<string, number>) ?? {}, recommendation: (r.recommendation as string) ?? null, toAuthors: (r.to_authors as string) ?? "", response: (r.response as string) ?? "", closesAt: r.closes_at as string }));
}

/** Reviewer comments split into numbered points (R1.1, R1.2 …) for the revision and final-version screens. */
export function commentsOf(reviews: PaperReview[]): { key: string; assignmentId: string; label: string; ordinal: string; no: number; quote: string }[] {
  const out: { key: string; assignmentId: string; label: string; ordinal: string; no: number; quote: string }[] = [];
  for (const r of reviews) {
    const ord = r.label.replace(/\D+/g, "") || "0";
    const parts = r.toAuthors.split(/\n\s*\n|\n(?=\s*(?:\d+[.)]|[-•*])\s)/).map((p) => p.replace(/^\s*(?:\d+[.)]|[-•*])\s+/, "").trim()).filter((p) => p.length > 12);
    parts.slice(0, 20).forEach((quote, i) => out.push({ key: `${r.assignmentId}:${i + 1}`, assignmentId: r.assignmentId, label: r.label, ordinal: `R${ord}`, no: i + 1, quote: quote.slice(0, 3900) }));
  }
  return out;
}

export const RECOMMENDATION: Record<string, string> = {
  accept: "Accept", weak_accept: "Weak accept", borderline: "Borderline", weak_reject: "Weak reject", reject: "Reject",
  major_revision: "Major revision", accept_minor: "Accept with minor changes", another_revision: "Another revision",
};
export const DECISION_LABEL: Record<Decision["decision"], string> = {
  accept_oral: "Accepted — oral presentation", accept_poster: "Accepted — poster", conditional: "Conditionally accepted", reject: "Not accepted", desk_reject: "Not sent to review",
};
