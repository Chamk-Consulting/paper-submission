"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl, safeNext } from "@/lib/config/site";
import {
  forgotSchema,
  resetSchema,
  signInSchema,
  signUpSchema,
  type FormState,
} from "@/lib/validation/auth";

// One generic message for sign-in failures: never reveal whether an account exists.
const GENERIC_SIGNIN_ERROR = "Email or password is incorrect, or the email isn't confirmed yet.";

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { message: GENERIC_SIGNIN_ERROR };

  redirect(safeNext(parsed.data.next));
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const { givenName, familyName, email, password, next } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Names are read by the database trigger that creates the person on confirmation.
      data: { given_name: givenName, family_name: familyName, consent_at: new Date().toISOString() },
      emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent(safeNext(next))}`),
      // TODO(auth): pass captchaToken once Cloudflare Turnstile is configured.
    },
  });

  if (error) {
    // Weak/leaked password and rate limits are safe to show; anything else stays generic.
    if (/password/i.test(error.message)) return { fieldErrors: { password: [error.message] } };
    if (/rate limit/i.test(error.message)) return { message: "Too many attempts. Please wait a minute and try again." };
    return { message: "We couldn't create the account. Please try again." };
  }

  // Same screen whether or not the email already had an account (no account enumeration).
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function forgotPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: absoluteUrl("/auth/confirm?next=/reset-password"),
  });
  // Always the same answer.
  return { ok: true, message: "If an account exists for that email, we've sent a reset link. It expires in 1 hour." };
}

export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { message: "Your reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { fieldErrors: { password: [error.message] } };

  // Sign out every other device after a password change.
  await supabase.auth.signOut({ scope: "others" });
  // TODO(email): send "password changed" notice (EV03) through the Send Email hook / Resend.
  redirect("/workspace?notice=password-changed");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
