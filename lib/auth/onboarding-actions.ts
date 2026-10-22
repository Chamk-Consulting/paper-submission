"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl, safeNext } from "@/lib/config/site";
import { scorePassword } from "@/lib/auth/password-rules";
import { isPwnedPassword } from "@/lib/auth/pwned";
import { turnstileOk } from "@/lib/site/turnstile";
import { refuseIfLocked } from "@/lib/auth/lock-check";
import { recordSignIn } from "@/lib/auth/sign-in-log";
import { resolveOnboarding, stepHref } from "@/lib/auth/onboarding";
import { noteStep, overLimit } from "@/lib/auth/attempts";
import { expiresIn, sign, signingReady } from "@/lib/auth/signing";

export type ExistingKind = "complete" | "no_profile" | "secondary";
export type StartState = {
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** The email already has a Plenary account: offer sign-in (and how to continue) instead of a second account. */
  exists?: { email: string; kind?: ExistingKind };
};

type EmailStatus = "none" | "unconfirmed" | "no_password" | "no_profile" | "complete" | "locked" | "secondary";

/**
 * What this email is today (database check, signed by this server so it can't be called in bulk from outside).
 * Runs only after the robot check and the per-connection limit. null = check not available (treated as new).
 */
async function emailStatus(supabase: Awaited<ReturnType<typeof createClient>>, email: string): Promise<EmailStatus | null> {
  if (!signingReady()) return null;
  const exp = expiresIn(5);
  const { data, error } = await supabase.rpc("signup_email_status", { p_email: email, p_expires: exp, p_sig: sign(`signup-status|${email}`, exp) });
  if (error) return null;
  return (data as EmailStatus) ?? null;
}

const LOCKED_MSG = "This account is locked, or it was merged into another one. If you merged it, sign in with the email of the account you kept. Otherwise write to Plenary support from the contact page.";

/** Rollback switch (plan E4): SIGNUP_PASSWORD_FIRST=1 brings back the old step 1 with the password. One setting, no code change. */
const passwordFirst = () => process.env.SIGNUP_PASSWORD_FIRST === "1";

const startSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first and last name as they appear on your papers.").max(120),
  lastName: z.string().trim().min(1, "Enter your first and last name as they appear on your papers.").max(120),
  email: z.string().trim().toLowerCase().min(1, "Enter your email address.").max(254).email("That doesn’t look like a full email, e.g. name@university.edu"),
  password: z.string().max(128, "Use 128 characters or fewer.").optional(),
  confirm: z.string().optional(),
  consent: z.literal("on", { message: "Please agree to continue." }),
  next: z.string().optional(),
  venue: z.string().optional(),
});

const SIGNUPS_PER_HOUR = 8;

function verifyUrl(email: string, next?: string, venue?: string, name?: string) {
  const q = new URLSearchParams({ email });
  if (name) q.set("name", name.slice(0, 120));
  if (next) q.set("next", safeNext(next));
  if (venue) q.set("venue", venue);
  return `/create-account/verify?${q.toString()}`;
}

/** Where the emailed link lands: /auth/continue opens the first unfinished step, then `next`. */
function continueHref(next?: string) {
  return `/auth/continue?next=${encodeURIComponent(safeNext(next, "/welcome"))}`;
}

const emailLimited = (e: { status?: number; code?: string; message: string }) =>
  e.status === 429 || e.code === "over_email_send_rate_limit" || /rate limit|too many/i.test(e.message);

/**
 * Step 1 (plan B1): name, email and terms. Sends a code + link to the address — the same screen whether or not the
 * email already has an account, so this form can't be used to check who is registered. The password is chosen
 * only after the code (step 3), so only the owner of the inbox can ever set it.
 */
export async function startSignup(_: StartState, formData: FormData): Promise<StartState> {
  const parsed = startSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { firstName, lastName, email, password = "", confirm = "", next, venue } = parsed.data;
  const legacy = passwordFirst();

  if (legacy) {
    const rules = scorePassword(password, email);
    if (!rules.ok) return { fieldErrors: { password: ["Choose a password that meets all three rules."] } };
    if (password !== confirm) return { fieldErrors: { confirm: ["The two passwords don't match yet."] } };
  }

  const h = await headers();
  if (!(await turnstileOk(formData, (h.get("x-forwarded-for") ?? "").split(",")[0].trim()))) {
    return { message: "Please confirm you're not a robot, then try again." };
  }
  const supabase = await createClient();
  if (await overLimit(supabase, "signup", SIGNUPS_PER_HOUR)) {
    return { message: "Too many sign-up attempts from this connection. Please wait an hour and try again." };
  }
  await noteStep(supabase, "started");
  const meta = { given_name: firstName, family_name: lastName, consent_at: new Date().toISOString() };

  if (legacy) {
    if (await isPwnedPassword(password)) return { fieldErrors: { password: ["That password has appeared in a data breach. Choose another."] } };
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { ...meta, password_set_at: new Date().toISOString() }, emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent(continueHref(next))}`) },
    });
    if (error) {
      const code = error.code ?? "";
      if (code === "user_already_exists" || code === "email_exists" || /already registered|already exists/i.test(error.message)) return { exists: { email } };
      if (code === "weak_password" || /weak|pwned|leaked/i.test(error.message)) return { fieldErrors: { password: ["That password isn't accepted. Choose a longer one you don't use anywhere else."] } };
      if (emailLimited(error)) { await noteStep(supabase, "email_failed"); return { message: "We can’t send confirmation emails right now — too many were sent in the last hour. Please try again a little later." }; }
      console.error("[signup] failed:", error.status, code, error.message);
      await noteStep(supabase, "email_failed");
      return { message: "We couldn’t create your account. Check your email address and try again." };
    }
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return { exists: { email } };
    await noteStep(supabase, "code_sent");
    redirect(verifyUrl(email, next, venue, `${firstName} ${lastName}`));
  }

  // Existing email: say so and continue from where that account stopped (review 22 Oct, problem 4).
  const status = await emailStatus(supabase, email);
  if (status === "locked") return { message: LOCKED_MSG };
  if (status === "complete" || status === "no_profile" || status === "secondary") return { exists: { email, kind: status } };
  if (status === "unconfirmed" || status === "no_password") {
    // Started before: a fresh code, then the missing steps (password, profile) open by themselves.
    const { error: e1 } = status === "unconfirmed"
      ? await supabase.auth.resend({ type: "signup", email })
      : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (e1 && emailLimited(e1) && !/seconds/i.test(e1.message)) return { message: "We can’t send confirmation emails right now — too many were sent in the last hour. Please try again a little later." };
    await noteStep(supabase, "code_sent");
    redirect(`${verifyUrl(email, next, venue, `${firstName} ${lastName}`)}&reason=${status === "unconfirmed" ? "started" : "continue"}${e1 ? "&wait=1" : ""}`);
  }

  // New address: Supabase creates the account (with no usable password) and emails a code.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { ...meta, onb: "password", signup_flow: "code_first" },
      emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent(continueHref(next))}`),
    },
  });
  if (error) {
    // A code went out moments ago: same screen, with a note.
    if (error.status === 429 && /seconds/i.test(error.message)) {
      await noteStep(supabase, "code_sent");
      redirect(`${verifyUrl(email, next, venue, `${firstName} ${lastName}`)}&wait=1`);
    }
    if (emailLimited(error)) { await noteStep(supabase, "email_failed"); return { message: "We can’t send confirmation emails right now — too many were sent in the last hour. Please try again a little later." }; }
    if (/signups? not allowed|disabled/i.test(error.message)) return { message: "New accounts are paused for a moment. Please try again later." };
    console.error("[signup] code failed:", error.status, error.code, error.message);
    await noteStep(supabase, "email_failed");
    return { message: "We couldn’t send the code. Check your email address and try again." };
  }
  await noteStep(supabase, "code_sent");
  redirect(verifyUrl(email, next, venue, `${firstName} ${lastName}`));
}

/** "Already have an account" panel → "Email me a sign-in code": a code, then the usual next-step rule. */
export async function sendCodeToExisting(email: string, next?: string): Promise<{ message?: string }> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(email);
  if (!parsed.success) return { message: "That email doesn’t look right." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email: parsed.data, options: { shouldCreateUser: false } });
  if (error && emailLimited(error) && !/seconds/i.test(error.message)) return { message: "Email sending is paused for a little while (too many emails this hour). Please try again later." };
  const q = new URLSearchParams({ email: parsed.data, reason: "signin" });
  if (next) q.set("next", safeNext(next));
  if (error) q.set("wait", "1");
  redirect(`/create-account/verify?${q.toString()}`);
}

export type ResendResult = { ok: boolean; message?: string };

/** "Resend code": a new code invalidates the old one. Works for new accounts and for already-confirmed ones. */
export async function resendSignupCode(email: string): Promise<ResendResult> {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return { ok: false, message: "That email doesn’t look right." };
  const supabase = await createClient();
  const paused = { ok: false, message: "Email sending is paused for a little while (too many emails this hour). Please try again later." };
  const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data });
  if (!error) return { ok: true };
  if (emailLimited(error)) return paused;
  // Already confirmed (e.g. confirmed by the link on another device): a sign-in code works the same way.
  const { error: e2 } = await supabase.auth.signInWithOtp({ email: parsed.data, options: { shouldCreateUser: false } });
  if (e2 && emailLimited(e2)) return paused;
  return { ok: true };
}

export type VerifyResult = { ok: true; href?: string; returning?: boolean } | { ok: false; reason: "wrong" | "locked" | "invalid" };

/** Step 2: check the emailed code. On success the person is signed in and sent to their first unfinished step. */
export async function verifySignupCode(email: string, code: string, next?: string): Promise<VerifyResult> {
  if (!z.string().email().safeParse(email).success || !/^\d{6,10}$/.test(code)) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  let { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error && error.status !== 429) ({ error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" }));
  if (error) {
    await noteStep(supabase, "code_failed");
    if (error.status === 429) return { ok: false, reason: "locked" };
    if (error.code === "user_banned") return { ok: false, reason: "locked" };
    return { ok: false, reason: "wrong" };
  }
  if (await refuseIfLocked(supabase)) return { ok: true, href: "/auth-error?reason=locked" };
  await recordSignIn(supabase, "email_code");
  const r = await resolveOnboarding(supabase);
  await noteStep(supabase, r.returning ? "returning" : "confirmed");
  return { ok: true, href: stepHref(r.step, safeNext(next, r.returning ? "/workspace" : "/welcome"), { ref: r.ref, email }), returning: r.returning };
}

/** C2: was this new account confirmed on another device? Only answers for accounts created in the last day. */
export async function signupStatus(email: string): Promise<{ confirmed: boolean }> {
  if (!z.string().email().safeParse(email).success) return { confirmed: false };
  const supabase = await createClient();
  if (await overLimit(supabase, "signup_status", 400)) return { confirmed: false };
  const { data, error } = await supabase.rpc("signup_confirmed", { p_email: email });
  return { confirmed: !error && data === true };
}

export type PasswordState = { message?: string; fieldErrors?: Record<string, string[] | undefined> };

/** Step 3 (plan B2): choose the password, after the code. Saved on the confirmed session, so only the inbox owner can set it. */
export async function saveChosenPassword(_: PasswordState, formData: FormData): Promise<PasswordState> {
  const p = z.object({ password: z.string().max(128, "Use 128 characters or fewer."), confirm: z.string(), next: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { fieldErrors: p.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return { message: "Your session ended. Sign in again with a code to choose your password." };
  const { password, confirm } = p.data;
  if (!scorePassword(password, auth.user.email).ok) return { fieldErrors: { password: ["Choose a password that meets all three rules."] } };
  if (password !== confirm) return { fieldErrors: { confirm: ["The two passwords don't match yet."] } };
  if (await isPwnedPassword(password)) return { fieldErrors: { password: ["That password has appeared in a data breach. Choose another."] } };

  const { error } = await supabase.auth.updateUser({ password, data: { password_set_at: new Date().toISOString(), onb: "profile" } });
  if (error) {
    if (error.code === "weak_password" || /weak|pwned|leaked|characters/i.test(error.message)) return { fieldErrors: { password: ["That password isn't accepted. Choose a longer one you don't use anywhere else."] } };
    if (error.code === "same_password") {
      await supabase.auth.updateUser({ data: { password_set_at: new Date().toISOString(), onb: "profile" } });
    } else if (error.code === "insufficient_aal") {
      redirect(`/sign-in/two-step?next=${encodeURIComponent(`/create-account/password?next=${encodeURIComponent(safeNext(p.data.next))}`)}`);
    } else if (error.code === "reauthentication_needed") {
      return { message: "For your safety, sign in again with a code, then choose your password." };
    } else {
      console.error("[signup] password failed:", error.status, error.code, error.message);
      return { message: "We couldn’t save your password. Please try again." };
    }
  }
  await supabase.auth.refreshSession();
  await noteStep(supabase, "password");
  const r = await resolveOnboarding(supabase);
  redirect(stepHref(r.step, safeNext(p.data.next, "/welcome"), { ref: r.ref, email: auth.user.email }));
}

export type Org = { id: string | null; name: string; place: string };

/** PR08 affiliation search, backed by the public ROR registry (ror.org). */
export async function searchOrganizations(query: string): Promise<Org[]> {
  const q = query.trim();
  if (q.length < 2 || q.length > 120) return [];
  try {
    const res = await fetch(`https://api.ror.org/v2/organizations?query=${encodeURIComponent(q)}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      items?: { id: string; names?: { value: string; types?: string[] }[]; locations?: { geonames_details?: { name?: string; country_name?: string } }[] }[];
    };
    return (json.items ?? []).slice(0, 6).map((o) => {
      const name = o.names?.find((n) => n.types?.includes("ror_display"))?.value ?? o.names?.[0]?.value ?? "Unknown";
      const loc = o.locations?.[0]?.geonames_details;
      return { id: o.id, name, place: [loc?.name, loc?.country_name].filter(Boolean).join(", ") + ` · ${o.id.replace("https://", "")}` };
    });
  } catch {
    return [];
  }
}

/** Organisation suggested from the email's domain (ROR "domains" field). */
export async function suggestFromEmailDomain(email: string): Promise<Org | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || /^(gmail|yahoo|outlook|hotmail|icloud|proton|protonmail|live|aol|gmx|qq|163)\./.test(domain)) return null;
  const parts = domain.split(".");
  const candidates = [domain, parts.slice(-3).join("."), parts.slice(-2).join(".")].filter((d, i, a) => d.includes(".") && a.indexOf(d) === i);
  for (const d of candidates) {
    try {
      const res = await fetch(`https://api.ror.org/v2/organizations?query.advanced=${encodeURIComponent(`domains:${d}`)}`, {
        headers: { accept: "application/json" },
        next: { revalidate: 86400 },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { items?: { id: string; names?: { value: string; types?: string[] }[]; locations?: { geonames_details?: { name?: string; country_name?: string; country_code?: string } }[] }[] };
      const o = json.items?.[0];
      if (o) {
        const name = o.names?.find((n) => n.types?.includes("ror_display"))?.value ?? o.names?.[0]?.value ?? d;
        const loc = o.locations?.[0]?.geonames_details;
        return { id: o.id, name, place: [loc?.name, loc?.country_name].filter(Boolean).join(", ") + ` · ${o.id.replace("https://", "")}` };
      }
    } catch {
      /* ignore and try the next candidate */
    }
  }
  return null;
}

export type ProfileState = { message?: string; fieldErrors?: Record<string, string[] | undefined> };

const SCRIPT_KEYS = ["zh", "ar", "ru", "ja", "ko", "el"] as const;
const profileSchema = z.object({
  paperName: z.string().trim().min(1, "Enter your name as it appears on your papers.").max(200),
  scripts: z.string().optional(),
  institution: z.string().trim().min(2, "Choose your affiliation, or “Independent researcher”.").max(200),
  rorId: z.string().trim().max(100).optional(),
  department: z.string().trim().max(200).optional(),
  country: z.string().regex(/^[A-Z]{2}$/).optional().or(z.literal("")),
  next: z.string().optional(),
});

/** PR08 "Finish and get my Plenary ID". */
export async function saveProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  let scripts: { script: string; name: string }[] = [];
  try {
    const raw = JSON.parse(d.scripts || "[]") as { script: string; name: string }[];
    scripts = raw
      .filter((r) => (SCRIPT_KEYS as readonly string[]).includes(r.script) && typeof r.name === "string" && r.name.trim())
      .slice(0, 6)
      .map((r) => ({ script: r.script, name: r.name.trim().slice(0, 120) }));
  } catch {
    scripts = [];
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_profile", {
    p_paper_name: d.paperName,
    p_name_scripts: scripts,
    p_institution: d.institution,
    p_ror_id: d.rorId || null,
    p_department: d.department || null,
    p_country: d.country || null,
    p_other_email: null, // extra emails go through Settings › Emails (confirmed by code)
  });
  if (error) {
    if (error.code === "42501") return { message: "Your session ended. Sign in again to finish your profile." };
    if (error.code === "PGRST202") return { message: "Saving profiles isn’t switched on yet (database update pending)." };
    return { message: "We couldn’t save your profile. Please try again." };
  }
  // the open step in the session token is cleared, so the proxy stops sending this person to the profile step
  const { error: metaErr } = await supabase.auth.updateUser({ data: { onb: null } });
  if (!metaErr) await supabase.auth.refreshSession();
  await noteStep(supabase, "profile");
  const q = d.next ? `?next=${encodeURIComponent(safeNext(d.next))}` : "";
  redirect(`/welcome${q}`);
}
