"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { venueIdBySlug, refresh, friendlyDb, type ManageState } from "@/lib/manage/actions-util";

const FOCUS = ["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"] as const;

const coverSchema = z.object({
  path: z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/).nullable(),
  url: z.string().url().startsWith("https://").max(600).nullable(),
  alt: z.string().trim().max(300),
  credit: z.string().trim().max(200),
  creditUrl: z.string().url().startsWith("https://").max(600).nullable().or(z.literal("").transform(() => null)),
  focus: z.enum(FOCUS),
  rights: z.boolean(),
});

/** EM03b: save or remove the venue's cover image (stored in venues.details.cover). Chairs only (RLS). */
export async function saveCover(_: ManageState, fd: FormData): Promise<ManageState> {
  const slug = String(fd.get("slug") ?? "");
  const id = await venueIdBySlug(slug);
  if (!id) return { error: "Event not found." };
  const remove = fd.get("intent") === "remove";
  let cover: z.infer<typeof coverSchema> | null = null;
  if (!remove) {
    let raw: unknown;
    try { raw = JSON.parse(String(fd.get("cover") ?? "{}")); } catch { return { error: "Bad request." }; }
    const parsed = coverSchema.safeParse(raw);
    if (!parsed.success) return { error: "Bad request." };
    cover = parsed.data;
    if (!cover.path && !cover.url) return { error: "Upload an image first." };
    if (cover.path && !cover.path.startsWith(`${id}/`)) return { error: "Bad request." };
    if (cover.alt.length < 5) return { fieldErrors: { alt: "Describe the image for people who can't see it." } };
    if (!cover.rights) return { fieldErrors: { rights: "Confirm you have the right to publish this image." } };
  }
  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase.from("venues").select("details").eq("id", id).single();
  if (readErr) return { error: friendlyDb(readErr.message) };
  const details = { ...((row?.details as Record<string, unknown>) ?? {}) };
  if (cover) details.cover = { path: cover.path, url: cover.url, alt: cover.alt, credit: cover.credit || null, creditUrl: cover.creditUrl, focus: cover.focus };
  else delete details.cover;
  const { error } = await supabase.from("venues").update({ details }).eq("id", id).select("id").single();
  if (error) return { error: friendlyDb(error.message) };
  refresh(slug, "/setup/basics");
  updateTag("venues");
  updateTag(`venue:${slug}`);
  return { ok: true, savedAt: new Date().toISOString() };
}
