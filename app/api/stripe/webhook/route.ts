import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeSignature } from "@/lib/attend/stripe";

// Stripe → Plenary: marks an attendee registration paid when Checkout completes (RG01).
// Needs STRIPE_WEBHOOK_SECRET and SUPABASE_SECRET_KEY; without them the endpoint answers 503 and Stripe retries.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.SUPABASE_SECRET_KEY) return new Response("not configured", { status: 503 });
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) return new Response("bad signature", { status: 400 });
  let event: { type?: string; data?: { object?: { id?: string; payment_status?: string; client_reference_id?: string | null } } };
  try { event = JSON.parse(payload); } catch { return new Response("bad payload", { status: 400 }); }
  const s = event.data?.object;
  if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && s?.id && s.payment_status === "paid" && s.client_reference_id) {
    const admin = createAdminClient();
    const { error } = await admin.from("registrations")
      .update({ paid_at: new Date().toISOString(), status: "confirmed", payment_method: "card" })
      .eq("id", s.client_reference_id).eq("stripe_session_id", s.id).is("paid_at", null);
    if (error) return new Response("retry", { status: 500 });
  }
  return Response.json({ received: true });
}
