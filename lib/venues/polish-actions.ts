"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { MyTask, MyVenueStatus, VenuePublicInfo } from "@/lib/venues/polish-types";

/* Signed-in extras for the cached public venue pages (PV01c "My tasks", PV02 contact form + status card)
   and the organizer editor for the venue page content (EM10). Messages are English keys, translated by the UI. */

const uuid = z.guid();

/** "My tasks" layer of the deadline calendar: the person's own deadlines (reuses the CL01 feed query). */
export async function getMyTasks(): Promise<{ signedIn: boolean; tasks: MyTask[] }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { signedIn: false, tasks: [] };
  const { data, error } = await supabase.rpc("my_calendar_items", { p_flags: { submissions: true, reviews: true, sessions: false, followed: false } });
  if (error || !Array.isArray(data)) return { signedIn: true, tasks: [] };
  return {
    signedIn: true,
    tasks: (data as { category: string; uid: string; title: string; starts_at: string; description: string | null; url: string | null }[])
      .map((r) => ({ id: r.uid, category: r.category === "reviews" ? "review" : "paper", title: r.title, startsAt: r.starts_at, detail: r.description, href: r.url })),
  };
}

/** "Your status here" card on the venue page. */
export async function getMyVenueStatus(venueId: string): Promise<MyVenueStatus | null> {
  if (!uuid.safeParse(venueId).success) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.rpc("my_venue_status", { p_venue: venueId });
  if (error || !data) return { roles: [], papers: [], reviews: [] };
  return data as MyVenueStatus;
}

export type ContactState = { error?: string; fieldErrors?: { body?: string }; threadId?: string };

const contactSchema = z.object({
  venueId: z.guid(),
  topic: z.enum(["general", "submissions", "publication", "registration"]),
  subject: z.string().trim().max(300),
  body: z.string().trim().min(2, "Write your message.").max(8000, "Keep the message under 8,000 characters."),
});

/** PV02 "Contact organizers": opens an inbox thread with the chair for that topic. */
export async function contactOrganizers(_: ContactState, fd: FormData): Promise<ContactState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return f.body ? { fieldErrors: { body: f.body[0] } } : { error: "Something went wrong. Please try again." };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sign in to message the organizers." };
  const { data, error } = await supabase.rpc("message_venue_organizers", {
    p_venue: parsed.data.venueId, p_subject: parsed.data.subject, p_body: parsed.data.body, p_topic: parsed.data.topic,
  });
  if (error) {
    if (/too many/i.test(error.message)) return { error: "You've sent several messages in the last hour. Please try again later." };
    if (/no chair/i.test(error.message)) return { error: "This venue has no chair to message yet." };
    return { error: "Something went wrong. Please try again." };
  }
  return { threadId: data as string };
}

export type VenueInfoState = { ok?: boolean; error?: string; savedAt?: string };

const text = (max: number) => z.string().trim().max(max).optional().transform((s) => (s ? s : undefined));
const infoSchema = z.object({
  attending: z.object({
    registration_note: text(600), registration_url: z.string().trim().url().max(300).optional().or(z.literal("")).transform((s) => s || undefined),
    visa: text(600), grants: text(600), hotels_note: text(600), keynotes: text(600), conduct: text(600), accessibility: text(600),
  }).partial().default({}),
  travel: z.object({
    address: text(300), summary: text(400), hotel_code: text(40), hotel_deadline: text(60),
    directions: z.array(z.object({ mode: z.enum(["train", "plane", "bus", "car", "walk", "other"]), title: z.string().trim().min(1).max(80), time: text(40), note: text(200) })).max(8).default([]),
    hotels: z.array(z.object({ name: z.string().trim().min(1).max(100), meta: text(120), price: text(40) })).max(8).default([]),
  }).partial().default({}),
  gallery: z.array(z.object({ path: z.string().max(160), caption: text(160), credit: text(80) })).max(24).default([]),
});

/** EM10 "Venue page" card: Attending, Venue & travel and Gallery content. */
export async function saveVenuePublicInfo(_: VenueInfoState, fd: FormData): Promise<VenueInfoState> {
  const venueId = String(fd.get("venueId") ?? "");
  const slug = String(fd.get("slug") ?? "");
  if (!uuid.safeParse(venueId).success) return { error: "Something went wrong. Please try again." };
  let raw: unknown;
  try { raw = JSON.parse(String(fd.get("info") ?? "{}")); } catch { return { error: "Something went wrong. Please try again." }; }
  const parsed = infoSchema.safeParse(raw);
  if (!parsed.success) return { error: "Check the highlighted fields: a link or a list item is not valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_venue_public_info", { p_venue: venueId, p_info: parsed.data as VenuePublicInfo });
  if (error) {
    if (/not allowed|42501/i.test(error.message + error.code)) return { error: "Only organizers of this event can change the venue page." };
    if (/gallery/i.test(error.message)) return { error: "A gallery photo could not be saved. Upload it again." };
    return { error: "Something went wrong. Please try again." };
  }
  if (/^[a-z0-9-]{3,64}$/.test(slug)) updateTag(`venue:${slug}`);
  updateTag("venues");
  return { ok: true, savedAt: new Date().toISOString() };
}
