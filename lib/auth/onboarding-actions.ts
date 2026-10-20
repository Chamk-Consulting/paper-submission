"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl, safeNext } from "@/lib/config/site";

export type StartState = { message?: string; fieldErrors?: Record<string, string[] | undefined> };

const startSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first and last name as they appear on your papers.").max(120),
  lastName: z.string().trim().min(1, "Enter your first and last name as they appear on your papers.").max(120),
  email: z.string().trim().toLowerCase().max(254).email("That doesn’t look like a full email, e.g. name@university.edu"),
  affiliation: z.string().trim().max(200).optional(),
  consent: z.literal("on", { message: "Please agree to continue." }),
  next: z.string().optional(),
  venue: z.string().optional(),
});

function verifyUrl(email: string, next?: string, venue?: string, name?: string) {
  const q = new URLSearchParams({ email });
  if (name) q.set("name", name.slice(0, 120));
  if (next) q.set("next", safeNext(next));
  if (venue) q.set("venue", venue);
  return `/create-account/verify?${q.toString()}`;
}

/** PR06 step 1: create the account (no password) and email a 6-digit code + link. */
export async function startSignup(_: StartState, formData: FormData): Promise<StartState> {
  const parsed = startSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { firstName, lastName, email, affiliation, next, venue } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { given_name: firstName, family_name: lastName, affiliation: affiliation || null, consent_at: new Date().toISOString() },
      emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent("/create-account/profile")}`),
      // TODO(auth): captchaToken (Cloudflare Turnstile).
    },
  });
  // Rate limited: a code was sent moments ago, so still go to the code screen and say so.
  const limited = !!error && (error.status === 429 || /rate limit|seconds|too many/i.test(error.message));
  // Existing accounts get a sign-in code instead — same screen, no account enumeration.
  redirect(verifyUrl(email, next, venue, `${firstName} ${lastName}`) + (limited ? "&wait=1" : ""));
}

export type ResendResult = { ok: boolean; message?: string };

/** PR07 "Resend code": a new code invalidates the old one. */
export async function resendSignupCode(email: string): Promise<ResendResult> {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return { ok: false, message: "That email doesn’t look right." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true, emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent("/create-account/profile")}`) },
  });
  if (error && (error.status === 429 || /rate limit|seconds/i.test(error.message))) {
    return { ok: false, message: "Please wait a little longer before asking again." };
  }
  return { ok: true };
}

export type VerifyResult = { ok: true } | { ok: false; reason: "wrong" | "locked" | "invalid" };

/** PR07: check the 6-digit code. On success the person is signed in (cookies set). */
export async function verifySignupCode(email: string, code: string): Promise<VerifyResult> {
  if (!z.string().email().safeParse(email).success || !/^\d{6}$/.test(code)) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
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
