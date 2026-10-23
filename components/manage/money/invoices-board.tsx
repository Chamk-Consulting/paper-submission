"use client";

import { useMemo, useState } from "react";
import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { fmtMoney } from "@/lib/attend/money";
import type { PayRow, PlatformInvoice } from "@/lib/manage/money-data";

/* Event settings › Invoices: invoices this event sent to attendees, and the platform's invoices to the event (owner). */

type Filter = "all" | "unpaid" | "paid" | "cancelled";

export function InvoicesBoard({ slug, attendees, platform }: { slug: string; attendees: PayRow[]; platform: PlatformInvoice[] | null }) {
  const t = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const money = (cents: number | null, cur: string) => fmtMoney(cents, cur, t.intl);
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "—");
  const state = (r: PayRow): Exclude<Filter, "all"> => (r.status === "cancelled" ? "cancelled" : r.status === "paid" || r.status === "free" ? "paid" : "unpaid");
  const count = (f: Filter) => (f === "all" ? attendees.length : attendees.filter((r) => state(r) === f).length);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return attendees.filter((r) => (filter === "all" || state(r) === filter)
      && (!needle || `${r.invoiceNumber} ${r.name} ${r.billingName ?? ""} ${r.email ?? ""}`.toLowerCase().includes(needle)));
  }, [attendees, filter, q]);
  const tone = { unpaid: "bg-[#FBEFDD] text-[#7A4508]", paid: "bg-[#E1F3EA] text-[#14603F]", cancelled: "bg-[#EEF0EC] text-[#4A5263]" } as const;
  const label = { unpaid: "Unpaid", paid: "Paid", cancelled: "Cancelled" } as const;
  const pTone = (s: string) => (s === "paid" ? tone.paid : s === "void" ? tone.cancelled : tone.unpaid);
  const pLabel = (s: string) => (s === "paid" ? "Paid" : s === "void" ? "Cancelled" : "Due");

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className={ui.h2}>{t("Invoices to attendees")}</h2>
        <p className={`${ui.hint} m-0 mt-1`}>{t("Issued when someone registers to pay by invoice (usually a university). The attendee downloads the same PDF from their registration.")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(["all", "unpaid", "paid", "cancelled"] as Filter[]).map((c) => (
            <button key={c} type="button" onClick={() => setFilter(c)} aria-pressed={filter === c}
              className={`h-9 rounded-full border px-3.5 text-[14px] ${filter === c ? "border-[#0E1B3D] bg-[#0E1B3D] text-white" : "border-[#DADDE3] bg-white text-[#121826] hover:bg-[#F7F8F6]"}`}>
              {t(c === "all" ? "All" : label[c])} <span className="ms-1 font-mono text-[12px] opacity-80">{count(c)}</span>
            </button>
          ))}
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search invoice number or name")} aria-label={t("Search invoices")}
            className={`${ui.input} ms-auto h-10 w-full sm:w-[280px]`} />
        </div>
        {attendees.length === 0 ? (
          <p className={`${ui.card} mt-3 text-[14px] text-[#4A5263]`}>{t("No invoices yet. They appear when someone chooses to pay by invoice.")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
            <table className={`${ui.table} min-w-[760px]`}>
              <thead><tr>
                <th className={ui.th}>{t("Invoice")}</th><th className={ui.th}>{t("Billed to")}</th><th className={ui.th}>{t("Issued")}</th>
                <th className={`${ui.th} text-right`}>{t("Amount")}</th><th className={ui.th}>{t("Status")}</th><th className={ui.th}><span className="sr-only">{t("PDF")}</span></th>
              </tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className={`${ui.td} font-mono text-[13px]`}>{r.invoiceNumber}<span className="block font-sans text-[12px] text-[#4A5263]">{t("Registration {n}", { n: r.number })}</span></td>
                    <td className={ui.td}><span className="font-medium">{r.billingName ?? r.name}</span>{r.billingName && r.billingName !== r.name ? <span className="block text-[13px] text-[#4A5263]">{t("for {name}", { name: r.name })}</span> : null}</td>
                    <td className={ui.td}>{day(r.createdAt)}</td>
                    <td className={`${ui.td} text-right font-mono`}>{money(r.amountCents, r.currency)}</td>
                    <td className={ui.td}><span className={`${ui.tag} ${tone[state(r)]}`}>{t(label[state(r)])}</span>{r.paidAt ? <span className="block text-[12px] text-[#4A5263]">{t("on {date}", { date: day(r.paidAt) })}</span> : null}</td>
                    <td className={`${ui.td} whitespace-nowrap text-[13px]`}><a href={`/venues/${slug}/register/document?r=${r.id}&kind=invoice`} className="text-[#2F5FD0]">{t("Download PDF")}</a></td>
                  </tr>
                ))}
                {shown.length === 0 ? <tr><td colSpan={6} className={`${ui.td} text-center text-[#4A5263]`}>{t("No invoices match.")}</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
        <p className={`${ui.hint} m-0 mt-2`}>{t("To mark an invoice as paid when the transfer arrives, use Mark paid on the Payments page.")} <Link href={`/manage/${slug}/payments`} className="text-[#2F5FD0]">{t("Payments")} →</Link></p>
      </section>

      <section>
        <h2 className={ui.h2}>{t("Invoices from Plenary")}</h2>
        <p className={`${ui.hint} m-0 mt-1`}>{t("What this event pays for using Plenary: the event fee and the fee per accepted paper.")}</p>
        {platform === null ? (
          <p className={`${ui.card} mt-3 text-[14px] text-[#4A5263]`}>{t("Only the event owner sees these invoices.")}</p>
        ) : platform.length === 0 ? (
          <p className={`${ui.card} mt-3 text-[14px] text-[#4A5263]`}>{t("No invoices yet. They are issued when the event opens and after decisions.")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
            <table className={`${ui.table} min-w-[760px]`}>
              <thead><tr>
                <th className={ui.th}>{t("Invoice")}</th><th className={ui.th}>{t("For")}</th><th className={ui.th}>{t("Issued")}</th><th className={ui.th}>{t("Due")}</th>
                <th className={`${ui.th} text-right`}>{t("Amount")}</th><th className={ui.th}>{t("Status")}</th><th className={ui.th}><span className="sr-only">{t("PDF")}</span></th>
              </tr></thead>
              <tbody>
                {platform.map((i) => (
                  <tr key={i.id}>
                    <td className={`${ui.td} font-mono text-[13px]`}>{i.number}</td>
                    <td className={ui.td}>{i.description}</td>
                    <td className={ui.td}>{day(i.issuedOn)}</td>
                    <td className={ui.td}>{day(i.dueOn)}</td>
                    <td className={`${ui.td} text-right font-mono`}>{money(i.amountCents, i.currency)}</td>
                    <td className={ui.td}><span className={`${ui.tag} ${pTone(i.status)}`}>{t(pLabel(i.status))}</span></td>
                    <td className={`${ui.td} whitespace-nowrap text-[13px]`}>
                      <a href={`/api/manage/${slug}/invoices/${i.id}`} className="text-[#2F5FD0]">{t("Download PDF")}</a>
                      {i.status === "due" ? <> · <Link href={`/manage/${slug}/billing`} className="text-[#2F5FD0]">{t("Pay")}</Link></> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
