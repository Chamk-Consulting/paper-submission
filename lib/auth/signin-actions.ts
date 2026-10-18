"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl, safeNext } from "@/lib/config/site";
import { detectIdentifier } from "@/lib/auth/identifier";

export type SignInState = {
  step?: "email" | "sent";
  /** where the code went (masked when the person didn't type an email) */
  sentTo?: string;
  sentKind?: string;
  email?: string;
  mode?: "signin" | "create";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

const GENERIC = "Those details didn't match an account, or the email isn't confirmed yet.";

/**
 * Turns whatever was typed into the account email.
 * TODO(auth): Plenary ID, alias and phone lookup (needs persons.plenary_id / alias / phone columns and a
 * server-side lookup that answers identically whether or not the account exists).
 */
async function resolveEmail(identifier: string): Promise<{ email: string | null; kind: string }> {
  const d = detectIdentifier(identifier);
  if (d.kind === "email") return { email: identifier.trim().toLowerCase(), kind: "email" };
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
  const { email, kind } = await resolveEmail(parsed.data.identifier);
  if (!email) return notYet(kind);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error) return { message: GENERIC };
  // TODO(auth): "Keep me signed in" unchecked -> session-only cookies (no persistent maxAge).
  redirect(safeNext(parsed.data.next));
}

const codeRequestSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email, phone, Plenary ID or alias").max(254),
  next: z.string().optional(),
});

/** "Email me a link": sends a sign-in link + 6-digit code. Never creates an account. */
export async function sendSignInCode(_: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = codeRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { email, kind } = await resolveEmail(parsed.data.identifier);
  if (!email) return notYet(kind);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent(safeNext(parsed.data.next))}`),
    },
  });
  if (error && /rate limit|seconds/i.test(error.message)) return { message: "Please wait a moment before asking for another code." };
  // Same answer whether or not the account exists.
  return { step: "sent", sentTo: email, sentKind: kind, email, mode: "signin" };
}

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email"),
  next: z.string().optional(),
});

export async function verifyCode(prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = verifySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ...prev, step: "sent", fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.code, type: "email" });
  if (error) return { ...prev, step: "sent", fieldErrors: { code: ["That code is wrong or has expired. Check the latest email or ask for a new one."] } };

  redirect(safeNext(parsed.data.next));
}
