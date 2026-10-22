import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { safeNext } from "@/lib/config/site";
import { stepFor, type OnboardingFacts, type OnboardingStep } from "@/lib/auth/onboarding-rule";

export { stepFor as nextOnboardingStep, type OnboardingStep } from "@/lib/auth/onboarding-rule";

/** Where each step lives. `next` is the page the person was heading to; it is carried through every step. */
export function stepHref(step: OnboardingStep, next: string, extra?: { ref?: string; email?: string }): string {
  const n = safeNext(next);
  const q = `next=${encodeURIComponent(n)}`;
  switch (step) {
    case "confirm": return `/create-account/verify?email=${encodeURIComponent(extra?.email ?? "")}&${q}`;
    case "two-step": return `/sign-in/two-step?${q}`;
    case "password": return `/create-account/password?${q}`;
    case "profile": return `/create-account/profile?${q}`;
    case "record": return `/auth-error?reason=record${extra?.ref ? `&ref=${encodeURIComponent(extra.ref)}` : ""}`;
    case "done": return n;
  }
}

export type Resolved = { step: OnboardingStep; user: User | null; returning: boolean; ref?: string };

/**
 * Checks the signed-in account (one Auth call + the profile read) and returns the first unfinished step.
 * Also keeps `user_metadata.onb` in the session token up to date, so the edge proxy can send people to their
 * open step without a network call. Best effort: a failure here never blocks the sign-in.
 */
export async function resolveOnboarding(supabase: SupabaseClient, opts: { sync?: boolean } = {}): Promise<Resolved> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { step: "done", user: null, returning: false };

  const [{ data: aal }, mine] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().catch(() => ({ data: null })),
    supabase.rpc("my_person"),
  ]);
  let person = (mine.error ? undefined : (mine.data as OnboardingFacts["person"])) ?? null;
  // C1: confirmed but no account record (trigger missed it) — create it now.
  if (!person && user.email_confirmed_at && !mine.error && opts.sync !== false) {
    const made = await supabase.rpc("ensure_my_person");
    if (!made.error && made.data) {
      const again = await supabase.rpc("my_person");
      person = (again.data as OnboardingFacts["person"]) ?? null;
    }
  }
  const facts: OnboardingFacts = {
    confirmedAt: user.email_confirmed_at ?? null,
    needsTwoStep: !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2",
    meta: (user.user_metadata ?? {}) as Record<string, unknown>,
    // a database that can't answer (older schema) never blocks anyone
    person: mine.error ? { profile_completed_at: "unknown" } : person,
  };
  // Pre-hijacking guard: the first time we see a freshly confirmed email, any password set before the confirmation
  // (by whoever signed up with this address, e.g. straight through the Supabase API) is replaced by a random one.
  // The inbox owner then chooses their own at the password step. One-shot: keyed to the exact confirmation time,
  // which nobody can know in advance.
  if (opts.sync !== false && !facts.needsTwoStep && process.env.SIGNUP_PASSWORD_FIRST !== "1" && user.email_confirmed_at) {
    const fresh = Date.now() - Date.parse(user.email_confirmed_at) < 30 * 60_000;
    if (fresh && facts.meta.secured_for !== user.email_confirmed_at) {
      const { error } = await supabase.auth.updateUser({
        password: `${randomBytes(24).toString("base64url")}!Aa1`,
        data: { secured_for: user.email_confirmed_at, password_set_at: null, onb: "password" },
      });
      if (!error) {
        facts.meta = { ...facts.meta, secured_for: user.email_confirmed_at, password_set_at: null, onb: "password" };
        await supabase.auth.refreshSession().catch(() => undefined);
      } else console.error("[onboarding] secure fresh account failed:", error.code, error.message);
    }
  }
  const step = stepFor(facts);
  if (opts.sync !== false) await syncStepClaim(supabase, facts.meta, step);
  const confirmedMs = user.email_confirmed_at ? Date.parse(user.email_confirmed_at) : NaN;
  return {
    step,
    user,
    returning: Number.isFinite(confirmedMs) && Date.now() - confirmedMs > 10 * 60_000,
    ref: step === "record" ? user.id.slice(0, 8).toUpperCase() : undefined,
  };
}

/** Writes the open step into the session token (user_metadata.onb), then refreshes the token so the proxy sees it. */
export async function syncStepClaim(supabase: SupabaseClient, meta: Record<string, unknown>, step: OnboardingStep, extra?: Record<string, unknown>) {
  const want = step === "password" || step === "profile" ? step : null;
  if ((meta.onb ?? null) === want && !extra) return;
  try {
    const { error } = await supabase.auth.updateUser({ data: { onb: want, ...(extra ?? {}) } });
    if (!error) await supabase.auth.refreshSession();
  } catch {
    /* the server-side checks still apply */
  }
}
