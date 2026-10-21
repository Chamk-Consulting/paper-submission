"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/config/site";
import { requireEvent } from "@/lib/manage/data";
import { cardReady, createCheckout } from "@/lib/attend/stripe";
import { scanToHash } from "@/lib/attend/badge";

/* Server actions for RG01 (register, cancel), BD01 (reissue badge, desk scan) and the registrations board (mark paid).
   Messages are English keys, translated in the forms. */

export type AttendState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; info?: string };
export type ScanResult = {
  result: "ok" | "already" | "unpaid" | "not_found" | "invalid" | "error";
  id?: string; number?: string; full_name?: string | null; reg_type?: string; affiliation?: string | null; at?: string;
  amount_cents?: number | null; currency?: string | null; talk?: { number: number | null; code: string; starts_at: string; room: string | null } | null;
};

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);
const uuid = z.guid();
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function friendly(msg?: string): string {
  if (!msg) return "Something went wrong. Please try again.";
  if (/already registered/i.test(msg)) return "You are already registered for this event.";
  if (/already covered/i.test(msg)) return "One of these papers is already covered by another registration.";
  if (/covers at most/i.test(msg)) return "This ticket covers fewer papers than you selected.";
  if (/price not set/i.test(msg)) return "The organizers haven't set a price for this ticket yet.";
  if (/choose a ticket/i.test(msg)) return "Choose a ticket.";
  if (/not your accepted paper/i.test(msg)) return "You can only cover your own accepted papers.";
  if (/only unpaid/i.test(msg)) return "Only unpaid registrations can be cancelled here. Contact the organizers.";
  if (/cancelled/i.test(msg)) return "This registration is cancelled.";
  if (/not allowed|42501|permission/i.test(msg)) return "You don't have permission to do this.";
  if (/venue not found/i.test(msg)) return "This event isn't open for registration.";
  return "Something went wrong. Please try again.";
}

const registerSchema = z.object({
  slug: slugSchema,
  venueId: uuid,
  ticket: z.coerce.number().int().min(1, "Choose a ticket.").max(50),
  method: z.enum(["invoice", "card"]),
  billing_name: z.string().trim().max(200).optional(),
  billing_vat: z.string().trim().max(40).optional(),
  billing_address: z.string().trim().max(400).optional(),
  billing_po: z.string().trim().max(60).optional(),
  billing_email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.").max(254)]).optional(),
});

export async function registerAttendee(_: AttendState, fd: FormData): Promise<AttendState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const p = parsed.data;
  const papers = fd.getAll("paper").map(String).filter((x) => uuid.safeParse(x).success);
  const extras = fd.getAll("extra").map(String).map((k) => ({ index: Number(k), qty: Math.max(0, Math.min(10, Number(fd.get(`qty_${k}`) ?? 1) || 0)) }))
    .filter((x) => Number.isInteger(x.index) && x.index > 0 && x.qty > 0);
  if (p.method === "card" && !cardReady()) return { error: "Card payment isn't set up for this event yet." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_attendee", {
    p_venue: p.venueId, p_ticket: p.ticket, p_papers: papers, p_extras: extras,
    p_billing: { name: p.billing_name, vat: p.billing_vat, address: p.billing_address, po: p.billing_po, email: p.billing_email || undefined },
    p_method: p.method,
  });
  if (error || !data) return { error: friendly(error?.message) };
  const r = data as { id: string; number: string; amount_cents: number; currency: string; status: string };
  revalidatePath(`/[lang]/venues/${p.slug}/register`, "page");

  if (p.method === "card" && r.status === "awaiting_payment") {
    const { data: venue } = await supabase.from("venues").select("name, short_name").eq("id", p.venueId).maybeSingle();
    const session = await createCheckout({
      registrationId: r.id, number: r.number, amountCents: r.amount_cents, currency: r.currency,
      description: `${venue?.short_name ?? venue?.name ?? "Registration"} · ${r.number}`,
      email: p.billing_email || null,
      successUrl: absoluteUrl(`/api/stripe/return?slug=${p.slug}&session_id={CHECKOUT_SESSION_ID}`),
      cancelUrl: absoluteUrl(`/venues/${p.slug}/register?card=cancelled`),
    });
    if (!session) return { error: "We couldn't start the card payment. Your registration is saved — pay by bank transfer or try again." };
    await createAdminClient().from("registrations").update({ stripe_session_id: session.id }).eq("id", r.id);
    redirect(session.url);
  }
  redirect(`/venues/${p.slug}/register?done=1`);
}

/** Pay an existing unpaid registration by card (from the status view). */
export async function payByCard(_: AttendState, fd: FormData): Promise<AttendState> {
  const slug = s(fd, "slug"), id = s(fd, "id");
  if (!slugSchema.safeParse(slug).success || !uuid.safeParse(id).success) return { error: "Bad request." };
  if (!cardReady()) return { error: "Card payment isn't set up for this event yet." };
  const supabase = await createClient();
  const { data: doc } = await supabase.rpc("registration_document", { p_registration: id });
  const d = doc as { number: string; amount_cents: number | null; currency: string | null; status: string; venue: string; email: string | null } | null;
  if (!d || d.status !== "awaiting_payment" || !d.amount_cents || !d.currency) return { error: "This registration doesn't need a payment." };
  const session = await createCheckout({
    registrationId: id, number: d.number, amountCents: d.amount_cents, currency: d.currency, description: `${d.venue} · ${d.number}`, email: d.email,
    successUrl: absoluteUrl(`/api/stripe/return?slug=${slug}&session_id={CHECKOUT_SESSION_ID}`), cancelUrl: absoluteUrl(`/venues/${slug}/register?card=cancelled`),
  });
  if (!session) return { error: "We couldn't start the card payment. Please try again." };
  await createAdminClient().from("registrations").update({ stripe_session_id: session.id }).eq("id", id);
  redirect(session.url);
}

export async function cancelMyRegistration(_: AttendState, fd: FormData): Promise<AttendState> {
  const slug = s(fd, "slug"), id = s(fd, "id");
  if (!slugSchema.safeParse(slug).success || !uuid.safeParse(id).success) return { error: "Bad request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_registration", { p_registration: id });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/[lang]/venues/${slug}/register`, "page");
  return { ok: true };
}

export async function reissueBadge(_: AttendState, fd: FormData): Promise<AttendState> {
  const slug = s(fd, "slug"), id = s(fd, "id");
  if (!slugSchema.safeParse(slug).success || !uuid.safeParse(id).success) return { error: "Bad request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reissue_badge", { p_registration: id });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/[lang]/venues/${slug}/badge`, "page");
  return { ok: true, info: "New badge issued. The old QR code no longer works." };
}

/** Desk scan (BD01). Called from the scanner with the raw QR text. */
export async function scanBadge(slug: string, raw: string, force = false): Promise<ScanResult> {
  if (!slugSchema.safeParse(slug).success) return { result: "error" };
  const hash = scanToHash(raw);
  if (!hash) return { result: "invalid" };
  try {
    const ctx = await requireEvent(slug);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("check_in_by_token", { p_venue: ctx.venue.id, p_hash: hash, p_force: force });
    if (error || !data) return { result: "error" };
    return data as ScanResult;
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { result: "error" };
  }
}

/** Registrations board: a registration chair confirms a bank transfer (or undoes it). */
export async function markRegistrationPaid(_: AttendState, fd: FormData): Promise<AttendState> {
  const slug = s(fd, "slug"), id = s(fd, "id"), paid = s(fd, "paid") !== "0";
  if (!slugSchema.safeParse(slug).success || !uuid.safeParse(id).success) return { error: "Bad request." };
  try {
    await requireEvent(slug);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { error: "You don't have permission to do this." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_registration_paid", { p_registration: id, p_paid: paid });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/[lang]/manage/${slug}/registrations`, "page");
  return { ok: true };
}
