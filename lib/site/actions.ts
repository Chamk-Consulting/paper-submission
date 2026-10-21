"use server";

import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/auth/me";
import { sendEmail, absUrl } from "@/lib/email/send";
import { site } from "@/lib/config/site";
import { contact, CONTACT_TOPICS, SALES_KINDS } from "@/lib/config/contact";

export type ContactState = { fieldErrors?: Record<string, string[] | undefined>; message?: string };

const supportSchema = z.object({
  kind: z.literal("support"),
  topic: z.enum(CONTACT_TOPICS.map((t) => t[0]) as [string, ...string[]]),
  email: z.string().trim().toLowerCase().email("Enter an email we can reply to."),
  about: z.string().trim().max(200).optional().default(""),
  subject: z.string().trim().min(3, "Add a one-line subject.").max(200),
  body: z.string().trim().min(10, "Tell us a little more — at least a sentence.").max(4000, "Keep it under 4,000 characters."),
  allow: z.string().optional(),
});
const salesSchema = z.object({
  kind: z.literal("sales"),
  name: z.string().trim().min(2, "Add your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter your work email."),
  org: z.string().trim().max(200).optional().default(""),
  role: z.string().trim().max(80).optional().default(""),
  eventKind: z.enum(SALES_KINDS.map((k) => k[0]) as [string, ...string[]]).default("conference"),
  size: z.string().trim().max(40).optional().default(""),
  deadline: z.string().trim().max(10).optional().default(""),
  system: z.string().trim().max(40).optional().default(""),
  body: z.string().trim().max(4000).optional().default(""),
  demo: z.string().optional(),
});

const ALLOWED = new Set(["image/png", "image/jpeg", "application/pdf"]);

/** Team copy with the sender's screenshots (Resend attachments). Same key/skip rules as lib/email/send.ts. */
async function sendWithAttachments(m: { to: string; replyTo: string; subject: string; text: string }, files: File[]) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const attachments = await Promise.all(files.map(async (f) => ({ filename: f.name.slice(0, 120), content: Buffer.from(await f.arrayBuffer()).toString("base64") })));
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: site.email.eventsFrom, to: [m.to], reply_to: m.replyTo, subject: m.subject, text: m.text, attachments }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
}

export type SentSummary = { ref: string; kind: "support" | "sales"; email: string; topic: string; about: string; subject: string; excerpt: string };
const SENT_COOKIE = "plenary_contact_sent";

/** CT01 → CT02. Stores the message (submit_contact), emails the team (CONTACT_TO) and a copy to the sender. */
export async function sendContact(_: ContactState, formData: FormData): Promise<ContactState> {
  // Bots fill every field: a filled hidden field gets a quiet "sent" and nothing is stored or emailed.
  if (String(formData.get("company_website") ?? "").trim()) redirect("/contact/sent");
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  // CAPTCHA (Cloudflare Turnstile) when its keys are set in Vercel.
  const turnstile = process.env.TURNSTILE_SECRET_KEY;
  if (turnstile) {
    const token = String(formData.get("cf-turnstile-response") ?? "");
    const ok = token && await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body: new URLSearchParams({ secret: turnstile, response: token, ...(ip ? { remoteip: ip } : {}) }),
    }).then((r) => r.json()).then((j: { success?: boolean }) => !!j.success).catch(() => false);
    if (!ok) return { message: "Please confirm you're not a robot, then send again." };
  }
  const ipHash = ip ? createHash("sha256").update(`contact|${ip}|${process.env.PLENARY_SIGNING_SECRET ?? ""}`).digest("hex").slice(0, 32) : "";
  const raw = Object.fromEntries(formData);
  const parsed = raw.kind === "sales" ? salesSchema.safeParse(raw) : supportSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors as ContactState["fieldErrors"] };
  const d = parsed.data;
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 3 || files.some((f) => !ALLOWED.has(f.type)) || files.reduce((s, f) => s + f.size, 0) > 900 * 1024) {
    return { message: "Attach up to 3 PNG, JPG or PDF files, under 900 KB in total." };
  }
  const supabase = await createClient();

  let topicLabel: string, subject: string, body: string, details: Record<string, string | boolean>, name = "", about = "";
  if (d.kind === "support") {
    topicLabel = CONTACT_TOPICS.find((t) => t[0] === d.topic)?.[1] ?? d.topic;
    subject = d.subject; body = d.body; about = d.about;
    const me = await getMe();
    name = me?.person?.display_name ?? "";
    details = { about: d.about, ...(ipHash ? { ip_hash: ipHash } : {}) };
  } else {
    topicLabel = SALES_KINDS.find((k) => k[0] === d.eventKind)?.[1] ?? d.eventKind;
    name = d.name;
    subject = `${topicLabel}${d.org ? ` · ${d.org}` : ""}`;
    body = d.body || "(no message)";
    about = d.org;
    details = { org: d.org, role: d.role, eventKind: d.eventKind, size: d.size, deadline: d.deadline, system: d.system, demo: !!d.demo, ...(ipHash ? { ip_hash: ipHash } : {}) };
  }

  const { data: ref, error } = await supabase.rpc("submit_contact", {
    p_kind: d.kind, p_topic: d.kind === "support" ? d.topic : d.eventKind, p_name: name || null, p_email: d.email,
    p_subject: subject, p_body: body, p_details: details, p_allow_access: d.kind === "support" ? !!d.allow : false,
  });
  if (error) {
    if (error.code === "53400") return { message: "You’ve sent several messages in the last hour. Please wait a little before sending another." };
    if (error.code === "PGRST202" || error.code === "42883") return { message: "The contact form isn’t available yet. Please try again later." };
    return { message: "We couldn’t send your message. Please try again." };
  }
  const reference = String(ref);

  const lines = Object.entries(details).filter(([k, v]) => k !== "ip_hash" && v !== "" && v !== false).map(([k, v]) => `${k}: ${v}`).join("\n");
  const to = process.env.CONTACT_TO;
  if (to) {
    const mail = {
      to, replyTo: d.email,
      subject: `[${reference}] ${d.kind === "sales" ? "Sales" : "Support"} · ${topicLabel} · ${subject}`,
      text: `${name ? `${name} <${d.email}>` : d.email}\nTopic: ${topicLabel}\n${lines}\n\n${body}${files.length ? `\n\nAttached: ${files.map((f) => f.name).join(", ")}` : ""}`,
    };
    if (files.length) await sendWithAttachments(mail, files); else await sendEmail(mail);
  }
  await sendEmail({
    to: d.email,
    subject: `${site.name}: we have your message (${reference})`,
    // Never echo what was typed: the confirmation goes to an address nobody verified, so it must carry no sender-chosen text.
    text: `Thanks — we have your message. Someone from the team will reply within ${contact.replyTime}.\n\nReference: ${reference}\nTopic: ${topicLabel}\n\nReply to this email to add anything. Never send passwords or sign-in codes — we will never ask for them.\n\nDidn't write to us? Ignore this email.\n\n${absUrl("/help")}`,
  });

  const summary: SentSummary = { ref: reference, kind: d.kind, email: d.email, topic: topicLabel, about, subject, excerpt: body.slice(0, 220) };
  (await cookies()).set(SENT_COOKIE, JSON.stringify(summary), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  redirect(`/contact/sent?ref=${encodeURIComponent(reference)}`);
}

/** CT02 reads back what was just sent (only for the browser that sent it, for 10 minutes). */
export async function readSentSummary(ref: string | undefined): Promise<SentSummary | null> {
  const raw = (await cookies()).get(SENT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SentSummary;
    return ref && s.ref === ref ? s : null;
  } catch {
    return null;
  }
}

/** VN01 "Email me venue announcements". */
export async function toggleAnnouncements(venueId: string, on: boolean): Promise<{ ok: boolean; message?: string }> {
  if (!z.guid().safeParse(venueId).success) return { ok: false };
  const me = await getMe();
  if (!me?.person) return { ok: false, message: "Sign in first." };
  const supabase = await createClient();
  const { error } = await supabase.from("venue_follows")
    .upsert({ person_id: me.person.id, venue_id: venueId, email_announcements: on }, { onConflict: "person_id,venue_id" });
  if (error) return { ok: false, message: "Couldn’t save that. Try again." };
  revalidatePath("/venues/[slug]/me", "page");
  return { ok: true };
}

const msgSchema = z.object({ venue: z.guid(), person: z.guid(), subject: z.string().trim().min(2, "Add a subject.").max(200), body: z.string().trim().min(2, "Write a message.").max(4000) });

/** VN01 contacts → "Send message" (lands in the chair's Plenary inbox). */
export async function sendVenueMessage(input: { venue: string; person: string; subject: string; body: string }): Promise<{ ok: boolean; message?: string }> {
  const parsed = msgSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the message." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_message", { p_venue: parsed.data.venue, p_people: [parsed.data.person], p_subject: parsed.data.subject, p_body: parsed.data.body, p_submission: null });
  if (error) return { ok: false, message: error.code === "42501" ? "You can’t message this person." : "Couldn’t send. Try again." };
  return { ok: true };
}
