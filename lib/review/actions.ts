"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/tokens";

/* Reviewer actions (RV01–RV10). Each one validates with zod, then calls an RPC / RLS-guarded table as the signed-in person. */

export type ActionState = { error?: string; ok?: boolean; result?: string; savedAt?: string };

/** English messages shown through t(). */
const MSG = {
  bad: "Something went wrong. Please try again.",
  coi: "Tick both boxes to accept.",
  coiToken: "Confirm you have no conflict first.",
  reason: "Choose a reason.",
  notFound: "This invitation could not be found.",
  locked: "Read-only — the decision has started. Ask the editor to reopen your review.",
  words: "Comments to the authors need at least 100 words.",
  notAllowed: "You can't do that on this review any more.",
  empty: "Write something first.",
  bidClosed: "Bidding is not open for you here.",
  signIn: "Sign in again to continue.",
};

const uuid = z.string().uuid();
const friendly = (msg?: string) => {
  if (!msg) return MSG.bad;
  if (/decision has started/i.test(msg)) return MSG.locked;
  if (/100 words/i.test(msg)) return MSG.words;
  if (/bidding/i.test(msg)) return MSG.bidClosed;
  if (/not found/i.test(msg)) return MSG.notFound;
  if (/conflict of interest/i.test(msg)) return MSG.coiToken;
  if (/42501|not allowed|not your|permission|row-level|review is /i.test(msg)) return MSG.notAllowed;
  return msg.replace(/^.*?:\s*/, "").replace(/^\w/, (c) => c.toUpperCase());
};

/* ---------------------------------------------------------------- RV01 availability */
const availSchema = z.object({
  availability: z.enum(["normal", "low", "off"]),
  available_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});
export async function saveAvailability(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = availSchema.safeParse({ availability: fd.get("availability"), available_from: fd.get("available_from") ?? "" });
  if (!p.success) return { error: MSG.bad };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: MSG.signIn };
  const v = p.data;
  const patch = {
    availability: v.availability,
    monthly_limit: v.availability === "normal" ? 4 : v.availability === "low" ? 1 : 0,
    available_from: v.availability === "off" && v.available_from ? v.available_from : null,
  };
  const { error } = await supabase.from("persons").update(patch).eq("user_id", auth.user.id);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/reviews");
  return { ok: true, savedAt: new Date().toISOString() };
}

/* ---------------------------------------------------------------- RV02 / RV02e invitation */
const respondSchema = z.object({
  id: uuid.optional(),
  token: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/).optional(),
  accept: z.enum(["1", "0"]),
  coi: z.literal("on").optional(),
  can: z.literal("on").optional(),
  reason: z.enum(["busy", "expertise", "conflict", "other"]).optional(),
  suggestion: z.string().trim().max(300).optional(),
});
export async function respondInvitation(_: ActionState, fd: FormData): Promise<ActionState> {
  const raw = Object.fromEntries([...fd.entries()].filter(([, v]) => v !== "")) as Record<string, string>;
  const p = respondSchema.safeParse(raw);
  if (!p.success || (!p.data.id && !p.data.token)) return { error: MSG.bad };
  const v = p.data;
  const accept = v.accept === "1";
  if (accept && v.token && !v.coi) return { error: MSG.coiToken };
  if (accept && !v.token && (!v.coi || !v.can)) return { error: MSG.coi };
  if (!accept && !v.reason) return { error: MSG.reason };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_review_invitation", {
    p_assignment: v.token ? null : v.id, p_token_hash: v.token ? hashToken(v.token) : null,
    p_accept: accept, p_coi: !!v.coi, p_reason: accept ? null : v.reason, p_suggestion: accept ? null : v.suggestion ?? null,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/reviews");
  return { ok: true, result: String(data) };
}

/* ---------------------------------------------------------------- RV03 / RV07 / RV09 save + submit */
const reviewSchema = z.object({
  id: uuid,
  scores: z.record(z.string().max(40), z.number().int().min(1).max(5)),
  recommendation: z.enum(["accept", "weak_accept", "borderline", "weak_reject", "reject", "major_revision", "accept_minor", "another_revision"]).nullable(),
  confidence: z.enum(["low", "medium", "high"]).nullable(),
  to_authors: z.string().max(30000),
  to_editor: z.string().max(10000),
  submit: z.boolean(),
  round2: z.array(z.object({ n: z.number().int(), addressed: z.enum(["yes", "partly", "no"]) })).max(100).nullable().optional(),
  remaining: z.string().max(10000).nullable().optional(),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export async function saveReview(input: ReviewInput): Promise<ActionState> {
  const p = reviewSchema.safeParse(input);
  if (!p.success) return { error: MSG.bad };
  const v = p.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_review", {
    p_assignment: v.id, p_scores: v.scores, p_recommendation: v.recommendation, p_confidence: v.confidence,
    p_to_authors: v.to_authors, p_to_editor: v.to_editor, p_submit: v.submit,
    p_round2: v.round2 ?? null, p_remaining: v.remaining ?? null,
  });
  if (error) return { error: friendly(error.message) };
  const result = String(data);
  revalidatePath("/reviews");
  revalidatePath(`/reviews/${v.id}`, "layout");
  return { ok: true, result, savedAt: new Date().toISOString() };
}

/* ---------------------------------------------------------------- RV04 / RV08 ORCID credit */
export async function setOrcid(id: string, on: boolean): Promise<ActionState> {
  if (!uuid.safeParse(id).success) return { error: MSG.bad };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_review_orcid", { p_assignment: id, p_on: on });
  if (error) return { error: friendly(error.message) };
  return { ok: true };
}

/* ---------------------------------------------------------------- RV05 private notes */
const noteSchema = z.object({ assignment: uuid, page: z.coerce.number().int().min(1).max(999).optional(), body: z.string().trim().min(1, MSG.empty).max(4000) });
export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = noteSchema.safeParse({ assignment: fd.get("assignment"), page: fd.get("page") || undefined, body: fd.get("body") ?? "" });
  if (!p.success) return { error: p.error.issues[0]?.message === MSG.empty ? MSG.empty : MSG.bad };
  const supabase = await createClient();
  const { error } = await supabase.from("review_notes").insert({ assignment_id: p.data.assignment, page: p.data.page ?? null, body: p.data.body });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/reviews/${p.data.assignment}/paper`);
  return { ok: true };
}
export async function setNoteInReview(assignment: string, noteId: string, inReview: boolean): Promise<ActionState> {
  if (!uuid.safeParse(noteId).success || !uuid.safeParse(assignment).success) return { error: MSG.bad };
  const supabase = await createClient();
  const { error } = await supabase.from("review_notes").update({ in_review: inReview }).eq("id", noteId).select("id").single();
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/reviews/${assignment}/paper`);
  return { ok: true };
}
export async function deleteNote(assignment: string, noteId: string): Promise<ActionState> {
  if (!uuid.safeParse(noteId).success || !uuid.safeParse(assignment).success) return { error: MSG.bad };
  const supabase = await createClient();
  const { error } = await supabase.from("review_notes").delete().eq("id", noteId);
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/reviews/${assignment}/paper`);
  return { ok: true };
}

/* ---------------------------------------------------------------- RV06 more time */
const extSchema = z.object({
  id: uuid,
  option: z.enum(["d3", "d7", "d14", "hand_back"]),
  message: z.string().trim().max(2000).optional(),
  suggestion: z.string().trim().max(300).optional(),
});
export async function requestExtension(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = extSchema.safeParse({ id: fd.get("id"), option: fd.get("option"), message: fd.get("message") ?? undefined, suggestion: fd.get("suggestion") ?? undefined });
  if (!p.success) return { error: MSG.bad };
  const v = p.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_extension", { p_assignment: v.id, p_option: v.option, p_message: v.message || null, p_suggestion: v.suggestion || null });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/reviews");
  revalidatePath(`/reviews/${v.id}`, "layout");
  return { ok: true, result: String(data) };
}
export async function acceptCounterOffer(assignment: string, request: string): Promise<ActionState> {
  if (!uuid.safeParse(request).success || !uuid.safeParse(assignment).success) return { error: MSG.bad };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_counter_offer", { p_request: request });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/reviews/${assignment}`, "layout");
  return { ok: true };
}
export async function cancelExtension(assignment: string, request: string): Promise<ActionState> {
  if (!uuid.safeParse(request).success || !uuid.safeParse(assignment).success) return { error: MSG.bad };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_extension", { p_request: request });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/reviews/${assignment}`, "layout");
  return { ok: true };
}

/* ---------------------------------------------------------------- RV07 discussion */
const postSchema = z.object({ id: uuid, submission: uuid, body: z.string().trim().min(1).max(8000) });
export async function postDiscussion(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = postSchema.safeParse({ id: fd.get("id"), submission: fd.get("submission"), body: fd.get("body") ?? "" });
  if (!p.success) return { error: MSG.empty };
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_discussion", { p_submission: p.data.submission, p_body: p.data.body });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/reviews/${p.data.id}/discussion`);
  return { ok: true, savedAt: new Date().toISOString() };
}

/* ---------------------------------------------------------------- RV10 bidding */
const bidSchema = z.object({ submission: uuid, level: z.enum(["eager", "willing", "not_my_area", "conflict"]).nullable() });
export async function placeBid(submission: string, level: string | null): Promise<ActionState> {
  const p = bidSchema.safeParse({ submission, level });
  if (!p.success) return { error: MSG.bad };
  const supabase = await createClient();
  const { error } = await supabase.rpc("place_bid", { p_submission: p.data.submission, p_level: p.data.level });
  if (error) return { error: friendly(error.message) };
  return { ok: true };
}
