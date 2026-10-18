import "server-only";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Adds a row to the person's sign-in activity (ST03). Best effort: a database
 * without the activity table, or any other error, never blocks signing in.
 */
export async function recordSignIn(supabase: SupabaseClient, method: "password" | "email_code" | "email_link" | "orcid") {
  try {
    const h = await headers();
    const city = h.get("x-vercel-ip-city");
    const country = h.get("x-vercel-ip-country");
    const place = [city ? decodeURIComponent(city) : null, country].filter(Boolean).join(", ") || null;
    await supabase.rpc("record_sign_in", { p_method: method, p_place: place, p_user_agent: (h.get("user-agent") ?? "").slice(0, 300) || null, p_result: "ok" });
  } catch {
    /* activity log is optional */
  }
}
