import "server-only";
import { createClient } from "@/lib/supabase/server";
import { readMyPerson } from "@/lib/auth/my-person";
import { hashToken } from "@/lib/tokens";
import type { Criterion, Rec } from "@/lib/review/shared";

/* Reviewer read models (RV01–RV10). Every read runs as the signed-in person; RLS + security-definer RPCs decide. */

export type MyReview = {
  assignment_id: string; submission_id: string; status: string; round: number; ordinal: number | null;
  reply_by: string; due_at: string; submitted_at: string | null; paper_number: number; title: string;
  venue_short: string; venue_slug: string; decision_released: boolean; draft_scores: number; discussion_posts: number;
};

export async function getMyReviews(): Promise<MyReview[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_reviews");
  return ((data ?? []) as MyReview[]).map((r) => ({ ...r, discussion_posts: Number(r.discussion_posts ?? 0) }));
}

export type Overview = { submitted: number; due: number; invited: number; on_time_pct: number | null; bidding: { slug: string; name: string; closes_at: string | null; bids: number }[] };
export async function getOverview(): Promise<Overview> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("reviewer_overview");
  const o = (data ?? {}) as Partial<Overview>;
  return { submitted: Number(o.submitted ?? 0), due: Number(o.due ?? 0), invited: Number(o.invited ?? 0), on_time_pct: o.on_time_pct ?? null, bidding: o.bidding ?? [] };
}

export type Availability = { availability: "normal" | "low" | "off"; available_from: string | null; monthly_limit: number };
export async function getAvailability(personId: string | undefined): Promise<Availability> {
  const fallback: Availability = { availability: "normal", available_from: null, monthly_limit: 4 };
  if (!personId) return fallback;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const data = auth.user ? await readMyPerson(supabase, auth.user.id) : null;
  const p = (data && data.id === personId ? data : {}) as Partial<Availability>;
  return { availability: p.availability ?? "normal", available_from: p.available_from ?? null, monthly_limit: p.monthly_limit ?? 4 };
}

export type Invitation = {
  assignment_id: string; status: string; reply_by: string; due_at: string; venue_name: string; venue_short: string | null; venue_slug: string;
  paper_number: number; title: string; abstract: string | null; keywords: string[] | null; paper_type: string | null; pages: number | null;
  blind_type: string | null; inviter: string | null; is_mine: boolean | null; invited_email: string | null;
};
export async function getInvitation(id: string): Promise<Invitation | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("review_invitation", { p_assignment: id, p_token_hash: null });
  return ((data ?? []) as Invitation[])[0] ?? null;
}
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("review_invitation", { p_assignment: null, p_token_hash: hashToken(token) });
  return ((data ?? []) as Invitation[])[0] ?? null;
}

export type ReviewDraft = {
  scores: Record<string, number>; recommendation: Rec | null; confidence: "low" | "medium" | "high" | null;
  to_authors: string; to_editor: string; round2: { n: number; addressed: string }[]; remaining_concerns: string | null;
  updated_at: string | null; submitted_at: string | null;
};
export type ReviewForm = {
  assignment: {
    id: string; submission_id: string; round: number; ordinal: number | null; total: number; status: string; reply_by: string; due_at: string;
    responded_at: string | null; submitted_at: string | null; receipt: string | null; locked_at: string | null; orcid_push: boolean;
    editor_rating: number | null; editor_tags: string[];
  };
  venue: { id: string; name: string; short: string; slug: string; timezone: string };
  paper: { number: number; title: string; abstract: string | null; keywords: string[]; paper_type: string | null; stage: string; withdrawn_at: string | null; pages: number | null; version: number | null; pdf_path: string | null };
  settings: { criteria: Criterion[]; blind_type: "double" | "single" | "open"; ai_policy: string; named_discussion: boolean; discussion: boolean; round2: boolean };
  ae: string | null;
  review: ReviewDraft | null;
  previous: { assignment_id: string; to_authors: string; recommendation: string | null } | null;
  responses: { n: number | null; quote: string | null; response: string; where: string | null }[];
  extension: { id: string; option: string; status: string; requested_until: string | null; offered_until: string | null; editor_message: string | null; created_at: string } | null;
  reminders: { kind: string; at: string }[];
  notes_in_review: number;
  dates: { decisions: string | null; discussion_close: string | null };
  decision: { decision: string; editor_summary: string | null; released_at: string } | null;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function getReviewForm(id: string): Promise<ReviewForm | null> {
  if (!uuidRe.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("review_form", { p_assignment: id });
  if (!data) return null;
  const f = data as ReviewForm;
  f.paper.keywords ??= [];
  f.settings.criteria ??= [];
  return f;
}

export type PaperReview = {
  assignment_id: string; label: string; reviewer_name: string | null; is_me: boolean; status: string; round: number;
  scores: Record<string, number> | null; recommendation: Rec | null; confidence: string | null; to_authors: string | null;
  to_editor: string | null; submitted_at: string | null; due_at: string | null;
};
export async function getPaperReviews(submissionId: string): Promise<PaperReview[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("paper_reviews", { p_submission: submissionId });
  return (data ?? []) as PaperReview[];
}

export type Post = { id: string; label: string; is_me: boolean; body: string; created_at: string };
export async function getDiscussion(submissionId: string): Promise<Post[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("discussion", { p_submission: submissionId });
  return (data ?? []) as Post[];
}

export type Note = { id: string; page: number | null; anchor: string | null; body: string; in_review: boolean; created_at: string };
export async function getNotes(assignmentId: string): Promise<Note[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("review_notes").select("id, page, anchor, body, in_review, created_at").eq("assignment_id", assignmentId).order("page", { ascending: true, nullsFirst: false }).order("created_at");
  return (data ?? []) as Note[];
}

export type PaperFile = { id: string; role: string; file_name: string; size_bytes: number; pages: number | null; version: number; storage_path: string };
export async function getFiles(submissionId: string): Promise<PaperFile[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("submission_files").select("id, role, file_name, size_bytes, pages, version, storage_path").eq("submission_id", submissionId).eq("is_current", true).order("role");
  return (data ?? []) as PaperFile[];
}

/** Short-lived link to a paper PDF. Reviewers read bucket 'papers' through storage RLS (is_reviewer_of). */
export async function signedPdfUrl(path: string | null, seconds = 600): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("papers").createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export type BidPaper = { submission_id: string; number: number; title: string; abstract: string | null; keywords: string[] | null; topic: string | null; my_bid: string | null };
export type BiddingVenue = { venue_id: string; name: string; open: boolean; closes_at: string | null; blind_type: string };
export async function getBidding(slug: string): Promise<{ venue: BiddingVenue; papers: BidPaper[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("bidding_venue", { p_slug: slug });
  const venue = ((data ?? []) as BiddingVenue[])[0];
  if (!venue) return null;
  const { data: papers } = await supabase.rpc("bidding_papers", { p_venue: venue.venue_id });
  return { venue, papers: (papers ?? []) as BidPaper[] };
}
