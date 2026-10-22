"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl, safeNext } from "@/lib/config/site";
import { scorePassword } from "@/lib/auth/password-rules";
import { isPwnedPassword } from "@/lib/auth/pwned";
import { turnstileOk } from "@/lib/site/turnstile";

export type StartState = {
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** The email already has a confirmed Plenary account: offer sign-in instead. */
  exists?: { email: string };
};

const startSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first and last name as they appear on your papers.").max(120),
  lastName: z.string().trim().min(1, "Enter your first and last name as they appear on your papers.").max(120),
  email: z.string().trim().toLowerCase().min(1, "Enter your email address.").max(254).email("That doesn’t look like a full email, e.g. name@university.edu"),
  password: z.string().max(128, "Use 128 characters or fewer."),
  confirm: z.string(),
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

function profileHref(next?: string) {
  return `/create-account/profile${next ? `?next=${encodeURIComponent(safeNext(next))}` : ""}`;
}

const emailLimited = (e: { status?: number; code?: string; message: string }) =>
  e.status === 429 || e.code === "over_email_send_rate_limit" || /rate limit|too many/i.test(e.message);

/** A few sign-ups per hour per visitor (keyed hash of the IP). Skipped on a database without the counter. */
async function tooManySignups(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  if (!ip) return false;
  const key = createHash("sha256").update(`signup|${ip}|${process.env.PLENARY_SIGNING_SECRET ?? ""}`).digest("hex").slice(0, 32);
  const { data, error } = await supabase.rpc("note_auth_attempt", { p_kind: "signup", p_key_hash: key, p_window_minutes: 60 });
  return !error && Number(data) > SIGNUPS_PER_HOUR;
}

/**
 * PR06 step 1: create the account with a password, then email a code + link to confirm the address.
 * An email that already has a confirmed account is told so (with Sign in / reset / code options) — protected by
 * the CAPTCHA and a per-visitor limit so the form can't be used to check emails in bulk.
 */
export async function startSignup(_: StartState, formData: FormData): Promise<StartState> {
  const parsed = startSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { firstName, lastName, email, password, confirm, next, venue } = parsed.data;

  const rules = scorePassword(password, email);
  if (!rules.ok) return { fieldErrors: { password: ["Choose a password that meets all three rules."] } };
  if (password !== confirm) return { fieldErrors: { confirm: ["The two passwords don't match yet."] } };

  const h = await headers();
  if (!(await turnstileOk(formData, (h.get("x-forwarded-for") ?? "").split(",")[0].trim()))) {
    return { message: "Please confirm you're not a robot, then try again." };
  }
  const supabase = await createClient();
  if (await tooManySignups(supabase)) {
    return { message: "Too many sign-up attempts from this connection. Please wait an hour and try again." };
  }
  if (await isPwnedPassword(password)) {
    return { fieldErrors: { password: ["That password has appeared in a data breach. Choose another."] } };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { given_name: firstName, family_name: lastName, consent_at: new Date().toISOString() },
      emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent(profileHref(next))}`),
    },
  });

  if (error) {
    const code = error.code ?? "";
    if (code === "user_already_exists" || code === "email_exists" || /already registered|already exists/i.test(error.message)) return { exists: { email } };
    if (code === "weak_password" || /weak|pwned|leaked/i.test(error.message)) {
      return { fieldErrors: { password: ["That password isn't accepted. Choose a longer one you don't use anywhere else."] } };
    }
    if (emailLimited(error)) {
      return { message: "We can’t send confirmation emails right now — too many were sent in the last hour. Please try again a little later." };
    }
    console.error("[signup] failed:", error.status, code, error.message);
    return { message: "We couldn’t create your account. Check your email address and try again." };
  }
  // Supabase answers an existing, confirmed email with a user that has no sign-in identities (and sends nothing).
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return { exists: { email } };

  redirect(verifyUrl(email, next, venue, `${firstName} ${lastName}`));
}

export type ResendResult = { ok: boolean; message?: string };

/** PR07 "Resend code": a new code invalidates the old one. */
export async function resendSignupCode(email: string): Promise<ResendResult> {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return { ok: false, message: "That email doesn’t look right." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data });
  if (!error) return { ok: true };
  if (emailLimited(error)) return { ok: false, message: "Email sending is paused for a little while (too many emails this hour). Please try again later." };
  // Already confirmed (e.g. confirmed by the link in another tab): a sign-in code works the same way.
  const { error: e2 } = await supabase.auth.signInWithOtp({ email: parsed.data, options: { shouldCreateUser: false } });
  if (e2 && emailLimited(e2)) return { ok: false, message: "Email sending is paused for a little while (too many emails this hour). Please try again later." };
  return { ok: true };
}

export type VerifyResult = { ok: true } | { ok: false; reason: "wrong" | "locked" | "invalid" };

/** PR07: check the emailed code. On success the person is signed in (cookies set). */
export async function verifySignupCode(email: string, code: string): Promise<VerifyResult> {
  if (!z.string().email().safeParse(email).success || !/^\d{6,10}$/.test(code)) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  let { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error && error.status !== 429) ({ error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" }));
  if (!error) return { ok: true };
  if (error.status === 429) return { ok: false, reason: "locked" };
  return { ok: false, reason: "wrong" };
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
  otherEmail: z.string().trim().max(254).email("That doesn’t look like a full email.").optional().or(z.literal("")),
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
    p_other_email: d.otherEmail || null,
  });
  if (error) {
    if (error.code === "42501") return { message: "Your session ended. Sign in again to finish your profile." };
    if (error.code === "PGRST202") return { message: "Saving profiles isn’t switched on yet (database update pending)." };
    return { message: "We couldn’t save your profile. Please try again." };
  }
  const q = d.next ? `?next=${encodeURIComponent(safeNext(d.next))}` : "";
  redirect(`/welcome${q}`);
}
