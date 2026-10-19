import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cardReady, getCheckout } from "@/lib/attend/stripe";

// Back from Stripe Checkout (RG01). Confirms the payment with Stripe before marking the registration paid, so the result
// shows at once even if the webhook is late. Only the signed-in owner of the registration gets here with a matching session.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  const safeSlug = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug) ? slug : null;
  const back = (q: string) => NextResponse.redirect(new URL(safeSlug ? `/venues/${safeSlug}/register?${q}` : "/workspace", req.nextUrl.origin));
  if (!safeSlug || !cardReady()) return back("card=error");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return back("card=error");
  const session = await getCheckout(sessionId);
  if (!session || !session.client_reference_id) return back("card=error");
  // the registration must be the caller's own (RLS on registrations: own rows or organizer)
  const { data: reg } = await supabase.from("registrations").select("id, stripe_session_id, paid_at").eq("id", session.client_reference_id).maybeSingle();
  if (!reg || reg.stripe_session_id !== session.id) return back("card=error");
  if (session.payment_status === "paid" && !reg.paid_at) {
    await createAdminClient().from("registrations").update({ paid_at: new Date().toISOString(), status: "confirmed", payment_method: "card" })
      .eq("id", reg.id).eq("stripe_session_id", session.id).is("paid_at", null);
  }
  return back(session.payment_status === "paid" ? "done=1&card=paid" : "card=pending");
}
