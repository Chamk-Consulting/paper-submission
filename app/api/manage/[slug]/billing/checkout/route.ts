import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { absUrl } from "@/lib/email/send";

/*
 * BL01 "Pay now": a Stripe Checkout session for one due invoice. Off unless STRIPE_SECRET_KEY is set.
 * The invoice is marked paid only by the webhook (app/api/stripe/webhook), never by the browser coming back.
 */

const body = z.object({ invoiceId: z.guid() });
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) return json({ error: "not_found" }, 404);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json({ error: "card_off" }, 503);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "sign_in" }, 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const { data: venue } = await supabase.from("venues").select("id, name, short_name").eq("slug", slug).maybeSingle();
  if (!venue) return json({ error: "not_found" }, 404);
  const { data, error } = await supabase.rpc("billing_overview", { p_venue: venue.id });
  if (error || !data) return json({ error: "forbidden" }, 403);
  const inv = (data as { invoices: { id: string; number: string; description: string; amount_cents: number | null; currency: string; status: string }[] }).invoices
    .find((i) => i.id === parsed.data.invoiceId);
  if (!inv || inv.status !== "due") return json({ error: "not_due" }, 409);
  if (inv.amount_cents === null || inv.amount_cents <= 0) return json({ error: "no_amount" }, 409);

  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": inv.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(inv.amount_cents),
    "line_items[0][price_data][product_data][name]": `${inv.number} · ${(venue.short_name as string) || (venue.name as string)} · ${inv.description}`.slice(0, 250),
    client_reference_id: inv.id,
    "metadata[invoice_id]": inv.id,
    "metadata[venue_slug]": slug,
    customer_email: user.email ?? "",
    success_url: absUrl(`/manage/${slug}/billing?paid=1`),
    cancel_url: absUrl(`/manage/${slug}/billing`),
  });
  if (!user.email) form.delete("customer_email");
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded", "idempotency-key": `inv-${inv.id}-${Math.floor(Date.now() / 600000)}` },
    body: form, signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  const out = res ? ((await res.json().catch(() => null)) as null | { id?: string; url?: string }) : null;
  if (!res?.ok || !out?.id || !out.url) return json({ error: "upstream" }, 502);
  const { error: saveErr } = await supabase.rpc("set_invoice_checkout", { p_invoice: inv.id, p_session: out.id });
  if (saveErr) return json({ error: "forbidden" }, 403);
  return json({ url: out.url });
}
