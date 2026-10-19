import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeSignature } from "@/lib/attend/stripe";

/*
 * One Stripe webhook for the whole site. Point Stripe at <site>/api/stripe/webhook with the events
 * "checkout.session.completed" and "checkout.session.async_payment_succeeded".
 * Needs STRIPE_WEBHOOK_SECRET (signature check) and SUPABASE_SECRET_KEY (updates run as the service role);
 * without them it answers 503 and Stripe retries later.
 *  - metadata.invoice_id → organizer plan invoice (BL01), through stripe_mark_paid, which only accepts the
 *    session id recorded for that invoice.
 *  - metadata.registration_id / client_reference_id → attendee registration (RG01), matched on the
 *    recorded Checkout session id.
 */
type Session = { id?: string; payment_status?: string; client_reference_id?: string | null; metadata?: { invoice_id?: string; registration_id?: string } };

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.SUPABASE_SECRET_KEY) return new Response("not configured", { status: 503 });
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) return new Response("bad signature", { status: 400 });
  let event: { type?: string; data?: { object?: Session } };
  try { event = JSON.parse(payload); } catch { return new Response("bad payload", { status: 400 }); }
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return Response.json({ received: true });
  const s = event.data?.object;
  if (!s?.id || s.payment_status !== "paid") return Response.json({ received: true });
  const admin = createAdminClient();

  if (s.metadata?.invoice_id) {
    const { error } = await admin.rpc("stripe_mark_paid", { p_session: s.id, p_invoice: s.metadata.invoice_id });
    if (error) return new Response("retry", { status: 500 });
    return Response.json({ received: true });
  }

  const registrationId = s.metadata?.registration_id ?? s.client_reference_id;
  if (registrationId) {
    const { error } = await admin.from("registrations")
      .update({ paid_at: new Date().toISOString(), status: "confirmed", payment_method: "card" })
      .eq("id", registrationId).eq("stripe_session_id", s.id).is("paid_at", null);
    if (error) return new Response("retry", { status: 500 });
  }
  return Response.json({ received: true });
}
