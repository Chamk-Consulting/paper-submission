"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/config/site";
import {
  forgotSchema,
  resetSchema,
  type FormState,
} from "@/lib/validation/auth";

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
