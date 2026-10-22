"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recordSignIn } from "@/lib/auth/sign-in-log";
import { refuseIfLocked } from "@/lib/auth/lock-check";
import { absoluteUrl, safeNext } from "@/lib/config/site";
import { detectIdentifier } from "@/lib/auth/identifier";
import { accountEmailFor, maskEmail, plenaryIdSignIn } from "@/lib/auth/plenary-id";

export type SignInState = {
  step?: "email" | "sent";
  /** where the code went (masked when the person didn't type an email) */
  sentTo?: string;
  sentKind?: string;
  email?: string;
  mode?: "signin" | "create";
  message?: string;
  /** Shown on the code step, e.g. when a code was sent moments ago. */
  notice?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

const GENERIC = "Those details didn't match an account, or the email isn't confirmed yet.";
const LOCKED = "This account is locked. Write to Plenary support from the contact page if you think this is a mistake.";

/** After any successful sign-in: /auth/continue opens the first unfinished step (plan B5), then `next`. */
const continueTo = (next?: string) => `/auth/continue?next=${encodeURIComponent(safeNext(next))}`;

/**
 * Turns whatever was typed into the account email. A Plenary ID is looked up server-side (signed request,
 * lib/auth/plenary-id.ts); `lookedUp` marks that case so the caller never shows the full email back.
 * TODO(auth): alias and phone lookup.
 */
async function resolveEmail(identifier: string): Promise<{ email: string | null; kind: string; lookedUp?: boolean }> {
  const d = detectIdentifier(identifier);
  if (d.kind === "email") return { email: identifier.trim().toLowerCase(), kind: "email" };
  if (d.kind === "id" && plenaryIdSignIn()) {
    const r = await accountEmailFor(identifier);
    if (r.id) return { email: r.email, kind: "id", lookedUp: true };
  }
  return { email: null, kind: d.kind };
}

function notYet(kind: string): SignInState {
  const what = { id: "Plenary ID", alias: "alias", phone: "phone number", pin: "PaperCept PIN" }[kind] ?? "that";
  return {
    fieldErrors: {
      identifier: [kind === "pin" ? "Plenary doesn’t use PaperCept PINs to sign in. Use your email." : `Signing in with a ${what} isn’t available yet — use your email for now.`],
    },
  };
}

const passwordSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email, phone, Plenary ID or alias").max(254),
  password: z.string().min(1, "Enter your password").max(128),
  remember: z.string().optional(),
  next: z.string().optional(),
});

export async function signInWithPassword(_: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { email, kind, lookedUp } = await resolveEmail(parsed.data.identifier);
  if (!email) return lookedUp ? { message: GENERIC } : notYet(kind);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error) {
    // B6: right password, email never confirmed (accounts made under the old order) — send a fresh code and go to that step.
    // Supabase only says "not confirmed" after the password matched, so this tells nothing to someone guessing.
    if (error.code === "email_not_confirmed" && !lookedUp) {
      const { error: e2 } = await supabase.auth.resend({ type: "signup", email });
      const q = new URLSearchParams({ email, reason: "unconfirmed" });
      if (parsed.data.next) q.set("next", safeNext(parsed.data.next));
      if (e2) q.set("wait", "1");
      redirect(`/create-account/verify?${q.toString()}`);
    }
    if (error.code === "user_banned") return { message: LOCKED };
    return { message: GENERIC };
  }
  const locked = await refuseIfLocked(supabase);
  if (locked) return { message: locked };
  await recordSignIn(supabase, "password");
  // TODO(auth): "Keep me signed in" unchecked -> session-only cookies (no persistent maxAge).
  redirect(continueTo(parsed.data.next));
}

const codeRequestSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email, phone, Plenary ID or alias").max(254),
  next: z.string().optional(),
});

/** "Email me a link": sends a sign-in link + 6-digit code. Never creates an account. */
export async function sendSignInCode(_: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = codeRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { email, kind, lookedUp } = await resolveEmail(parsed.data.identifier);
  // Unknown Plenary ID: the same code step as a real one, so nobody can test which IDs exist.
  if (!email && lookedUp) return { step: "sent", sentKind: kind, email: parsed.data.identifier.trim().toUpperCase(), mode: "signin" };
  if (!email) return notYet(kind);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent(safeNext(parsed.data.next))}`),
    },
  });
  // Account exists but was never confirmed: Supabase refuses a sign-in code, so send the confirmation code instead (same screen).
  if (error && /signups? not allowed|not found/i.test(error.message)) await supabase.auth.resend({ type: "signup", email });
  // Rate limited means a code went out moments ago: still show the code step, with a note.
  const limited = !!error && (error.status === 429 || /rate limit|seconds|too many/i.test(error.message));
  // Same answer whether or not the account exists.
  // For a Plenary ID the form carries the ID, never the email (verify and resend look it up again).
  return { step: "sent", sentTo: lookedUp ? maskEmail(email) : email, sentKind: kind, email: lookedUp ? parsed.data.identifier.trim().toUpperCase() : email, mode: "signin", notice: limited ? "A code was sent very recently — use the one already in your inbox (check spam too). You can ask for a new one in a minute." : undefined };
}

const verifySchema = z.object({
  email: z.string().trim().min(3).max(254),
  code: z.string().trim().regex(/^\d{6,10}$/, "Enter the code from the email"),
  next: z.string().optional(),
});

export async function verifyCode(prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = verifySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ...prev, step: "sent", fieldErrors: parsed.error.flatten().fieldErrors };

  const { email } = await accountEmailFor(parsed.data.email);
  const wrong: SignInState = { ...prev, step: "sent", fieldErrors: { code: ["That code is wrong or has expired. Check the latest email or ask for a new one."] } };
  if (!email) return wrong;
  const supabase = await createClient();
  let { error } = await supabase.auth.verifyOtp({ email, token: parsed.data.code, type: "email" });
  // an unconfirmed account got a confirmation code instead of a sign-in code
  if (error && error.status !== 429 && error.code !== "user_banned") ({ error } = await supabase.auth.verifyOtp({ email, token: parsed.data.code, type: "signup" }));
  if (error) {
    if (error.code === "user_banned") return { ...prev, step: "sent", message: LOCKED };
    return wrong;
  }
  const locked = await refuseIfLocked(supabase);
  if (locked) return { ...prev, step: "sent", message: locked };
  await recordSignIn(supabase, "email_code");
  redirect(continueTo(parsed.data.next));
}
