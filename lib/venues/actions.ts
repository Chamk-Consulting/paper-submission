"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type FollowState = { signedIn: boolean; followed: string[] };

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { supabase, signedIn: false, personId: null as string | null };
  const { data: p } = await supabase.from("persons").select("id").eq("user_id", data.user.id).maybeSingle();
  return { supabase, signedIn: true, personId: (p?.id as string) ?? null };
}

/** Who am I + which venues do I follow (RLS: only my rows). Called from the cached public pages after load. */
export async function getFollowState(): Promise<FollowState> {
  const { supabase, signedIn, personId } = await me();
  if (!personId) return { signedIn, followed: [] };
  const { data } = await supabase.from("venue_follows").select("venue_id").eq("person_id", personId);
  return { signedIn: true, followed: (data ?? []).map((r) => r.venue_id as string) };
}

export async function toggleFollow(venueId: string): Promise<{ ok: boolean; following?: boolean; reason?: "signin" | "error" }> {
  if (!z.string().uuid().safeParse(venueId).success) return { ok: false, reason: "error" };
  const { supabase, personId } = await me();
  if (!personId) return { ok: false, reason: "signin" };
  const { data: existing } = await supabase.from("venue_follows").select("venue_id").eq("person_id", personId).eq("venue_id", venueId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("venue_follows").delete().eq("person_id", personId).eq("venue_id", venueId);
    return error ? { ok: false, reason: "error" } : { ok: true, following: false };
  }
  const { error } = await supabase.from("venue_follows").insert({ person_id: personId, venue_id: venueId });
  return error ? { ok: false, reason: "error" } : { ok: true, following: true };
}
