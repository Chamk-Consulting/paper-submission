import "server-only";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";

async function visitorKey(kind: string): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  if (!ip) return "";
  return createHash("sha256").update(`${kind}|${ip}|${process.env.PLENARY_SIGNING_SECRET ?? ""}`).digest("hex").slice(0, 32);
}

/** Counts attempts per visitor (keyed hash of the IP). Skipped on a database without the counter. */
export async function overLimit(supabase: Awaited<ReturnType<typeof createClient>>, kind: "signup" | "lost_email" | "signup_status", max: number, minutes = 60): Promise<boolean> {
  const key = await visitorKey(kind);
  if (!key) return false;
  const { data, error } = await supabase.rpc("note_auth_attempt", { p_kind: kind, p_key_hash: key, p_window_minutes: minutes });
  return !error && Number(data) > max;
}

type FunnelStep = "started" | "code_sent" | "confirmed" | "returning" | "password" | "profile" | "email_failed" | "code_failed";
/** Plan E1: counts only (no personal data). Never blocks. */
export async function noteStep(supabase: Awaited<ReturnType<typeof createClient>>, step: FunnelStep) {
  try { await supabase.rpc("note_signup_step", { p_step: step }); } catch { /* ignore */ }
}

