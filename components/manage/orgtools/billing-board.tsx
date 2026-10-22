"use client";

import { useActionState, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { Act, FieldErr, StateLine, Submit } from "@/components/manage/ops2/act";
import { changePlan, requestInvoice, saveBillingDetails, type OrgState } from "@/lib/manage/orgtools-actions";
import type { Billing, Invoice } from "@/lib/manage/orgtools-data";

const PLANS = [
  { id: "workshop", name: "Workshop", desc: "Submissions & double-blind review, program pages" },
  { id: "conference", name: "Conference", desc: "Associate editors, bidding, IEEE copyright & Xplore export" },
  { id: "society", name: "Society", desc: "Many events · shared reviewer pool, SSO" },
] as const;

function money(cents: number | null, currency: string, intl: string) {
  return cents === null ? "[PRICE]" : new Intl.NumberFormat(intl, { style: "currency", currency }).format(cents / 100);
}

function Meter({ label, used, limit, intl, t }: { label: string; used: number; limit: number | null; intl: string; t: ReturnType<typeof useT> }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : null;
  return (
    <div>
      <div className="flex justify-between gap-3 text-[14px]"><span>{label}</span><span className="font-mono">{used.toLocaleString(intl)} {t("of")} {limit ? limit.toLocaleString(intl) : "[LIMIT]"}</span></div>
      <div aria-hidden className="mt-1.5 h-2 rounded bg-[#EEF0EC]"><div className="h-2 rounded" style={{ width: `${pct ?? 0}%`, background: pct !== null && pct >= 90 ? "#A8600F" : "#2F5FD0" }} /></div>
    </div>
  );
}

function PayCell({ slug, inv, stripeOn }: { slug: string; inv: Invoice; stripeOn: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  if (inv.status !== "due") return null;
  function card() {
    setErr(null);
    start(async () => {
      const res = await fetch(`/api/manage/${slug}/billing/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ invoiceId: inv.id }) });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && j.url) { window.location.assign(j.url); return; }
      setErr(j.error === "no_amount" ? t("The amount isn't set yet — ask for an invoice instead.") : t("Card payment isn't available right now."));
    });
  }
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
      {stripeOn && inv.amount_cents !== null ? (
        <button type="button" onClick={card} disabled={pending} className="border-0 bg-transparent p-0 text-[13px] font-semibold text-[#2F5FD0] underline">{pending ? t("Opening…") : t("Pay now")}</button>
      ) : null}
      {inv.invoice_sent_at ? <span className="text-[12px] text-[#4A5263]">{t("Invoice sent")}</span> : (
        <Act action={requestInvoice} fields={{ slug, invoiceId: inv.id }} className="border-0 bg-transparent p-0 text-[13px] font-semibold text-[#2F5FD0] underline" pendingLabel={t("Sending…")}
          done={<span className="text-[12px] text-[#14603F]">{t("Invoice sent")}</span>}>{t("Bank transfer")}</Act>
      )}
      {err ? <span role="alert" className="w-full text-right text-[12px] text-[#B3261E]">{err}</span> : null}
    </span>
  );
}

function Details({ slug, b }: { slug: string; b: Billing["billing"] }) {
  const t = useT();
  const [edit, setEdit] = useState(false);
  const [state, run] = useActionState<OrgState, FormData>(async (p, fd) => { const r = await saveBillingDetails(p, fd); if (r.ok) setEdit(false); return r; }, {});
  if (!edit) {
    return (
      <>
        <dl className="m-0 mt-2.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[14px]">
          <dt className="text-[#4A5263]">{t("Billed to")}</dt><dd className="m-0">{b?.billing_name || "—"}</dd>
          <dt className="text-[#4A5263]">{t("VAT")}</dt><dd className="m-0 font-mono">{b?.vat_number || "—"}</dd>
          <dt className="text-[#4A5263]">{t("Address")}</dt><dd className="m-0 whitespace-pre-line">{b?.billing_address || "—"}</dd>
          <dt className="text-[#4A5263]">{t("PO")}</dt><dd className="m-0">{b?.po_number || "—"}</dd>
          <dt className="text-[#4A5263]">{t("Invoices to")}</dt><dd className="m-0 break-all">{b?.invoice_email || "—"}</dd>
        </dl>
        {state.ok ? <p role="status" className="m-0 mt-2 text-[13px] text-[#14603F]">{t("Saved.")}</p> : null}
        <button type="button" onClick={() => setEdit(true)} className={`${ui.ghost} mt-3 h-8! px-3! text-[13px]!`}>{t("Edit details")}</button>
      </>
    );
  }
  return (
    <form action={run} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <label className={ui.label}>{t("Billed to")}<input name="billing_name" defaultValue={b?.billing_name ?? ""} placeholder={t("Society or university")} className={ui.input} /><FieldErr state={state} name="billing_name" /></label>
      <label className={ui.label}>{t("VAT number")}<input name="vat_number" defaultValue={b?.vat_number ?? ""} className={ui.input} /><FieldErr state={state} name="vat_number" /></label>
      <label className={ui.label}>{t("Billing address")}<textarea name="billing_address" rows={3} defaultValue={b?.billing_address ?? ""} className={ui.textarea} /><FieldErr state={state} name="billing_address" /></label>
      <label className={ui.label}>{t("Purchase order")}<input name="po_number" defaultValue={b?.po_number ?? ""} className={ui.input} /><FieldErr state={state} name="po_number" /></label>
      <label className={ui.label}>{t("Send invoices to")}<input name="invoice_email" type="email" defaultValue={b?.invoice_email ?? ""} placeholder="finance@" className={ui.input} /><FieldErr state={state} name="invoice_email" /></label>
      <StateLine state={state} />
      <div className="flex gap-2"><Submit className={ui.navy} pendingLabel={t("Saving…")}>{t("Save")}</Submit><button type="button" onClick={() => setEdit(false)} className={ui.ghost}>{t("Cancel")}</button></div>
    </form>
  );
}

export function BillingBoard({ slug, data, stripeOn, paid }: { slug: string; data: Billing; stripeOn: boolean; paid: boolean }) {
  const t = useT();
  const b = data.billing;
  const plan = PLANS.find((p) => p.id === b?.plan) ?? null;
  const currency = b?.currency ?? "EUR";
  const [planState, runPlan, planPending] = useActionState<OrgState, FormData>(changePlan, {});
  const statusCls: Record<Invoice["status"], [string, string]> = { due: ["DUE", "bg-[#FBEFDD] text-[#7A4508]"], paid: ["PAID", "bg-[#E1F3EA] text-[#14603F]"], void: ["VOID", "bg-[#EEF0EC] text-[#4A5263]"] };

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-[18px]">
        {paid ? <p role="status" className={ui.ok}>{t("Payment received — thank you. The invoice is marked paid.")}</p> : null}
        <section className={ui.card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={ui.kicker}>{t("Plan for this event")}</p>
              <p className="m-0 mt-1.5 font-serif text-[28px]">{plan ? t(plan.name) : t("No plan chosen yet")}</p>
              <p className="m-0 mt-0.5 text-[14px] text-[#4A5263]">{plan ? t(plan.desc) : t("Choose the plan that fits your event. You can change it later.")}</p>
            </div>
            <div className="text-right">
              <p className="m-0 font-mono text-[22px] font-semibold">{money(b?.price_cents ?? null, currency, t.intl)}</p>
              <p className="m-0 text-[13px] text-[#4A5263]">{t("per event, excl. VAT")}</p>
            </div>
          </div>
          <form action={runPlan}>
            <input type="hidden" name="slug" value={slug} />
            <div role="radiogroup" aria-label={t("Plan")} className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {PLANS.map((p) => {
                const on = b?.plan === p.id;
                return (
                  <button key={p.id} type="submit" name="plan" value={p.id} role="radio" aria-checked={on} disabled={planPending || on}
                    onClick={(e) => { if (!on && b?.plan && !window.confirm(t("Change the plan? A new invoice is raised for the difference."))) e.preventDefault(); }}
                    className={`rounded-[6px] border px-3.5 py-3 text-left text-[#121826] ${on ? "border-[#2F5FD0] bg-[#FBFCFF]" : "border-[#DADDE3] bg-white hover:bg-[#F7F8F6]"}`}>
                    <strong className="block text-[15px]">{t(p.name)}</strong>
                    <span className="block text-[13px] text-[#4A5263]">{t(p.desc)}</span>
                    <span className="mt-1.5 block font-mono text-[13px]">{on ? money(b?.price_cents ?? null, currency, t.intl) : "[PRICE]"}</span>
                  </button>
                );
              })}
            </div>
            <p className="m-0 mt-3 rounded-[6px] bg-[#E6EDFC] px-2.5 py-2 text-[13px] text-[#1F2E5C]">{t("Changing plan creates a new invoice for the difference. Features switch on as soon as it's paid.")}</p>
            <div className="mt-2"><StateLine state={planState} /></div>
          </form>
        </section>

        <section className={ui.card}>
          <h2 className="m-0 text-[17px] font-semibold">{t("Usage this event")}</h2>
          <div className="mt-3.5 flex flex-col gap-3">
            <Meter label={t("Submissions")} used={data.submissions} limit={b?.submission_limit ?? null} intl={t.intl} t={t} />
            <div className="flex justify-between gap-3 text-[14px]"><span>{t("Associate editors & reviewers")}</span><span className="font-mono">{t("Unlimited")}</span></div>
            <Meter label={t("AI summaries for reviewers")} used={data.ai_uses} limit={b?.ai_limit ?? null} intl={t.intl} t={t} />
          </div>
        </section>

        <section className="overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
          <div className="border-b border-[#EEF0EC] px-5 py-4"><h2 className="m-0 text-[17px] font-semibold">{t("Invoices")}</h2></div>
          {data.invoices.length ? (
            <div className="overflow-x-auto">
              <table className={ui.table}>
                <thead><tr>
                  <th scope="col" className={ui.th}>{t("Invoice")}</th><th scope="col" className={ui.th}>{t("Date")}</th><th scope="col" className={ui.th}>{t("For")}</th>
                  <th scope="col" className={ui.th}>{t("Amount")}</th><th scope="col" className={ui.th}>{t("Status")}</th><th scope="col" className={ui.th}><span className="sr-only">{t("Actions")}</span></th>
                </tr></thead>
                <tbody>
                  {data.invoices.map((i) => (
                    <tr key={i.id}>
                      <td className={`${ui.td} font-mono`}>{i.number}</td>
                      <td className={ui.td}>{new Date(`${i.issued_on}T12:00:00Z`).toLocaleDateString(t.intl, { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className={ui.td}>{i.description}</td>
                      <td className={`${ui.td} font-mono`}>{money(i.amount_cents, i.currency, t.intl)}</td>
                      <td className={ui.td}><span className={`${ui.tag} ${statusCls[i.status][1]}`}>{i.status === "due" ? t("DUE BY {date}", { date: new Date(`${i.due_on}T12:00:00Z`).toLocaleDateString(t.intl, { day: "numeric", month: "short" }) }) : t(statusCls[i.status][0])}</span></td>
                      <td className={`${ui.td} whitespace-nowrap text-right`}>
                        <span className="inline-flex flex-wrap items-center justify-end gap-2">
                          <a href={`/api/manage/${slug}/invoices/${i.id}`} className="text-[13px]">PDF</a>
                          <PayCell slug={slug} inv={i} stripeOn={stripeOn} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="m-0 px-5 py-5 text-[14px] text-[#4A5263]">{t("No invoices yet. Choosing a plan raises the first one.")}</p>}
        </section>
      </div>

      <aside className="flex flex-[1_1_300px] flex-col gap-4">
        <section className={ui.card}>
          <p className={ui.kicker}>{t("Payment method")}</p>
          {stripeOn ? (
            <p className="m-0 mt-2.5 text-[14px]">{t("Pay invoices by card through our payment provider — use “Pay now” on a due invoice.")}</p>
          ) : (
            <p className="m-0 mt-2.5 text-[14px]">{t("Card payment isn't switched on yet. Choose “Bank transfer” and we email the invoice to your finance office.")}</p>
          )}
          <p className="m-0 mt-3 text-[13px] text-[#4A5263]">{t("Or pay by bank transfer — we email the invoice to your finance office.")}</p>
        </section>
        <section className={ui.card}>
          <p className={ui.kicker}>{t("Billing details")}</p>
          <Details slug={slug} b={b} />
        </section>
        <section className={`${ui.card} text-[14px]`}>
          <p className={ui.kicker}>{t("Who can see this")}</p>
          <p className="m-0 mt-2 text-[#4A5263]">{t("Only the event owner. Chairs see the plan name, not invoices.")}</p>
        </section>
      </aside>
    </div>
  );
}
