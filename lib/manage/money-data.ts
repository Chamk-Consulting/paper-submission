import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadBilling } from "@/lib/manage/orgtools-data";

/*
 * Event settings › Payments and Invoices. Both read data the event already has:
 * registrations (amount, method, status, invoice number, paid date) and the platform's invoices to the event
 * (event_invoices, owner only, through billing_overview). No new tables.
 */

export type PayRow = {
  id: string; number: string; name: string; email: string | null; affiliation: string | null; type: string;
  amountCents: number | null; currency: string; method: string | null; status: "paid" | "awaiting" | "cancelled" | "free";
  invoiceNumber: string | null; paidAt: string | null; createdAt: string; billingName: string | null;
};

export async function loadPayments(venueId: string): Promise<PayRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("registrations")
    .select("id, number, full_name, email, affiliation, reg_type, amount_cents, currency, payment_method, status, invoice_number, paid_at, created_at, cancelled_at, billing")
    .eq("venue_id", venueId).order("created_at", { ascending: false }).limit(5000);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const cents = r.amount_cents == null ? null : Number(r.amount_cents);
    const status: PayRow["status"] = r.status === "cancelled" || r.cancelled_at ? "cancelled" : r.paid_at ? "paid" : cents === 0 ? "free" : "awaiting";
    const billing = (r.billing as Record<string, unknown> | null) ?? {};
    return {
      id: r.id as string, number: r.number as string, name: (r.full_name as string) ?? "—", email: (r.email as string) ?? null,
      affiliation: (r.affiliation as string) ?? null, type: r.reg_type as string, amountCents: cents, currency: (r.currency as string) ?? "EUR",
      method: (r.payment_method as string) ?? null, status, invoiceNumber: (r.invoice_number as string) ?? null,
      paidAt: (r.paid_at as string) ?? null, createdAt: r.created_at as string,
      billingName: (billing.name as string) || (billing.billing_name as string) || null,
    };
  });
}

export type PlatformInvoice = { id: string; number: string; description: string; amountCents: number | null; currency: string; status: string; issuedOn: string; dueOn: string; paidAt: string | null };

/** The platform's invoices to this event (owner only; null when not the owner or billing isn't installed). */
export async function loadPlatformInvoices(venueId: string, isOwner: boolean): Promise<PlatformInvoice[] | null> {
  if (!isOwner) return null;
  const b = await loadBilling(venueId);
  if (!b) return null;
  const list = ((b as unknown as { invoices?: Record<string, unknown>[] }).invoices ?? []);
  return list.map((i) => ({
    id: i.id as string, number: i.number as string, description: i.description as string,
    amountCents: i.amount_cents == null ? null : Number(i.amount_cents), currency: (i.currency as string) ?? "EUR",
    status: i.status as string, issuedOn: (i.issued_on as string) ?? "", dueOn: (i.due_on as string) ?? "", paidAt: (i.paid_at as string) ?? null,
  }));
}
