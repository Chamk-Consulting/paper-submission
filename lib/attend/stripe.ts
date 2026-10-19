import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Card payment for attendee registration through Stripe Checkout (REST API, no SDK).
 * Card payment is offered only when STRIPE_SECRET_KEY is set AND SUPABASE_SECRET_KEY is set: marking a registration paid
 * is done server-side with the service client after Stripe confirms, never by the browser.
 */
const API = "https://api.stripe.com/v1";

export const cardReady = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.SUPABASE_SECRET_KEY;

type CheckoutInput = {
  registrationId: string; number: string; description: string; amountCents: number; currency: string; email: string | null;
  successUrl: string; cancelUrl: string;
};

export async function createCheckout(i: CheckoutInput): Promise<{ id: string; url: string } | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const body = new URLSearchParams({
    mode: "payment",
    success_url: i.successUrl,
    cancel_url: i.cancelUrl,
    client_reference_id: i.registrationId,
    "metadata[registration_id]": i.registrationId,
    "metadata[registration_number]": i.number,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": i.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(i.amountCents),
    "line_items[0][price_data][product_data][name]": i.description.slice(0, 250),
  });
  if (i.email) body.set("customer_email", i.email);
  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const j = (await res.json()) as { id?: string; url?: string };
  return j.id && j.url ? { id: j.id, url: j.url } : null;
}

export type CheckoutSession = { id: string; payment_status: string; status: string; client_reference_id: string | null; amount_total: number | null };

export async function getCheckout(id: string): Promise<CheckoutSession | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^cs_[A-Za-z0-9_]{1,200}$/.test(id)) return null;
  const res = await fetch(`${API}/checkout/sessions/${id}`, { headers: { authorization: `Bearer ${key}` }, cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json()) as CheckoutSession;
}

/** Verifies the Stripe-Signature header (v1 scheme, 5-minute tolerance). */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]).filter((p) => p.length === 2)) as Record<string, string>;
  const ts = Number(parts.t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
