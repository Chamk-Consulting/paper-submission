"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl, safeNext } from "@/lib/config/site";
import { accountEmailFor } from "@/lib/auth/plenary-id";

export type ResendState = { ok: boolean; message?: string };

const RATE = "Please wait a little longer before asking again.";
const isRate = (e: { status?: number; message: string }) => e.status === 429 || /rate limit|seconds|too many/i.test(e.message);

/** PR04 "Resend code" on the sign-in code step: a new link + code (never creates an account). */
export async function resendSignInCode(identifier: string, next?: string): Promise<ResendState> {
  // The code step carries a Plenary ID instead of the email when the person signed in with their ID.
  const { email, id } = await accountEmailFor(identifier);
  if (id && !email) return { ok: true }; // unknown ID: same answer as a real one
  if (!email || !z.string().email().max(254).safeParse(email).success) return { ok: false, message: "That email doesn’t look right." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent(safeNext(next))}`) },
  });
  if (error && isRate(error)) return { ok: false, message: RATE };
  // Same answer whether or not the account exists.
  return { ok: true };
}

/** Check-email page: resend the confirmation link for a new account. */
export async function resendConfirmation(email: string): Promise<ResendState> {
  if (!z.string().email().max(254).safeParse(email).success) return { ok: false, message: "That email doesn’t look right." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent("/create-account/profile")}`) },
  });
  if (error && isRate(error)) return { ok: false, message: RATE };
  if (error) {
    // Accounts created with a code (no password) confirm through a new code instead.
    const r = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: absoluteUrl("/auth/confirm?next=%2Fcreate-account%2Fprofile") } });
    if (r.error && isRate(r.error)) return { ok: false, message: RATE };
  }
  return { ok: true };
}
