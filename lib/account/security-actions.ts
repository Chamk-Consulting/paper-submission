"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl, site } from "@/lib/config/site";
import { expiresIn, newCode, sameHex, sign, signingReady } from "@/lib/auth/signing";
import { sendEmail } from "@/lib/email/send";
import { addEmailMail, sendSecurityNotice } from "@/lib/email/security-mail";

/* ST02 extensions: extra email addresses, sign-in email change, authenticator apps (two-step). */

export type SecState = { ok?: boolean; error?: string; info?: string; step?: "code"; email?: string; waitUntil?: number };

const COOKIE = "pl_addmail";
const CODE_MINUTES = 10;
const RESEND_AFTER = 60;
const MAX_TRIES = 5;
const GENERIC = "Something went wrong. Please try again.";
const emailSchema = z.string().trim().toLowerCase().email("That doesn’t look like a full email, e.g. name@university.edu").max(254);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const refresh = () => revalidatePath("/[lang]/settings/security", "page");

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await supabase.from("persons").select("id").eq("user_id", data.user.id).maybeSingle();
  if (!p) return null;
  return { supabase, user: data.user, personId: p.id as string, email: (data.user.email ?? "").toLowerCase() };
}

/* ---------------------------------------------------------------- pending code, kept in a signed cookie */
type Pending = { e: string; h: string; x: number; p: string; a: number; s: number };

async function readPending(): Promise<Pending | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw || !signingReady()) return null;
  const [body, mac] = raw.split(".");
  if (!body || !mac) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Pending;
    if (!sameHex(mac, sign(`addmail|${body}`, p.x))) return null;
    if (p.x < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}

async function writePending(p: Pending) {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  (await cookies()).set(COOKIE, `${body}.${sign(`addmail|${body}`, p.x)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: CODE_MINUTES * 60,
  });
}

const clearPending = async () => (await cookies()).delete(COOKIE);

/* ---------------------------------------------------------------- extra emails */
/** Step 1: email a 6-digit code to the address being added. */
export async function startAddEmail(_: SecState, fd: FormData): Promise<SecState> {
  if (!signingReady()) return { error: "Adding emails isn’t switched on yet on this site." };
  const parsed = emailSchema.safeParse(fd.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter an email address." };
  const email = parsed.data;
  const c = await me();
  if (!c) return { error: "Sign in again to continue." };
  if (email === c.email) return { error: "That’s already your sign-in email." };
  const { data: mine } = await c.supabase.from("person_emails").select("email").eq("person_id", c.personId);
  if ((mine ?? []).some((r) => String(r.email).toLowerCase() === email)) return { error: "That email is already on your account." };

  const now = Math.floor(Date.now() / 1000);
  const prev = await readPending();
  if (prev && prev.e === email && now - prev.s < RESEND_AFTER) return { step: "code", email, waitUntil: prev.s + RESEND_AFTER, info: "A code was sent moments ago — check that inbox (and spam)." };

  const code = newCode();
  const mail = addEmailMail(email, code, c.email);
  const sent = await sendEmail({ to: email, from: site.email.authFrom, ...mail });
  if (!sent.ok) return { error: sent.skipped ? "Email sending isn’t set up on this site." : "We couldn’t send a code to that address. Check it and try again." };
  await writePending({ e: email, h: sha(code), x: expiresIn(CODE_MINUTES), p: c.personId, a: 0, s: now });
  return { step: "code", email, waitUntil: now + RESEND_AFTER };
}

/** Step 2: check the code, then ask the database to add the address (it accepts only what this server signed). */
export async function verifyAddEmail(_: SecState, fd: FormData): Promise<SecState> {
  const code = String(fd.get("code") ?? "").replace(/\D/g, "");
  const p = await readPending();
  if (!p) return { error: "That code has expired — ask for a new one." };
  const c = await me();
  if (!c || c.personId !== p.p) return { error: "Sign in again to continue." };
  if (p.a >= MAX_TRIES) { await clearPending(); return { error: "Too many wrong codes. Ask for a new one." }; }
  if (code.length !== 6 || !sameHex(sha(code), p.h)) {
    await writePending({ ...p, a: p.a + 1 });
    const left = MAX_TRIES - p.a - 1;
    return { step: "code", email: p.e, error: left > 0 ? "That code doesn’t match. Use the code from the latest email." : "Too many wrong codes. Ask for a new one." };
  }
  const exp = expiresIn(5);
  const { error } = await c.supabase.rpc("add_verified_email", { p_email: p.e, p_expires: exp, p_sig: sign(`email|${c.personId}|${p.e}`, exp) });
  await clearPending();
  if (error) {
    if (/another Plenary account/i.test(error.message)) return { error: "That email belongs to another Plenary account. If both are yours, use Account help › Merge accounts." };
    if (/up to 8/i.test(error.message)) return { error: "You can keep up to 8 email addresses." };
    if (/function .*add_verified_email|PGRST202/i.test(error.message)) return { error: "Adding emails needs the latest database update." };
    return { error: GENERIC };
  }
  await sendSecurityNotice("email_added", c.email, p.e);
  refresh();
  return { ok: true, info: "Email added." };
}

export async function cancelAddEmail(): Promise<void> {
  await clearPending();
}

export async function removeEmail(email: string): Promise<SecState> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: GENERIC };
  const c = await me();
  if (!c) return { error: "Sign in again to continue." };
  const { error } = await c.supabase.rpc("remove_my_email", { p_email: parsed.data });
  if (error) return { error: /sign-in email/i.test(error.message) ? "Your sign-in email can’t be removed — change it instead." : GENERIC };
  refresh();
  return { ok: true };
}

/* ---------------------------------------------------------------- sign-in email */
/** Supabase sends a confirmation to the old and the new address (Send Email hook, email_change). */
export async function changeSignInEmail(_: SecState, fd: FormData): Promise<SecState> {
  const parsed = emailSchema.safeParse(fd.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter an email address." };
  const c = await me();
  if (!c) return { error: "Sign in again to continue." };
  if (parsed.data === c.email) return { error: "That’s already your sign-in email." };
  const { error } = await c.supabase.auth.updateUser({ email: parsed.data }, { emailRedirectTo: absoluteUrl("/auth/confirm?next=/settings/security") });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return { error: "That email belongs to another Plenary account. If both are yours, use Account help › Merge accounts." };
    if (error.status === 429 || /rate|seconds/i.test(error.message)) return { error: "Please wait a minute before asking again." };
    if (/aal2|assurance/i.test(error.message)) return { error: "Enter your authenticator code first — sign out and back in." };
    return { error: GENERIC };
  }
  refresh();
  return { ok: true, email: parsed.data, info: "Check both inboxes — confirm from the old and the new address. Your sign-in email changes once both are confirmed." };
}

/* ---------------------------------------------------------------- authenticator apps (TOTP, built into Supabase Auth) */
export type Enrolment = { ok: true; factorId: string; qr: string; secret: string } | { ok: false; error: string };

export async function enrollTotp(): Promise<Enrolment> {
  const c = await me();
  if (!c) return { ok: false, error: "Sign in again to continue." };
  const { data: list } = await c.supabase.auth.mfa.listFactors();
  const all = (list?.all ?? []) as { id: string; factor_type: string; status: string }[];
  // Unfinished set-ups block new ones: clear them first.
  for (const f of all.filter((x) => x.factor_type === "totp" && x.status !== "verified")) await c.supabase.auth.mfa.unenroll({ factorId: f.id });
  const verified = all.filter((x) => x.factor_type === "totp" && x.status === "verified").length;
  if (verified >= 2) return { ok: false, error: "You already have two authenticator apps. Remove one first." };
  const { data, error } = await c.supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Plenary", friendlyName: `${verified ? "Backup app" : "Authenticator app"} · ${new Date().toISOString().slice(0, 10)} ${Math.random().toString(36).slice(2, 6)}` });
  if (error || !data) {
    if (/aal2|assurance/i.test(error?.message ?? "")) return { ok: false, error: "Enter a code from your current authenticator app first — sign out and back in." };
    if (/disabled|not enabled/i.test(error?.message ?? "")) return { ok: false, error: "Two-step sign-in isn’t switched on for this site yet." };
    return { ok: false, error: GENERIC };
  }
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyEnroll(factorId: string, code: string): Promise<SecState> {
  if (!z.guid().safeParse(factorId).success) return { error: GENERIC };
  const digits = String(code).replace(/\D/g, "");
  if (digits.length !== 6) return { error: "Enter the 6-digit code from the app." };
  const c = await me();
  if (!c) return { error: "Sign in again to continue." };
  const { error } = await c.supabase.auth.mfa.challengeAndVerify({ factorId, code: digits });
  if (error) return { error: "That code doesn’t match. Check the time on your phone is set automatically, then try the newest code." };
  await sendSecurityNotice("two_step_on", c.email);
  refresh();
  return { ok: true, info: "Two-step sign-in is on." };
}

export async function cancelEnroll(factorId: string): Promise<void> {
  if (!z.guid().safeParse(factorId).success) return;
  const c = await me();
  if (!c) return;
  const { data } = await c.supabase.auth.mfa.listFactors();
  const f = ((data?.all ?? []) as { id: string; status: string }[]).find((x) => x.id === factorId);
  if (f && f.status !== "verified") await c.supabase.auth.mfa.unenroll({ factorId });
}

export async function removeFactor(factorId: string): Promise<SecState> {
  if (!z.guid().safeParse(factorId).success) return { error: GENERIC };
  const c = await me();
  if (!c) return { error: "Sign in again to continue." };
  const { data: aal } = await c.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return { error: "Enter a code from your authenticator app first — sign out and back in, then remove it." };
  const { error } = await c.supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: GENERIC };
  await sendSecurityNotice("two_step_off", c.email);
  refresh();
  return { ok: true };
}

/* ---------------------------------------------------------------- sign-in second step */
/** /sign-in/two-step: check the authenticator code for this session (aal1 → aal2). */
export async function verifyTwoStep(_: SecState, fd: FormData): Promise<SecState> {
  const digits = String(fd.get("code") ?? "").replace(/\D/g, "");
  if (digits.length !== 6) return { error: "Enter the 6-digit code from your authenticator app." };
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factors = ((data?.totp ?? []) as { id: string; status: string }[]).filter((f) => f.status === "verified");
  if (!factors.length) return { ok: true };
  // Try each verified app (main and backup) — whichever produced the code.
  for (const f of factors) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code: digits });
    if (!error) return { ok: true };
    if (error.status === 429) return { error: "Too many tries. Wait a minute and use the newest code." };
  }
  return { error: "That code doesn’t match. Use the newest code from your app." };
}
