import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Call right after a successful sign-in. Locked (AD01) or merged (AH02) accounts are signed out again and get a message.
 * Returns null when the account may continue. A database without the admin migration never blocks anyone.
 */
export async function refuseIfLocked(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_lock");
  if (error || !data) return null;
  const l = data as { locked?: boolean; merged_into?: string | null };
  if (!l.locked) return null;
  await supabase.auth.signOut();
  return l.merged_into
    ? "This account was merged into another one. Sign in with the email of the account you kept."
    : "This account is locked. Write to Plenary support from the contact page if you think this is a mistake.";
}
