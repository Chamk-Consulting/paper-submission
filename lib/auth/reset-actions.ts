"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/config/site";
import { detectIdentifier } from "@/lib/auth/identifier";
import { accountEmailFor, plenaryIdSignIn } from "@/lib/auth/plenary-id";
import { sendSecurityNotice } from "@/lib/email/security-mail";
import { scorePassword } from "@/lib/auth/password-rules";
import { isPwnedPassword } from "@/lib/auth/pwned";
import { clearRecovery, hasRecovery, markRecovery } from "@/lib/auth/recovery-cookie";

/*
 * Canvas PR10 → PR10b → PR11.
 * Supabase sends ONE recovery email holding both a link and a 6-digit code.
 * TODO(auth): the "Reset password" email template must include {{ .Token }} (the code)
 * and the link {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
 * (see supabase/templates/recovery.html). OTP expiry = 900s to match the 15-minute copy.
 */

export type ForgotState = { fieldErrors?: { identifier?: string[] }; message?: string };

const askSchema = z.object({ identifier: z.string().trim().min(1, "Enter the email, phone, Plenary ID or alias you use for Plenary.").max(254) });

async function sendRecovery(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: absoluteUrl("/auth/confirm?next=/reset-password"),
  });
  if (error && (error.status === 429 || /rate limit|seconds/i.test(error.message))) return "rate";
  return "ok";
}

/** PR10 "Send reset code". Same answer whether or not the account exists. */
export async function startPasswordReset(_: ForgotState, formData: FormData): Promise<ForgotState> {
  const parsed = askSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const raw = parsed.data.identifier;
  const kind = detectIdentifier(raw).kind;
  if (kind === "none") return { fieldErrors: { identifier: ["Enter the email, phone, Plenary ID or alias you use for Plenary."] } };
  if (kind === "id" && plenaryIdSignIn()) {
    // Plenary ID: look up the email server-side; the code page carries the ID, never the email.
    const { email, id } = await accountEmailFor(raw);
    if (id) {
      if (email && (await sendRecovery(email)) === "rate") return { message: "Please wait a minute before asking for another code." };
      redirect(`/forgot-password/code?email=${encodeURIComponent(id)}`);
    }
  }
  if (kind !== "email") {
    // TODO(auth): alias and phone lookup.
    const what = { id: "Plenary ID", alias: "alias", phone: "phone number", pin: "PaperCept PIN" }[kind as string] ?? "that";
    return { fieldErrors: { identifier: [kind === "pin" ? "Plenary doesn’t use PaperCept PINs. Use your email." : `Resetting with a ${what} isn’t available yet — use your email for now.`] } };
  }
  const email = raw.toLowerCase();
  if ((await sendRecovery(email)) === "rate") return { message: "Please wait a minute before asking for another code." };
  redirect(`/forgot-password/code?email=${encodeURIComponent(email)}`);
}

/** PR10b "Resend code". */
export async function resendResetCode(identifier: string): Promise<{ ok: boolean; message?: string }> {
  const { email, id } = await accountEmailFor(identifier);
  if (id && !email) return { ok: true }; // unknown ID: same answer as a real one
  if (!email || !z.string().email().safeParse(email).success) return { ok: false, message: "That email doesn’t look right." };
  if ((await sendRecovery(email)) === "rate") return { ok: false, message: "Please wait a little longer before asking again." };
  return { ok: true };
}

/** PR10b: check the 6-digit recovery code. On success the person has a session for PR11. */
export async function verifyResetCode(identifier: string, code: string): Promise<{ ok: true } | { ok: false; reason: "wrong" | "locked" | "invalid" }> {
  if (!/^\d{6,10}$/.test(code)) return { ok: false, reason: "invalid" };
  const { email, id } = await accountEmailFor(identifier);
  if (id && !email) return { ok: false, reason: "wrong" };
  if (!email || !z.string().email().safeParse(email).success) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (error || !data.user) return { ok: false, reason: error?.status === 429 ? "locked" : "wrong" };
  await markRecovery(data.user.id);
  return { ok: true };
}

export type NewPasswordState = {
  done?: boolean;
  signedOutOthers?: boolean;
  fieldErrors?: { password?: string[]; confirm?: string[] };
  message?: string;
};

/** PR11 "Save new password". */
export async function saveNewPassword(_: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const signOutOthers = formData.get("signOutOthers") === "on";

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !(await hasRecovery(data.user.id))) {
    return { message: "This reset session has expired. Ask for a new code to continue." };
  }

  const r = scorePassword(password, data.user.email ?? "");
  if (!r.ok) return { fieldErrors: { password: ["Choose a password that meets all the rules."] } };
  if (password !== confirm) return { fieldErrors: { confirm: ["The two passwords don't match yet."] } };
  if (await isPwnedPassword(password)) return { fieldErrors: { password: ["That password has appeared in a data breach. Choose another."] } };

  const { error } = await supabase.auth.updateUser({ password, data: { password_set_at: new Date().toISOString(), secured_for: data.user.email_confirmed_at ?? null } });
  if (error) {
    const same = /different from the old|same_password/i.test(error.message + (error.code ?? ""));
    const weak = /weak|pwned|leaked/i.test(error.message + (error.code ?? ""));
    return { fieldErrors: { password: [same ? "Use a password you haven't used here before." : weak ? "That password has appeared in a data breach. Choose another." : "We couldn't save that password. Please try again."] } };
  }

  if (signOutOthers) await supabase.auth.signOut({ scope: "others" });
  await clearRecovery();
  await sendSecurityNotice("password_changed", data.user.email ?? "", "Reset with an emailed code or link");
  return { done: true, signedOutOthers: signOutOthers };
}
