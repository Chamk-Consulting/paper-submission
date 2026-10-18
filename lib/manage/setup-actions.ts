"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyDb, markSections, refresh, venueIdBySlug, type ManageState } from "@/lib/manage/actions-util";

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);

/* EM03 — basics & branding */
const basicsSchema = z.object({
  name: z.string().trim().min(3, "Enter the full name (at least 3 characters).").max(300),
  short_name: z.string().trim().max(40).optional(),
  tagline: z.string().trim().max(160).optional(),
  website: z.string().trim().max(300).optional().refine((v) => !v || /^https:\/\//.test(v), "Use a full address starting with https://"),
  accent: z.enum(["navy", "saffron", "teal", "forest", "crimson", "royal"]),
  public_text: z.string().max(20000).optional(),
  venue_address: z.string().trim().max(300).optional(),
  hotels: z.string().trim().max(500).optional(),
  contact_email: z.string().trim().max(254).optional().refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email address"),
});

export async function saveBasics(_: ManageState, fd: FormData): Promise<ManageState> {
  const slug = String(fd.get("slug") ?? "");
  if (!slugSchema.safeParse(slug).success) return { error: "Bad request." };
  const parsed = basicsSchema.safeParse(Object.fromEntries(["name", "short_name", "tagline", "website", "accent", "public_text", "venue_address", "hotels", "contact_email"].map((k) => [k, (fd.get(k) as string | null) ?? undefined])));
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const id = await venueIdBySlug(slug);
  if (!id) return { error: "Event not found." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("venues").update({
    name: v.name, short_name: v.short_name || null, tagline: v.tagline || null, website: v.website || null, accent: v.accent,
    public_text: v.public_text || null, venue_address: v.venue_address || null, hotels: v.hotels || null, contact_email: v.contact_email || null,
  }).eq("id", id).select("id").single();
  if (error) return { error: friendlyDb(error.message) };
  const intent = fd.get("intent") as string | null;
  await markSections(id, ["basics"], intent);
  refresh(slug, "/setup/basics");
  return { ok: true, savedAt: new Date().toISOString(), ready: intent === "ready" ? true : intent === "undo" ? false : undefined };
}
