import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** True when this session signed in with one step but the account has an authenticator app (needs aal2). */
export async function needsTwoStep(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return !!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2";
  } catch {
    return false;
  }
}

/** Where to send someone who still needs their authenticator code. */
export function twoStepHref(next: string): string {
  return `/sign-in/two-step?next=${encodeURIComponent(next)}`;
}
