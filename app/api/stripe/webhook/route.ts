import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Stripe webhook (BL01): marks an invoice paid when its Checkout session completes.
 * Needs STRIPE_WEBHOOK_SECRET (signature check) and SUPABASE_SECRET_KEY (the update runs as the service role,
 * through stripe_mark_paid, which only accepts the session id recorded for that invoice).
 * Point Stripe at <site>/api/stripe/webhook with the event "checkout.session.completed".
 */

function verify(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]).filter((p) => p.length === 2 && p[0] !== "v1"));
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${raw}`).digest();
  return sigs.some((s) => { const b = Buffer.from(s, "hex"); return b.length === expected.length && timingSafeEqual(b, expected); });
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.SUPABASE_SECRET_KEY) return new Response("Not configured", { status: 503 });
  const raw = await req.text();
  if (!verify(raw, req.headers.get("stripe-signature"), secret)) return new Response("Bad signature", { status: 400 });
  const event = JSON.parse(raw) as { type?: string; data?: { object?: { id?: string; payment_status?: string; metadata?: { invoice_id?: string } } } };
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return Response.json({ received: true });
  const s = event.data?.object;
  if (!s?.id || !s.metadata?.invoice_id || s.payment_status !== "paid") return Response.json({ received: true });
  const { error } = await createAdminClient().rpc("stripe_mark_paid", { p_session: s.id, p_invoice: s.metadata.invoice_id });
  if (error) return new Response("Retry", { status: 500 });
  return Response.json({ received: true });
}
