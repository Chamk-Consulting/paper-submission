import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SectionKey } from "@/lib/manage/data";

/* Helpers for organizer server actions. */
export type ManageState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; savedAt?: string; ready?: boolean; info?: string };

export const friendlyDb = (msg?: string) => {
  if (!msg) return "Something went wrong. Please try again.";
  if (/row-level security|permission denied|not allowed|42501/i.test(msg)) return "You don’t have permission to change this.";
  if (/locked since submissions opened/i.test(msg)) return "This setting is locked since submissions opened — ask an owner.";
  if (/duplicate key|23505/i.test(msg)) return "That already exists.";
  if (/sign in/i.test(msg) && /invitation|review/i.test(msg)) return "Sign in with the invited email to continue.";
  // Database messages are written for people; drop internal rule codes like "(F1, B1)" and start with a capital.
  return msg.replace(/^.*?ERROR:\s*/, "").replace(/\s*\((?:[A-Z]\d+(?:,\s*)?)+\)\s*$/, "").replace(/^\w/, (c) => c.toUpperCase()).slice(0, 200);
};

export async function venueIdBySlug(slug: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("venues").select("id").eq("slug", slug).maybeSingle();
  return (data?.id as string) ?? null;
}

/** Mark checklist sections after a save: "Save" → in progress (if not ready), "Save and mark ready" → ready, "undo" → in progress. */
export async function markSections(venueId: string, keys: SectionKey[], intent: string | null) {
  const supabase = await createClient();
  const status = intent === "ready" ? "ready" : "in_progress";
  for (const k of keys) {
    if (intent !== "ready" && intent !== "undo") {
      const { data } = await supabase.from("venue_setup_sections").select("status").eq("venue_id", venueId).eq("key", k).maybeSingle();
      if (data?.status === "ready") { await supabase.rpc("set_section_status", { p_venue: venueId, p_key: k, p_status: "ready" }); continue; }
    }
    await supabase.rpc("set_section_status", { p_venue: venueId, p_key: k, p_status: status });
  }
}

export function refresh(slug: string, sub = "") {
  revalidatePath(`/[lang]/manage/${slug}${sub}`, "page");
  revalidatePath(`/[lang]/manage/${slug}/setup`, "page");
}
