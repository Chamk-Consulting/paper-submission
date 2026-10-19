"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hashToken, newToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email/send";
import { MERGE_COOKIE } from "@/lib/account-help/constants";

/* AH02 account help: lost email, merge two accounts, claim a paper. Messages are English keys; the forms translate them. */

export type HelpState = { error?: string; ref?: string; at?: number };
export type Candidate = { person_id: string; position: number; name: string; email: string | null };
export type FindState = {
  error?: string; searched?: boolean; found?: boolean; submissionId?: string; number?: number; title?: string; venue?: string;
  alreadyAuthor?: boolean; pending?: boolean; candidates?: Candidate[]; authors?: number; claimed?: string;
};

const GENERIC = "Something went wrong. Please try again.";

export async function submitLostEmail(_: HelpState, fd: FormData): Promise<HelpState> {
  const p = z.object({
    name: z.string().trim().min(2, "Enter your name.").max(200),
    plenaryId: z.string().trim().max(20).optional(),
    oldEmail: z.string().trim().max(254).optional(),
    newEmail: z.string().trim().email("Enter the new email."),
    proof: z.enum(["orcid", "coauthor", "organizer"], { message: "Choose how we can confirm it’s you." }),
    note: z.string().trim().max(2000).optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]?.message ?? GENERIC };
  if (p.data.oldEmail && !z.string().email().safeParse(p.data.oldEmail).success) return { error: "The old email doesn’t look right." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_account_help", {
    p_name: p.data.name, p_plenary_id: p.data.plenaryId || null, p_old_email: p.data.oldEmail || null,
    p_new_email: p.data.newEmail, p_proof: p.data.proof, p_note: p.data.note || null,
  });
  if (error) return { error: /too many/i.test(error.message) ? "Too many requests from this address — try again in an hour." : GENERIC };
  const ref = data as string;
  await sendEmail({
    to: p.data.newEmail,
    subject: `We received your account request [${ref}]`,
    text: `Hello ${p.data.name.split(" ")[0]},\n\nWe received your request to move your Plenary account to this address. A person at Plenary checks it within 2 working days and writes back here.\n\nReference: ${ref}\n\nIf you didn't ask for this, ignore this email.`,
  });
  return { ref, at: Date.now() };
}

/* ---------------------------------------------------------------- merge */
export async function startMerge(): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in?next=/account-help/merge");
  const { token, hash } = newToken();
  const { error } = await supabase.rpc("start_merge", { p_token_hash: hash });
  if (error) redirect("/account-help/merge?e=start");
  (await cookies()).set(MERGE_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 60 });
  await supabase.auth.signOut();
  redirect("/sign-in?next=/account-help/merge");
}

export async function cancelMerge(): Promise<void> {
  (await cookies()).delete(MERGE_COOKIE);
  redirect("/account-help/merge");
}

export async function signOutForMerge(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in?next=/account-help/merge");
}

export async function confirmMerge(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(MERGE_COOKIE)?.value;
  if (!token) redirect("/account-help/merge?e=expired");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("merge_accounts", { p_token_hash: hashToken(token) });
  if (error) redirect(`/account-help/merge?e=${/expired/i.test(error.message) ? "expired" : "merge"}`);
  jar.delete(MERGE_COOKIE);
  await supabase.auth.signOut();
  const r = (data ?? {}) as { papers?: number; reviews?: number; keeper_email?: string };
  redirect(`/account-help/merge?done=1&p=${r.papers ?? 0}&r=${r.reviews ?? 0}`);
}

/* ---------------------------------------------------------------- claim */
export async function findPaper(_: FindState, fd: FormData): Promise<FindState> {
  const p = z.object({ number: z.coerce.number().int().min(1).max(99999), venue: z.string().trim().min(2).max(120) })
    .safeParse({ number: String(fd.get("number") ?? "").replace(/^#/, ""), venue: fd.get("venue") });
  if (!p.success) return { error: "Enter the paper number and the venue." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_claimable_paper", { p_number: p.data.number, p_venue: p.data.venue });
  if (error) {
    if (/too many/i.test(error.message)) return { error: "Too many lookups — try again in an hour." };
    if (/review or manage/i.test(error.message)) return { error: "You review or manage this paper, so you can’t claim it." };
    if (/sign in/i.test(error.message)) return { error: "Sign in first." };
    return { error: GENERIC };
  }
  const d = data as { found: boolean; submission_id?: string; number?: number; title?: string; venue?: string; already_author?: boolean; pending?: boolean; candidates?: Candidate[]; authors?: number };
  if (!d.found) return { searched: true, found: false };
  return { searched: true, found: true, submissionId: d.submission_id, number: d.number, title: d.title, venue: d.venue, alreadyAuthor: d.already_author, pending: d.pending, candidates: d.candidates ?? [], authors: d.authors };
}

export async function requestClaim(prev: FindState, fd: FormData): Promise<FindState> {
  const p = z.object({ submissionId: z.string().uuid(), placeholder: z.string().uuid() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ...prev, error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_paper_claim", { p_submission: p.data.submissionId, p_placeholder: p.data.placeholder });
  if (error) {
    if (/already an author/i.test(error.message)) return { ...prev, error: "You are already an author of this paper." };
    if (/already linked/i.test(error.message)) return { ...prev, error: "That author is already linked to an account." };
    if (/does not match/i.test(error.message)) return { ...prev, error: "The name on the paper doesn’t match your profile." };
    return { ...prev, error: GENERIC };
  }
  return { ...prev, error: undefined, pending: true, claimed: p.data.placeholder };
}

export async function respondClaim(_: HelpState, fd: FormData): Promise<HelpState> {
  const p = z.object({ id: z.string().uuid(), accept: z.enum(["1", "0"]) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_paper_claim", { p_claim: p.data.id, p_accept: p.data.accept === "1" });
  if (error) {
    if (/already answered/i.test(error.message)) return { error: "This request was already answered." };
    if (/corresponding author/i.test(error.message)) return { error: "Only the corresponding author can answer." };
    if (/already an author/i.test(error.message)) return { error: "This person is already an author of the paper." };
    return { error: GENERIC };
  }
  redirect(`/account-help/claim/${p.data.id}`);
}
