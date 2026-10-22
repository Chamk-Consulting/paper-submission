/**
 * The one "next step" rule for registration (plan B4). Pure, so it can be tested and used anywhere.
 *
 * Order: confirm email → two-step code (only accounts that turned it on) → password → research profile → done.
 * Two-step comes before password and profile because, once an authenticator app is on, the database and
 * Supabase Auth refuse changes until the code is entered.
 */
export type OnboardingStep = "confirm" | "two-step" | "password" | "record" | "profile" | "done";

export type OnboardingFacts = {
  /** auth.users.email_confirmed_at */
  confirmedAt: string | null;
  /** Account has an authenticator app and this session has not passed it yet. */
  needsTwoStep: boolean;
  /** auth user_metadata */
  meta: Record<string, unknown>;
  /** The person record (null = missing). */
  person: { profile_completed_at?: string | null } | null;
};

/**
 * Accounts confirmed from this moment on must choose their password after the code (the inbox owner sets it).
 * Older accounts are left alone (plan E2). Override with PASSWORD_STEP_SINCE (ISO date) if needed.
 */
export const PASSWORD_STEP_SINCE = Date.parse(process.env.PASSWORD_STEP_SINCE || "2026-10-22T20:00:00Z");

export function needsPassword(f: Pick<OnboardingFacts, "confirmedAt" | "meta">): boolean {
  if (typeof f.meta.password_set_at === "string" && f.meta.password_set_at) return false;
  if (f.meta.onb === "password") return true;
  const at = f.confirmedAt ? Date.parse(f.confirmedAt) : NaN;
  return Number.isFinite(at) && at >= PASSWORD_STEP_SINCE;
}

export function stepFor(f: OnboardingFacts): OnboardingStep {
  if (!f.confirmedAt) return "confirm";
  if (f.needsTwoStep) return "two-step";
  if (needsPassword(f)) return "password";
  if (!f.person) return "record";
  if (!f.person.profile_completed_at) return "profile";
  return "done";
}
