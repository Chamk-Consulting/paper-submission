"use client";

import { useMemo, useState } from "react";
import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { Act } from "@/components/manage/ops2/act";
import { markRegistrationPaid } from "@/lib/attend/actions";
import { fmtMoney } from "@/lib/attend/money";
import type { PayRow } from "@/lib/manage/money-data";

/* Event settings › Payments: every registration payment of this event, with totals, filters, export and actions. */

type Filter = "all" | "awaiting" | "paid" | "free" | "cancelled";
const TONE: Record<PayRow["status"], string> = {
  paid: "bg-[#E1F3EA] text-[#14603F]", awaiting: "bg-[#FBEFDD] text-[#7A4508]", cancelled: "bg-[#EEF0EC] text-[#4A5263]", free: "bg-[#E6EDFC] text-[#1F47A8]",
};
const LABEL: Record<PayRow["status"], string> = { paid: "Paid", awaiting: "Awaiting payment", cancelled: "Cancelled", free: "Free" };
const METHOD: Record<string, string> = { card: "Card", invoice: "Bank transfer", manual: "Manual" };

function sums(rows: PayRow[]): string[] {
  const by = new Map<string, number>();
  for (const r of rows) if (r.amountCents) by.set(r.currency, (by.get(r.currency) ?? 0) + r.amountCents);
  return [...by.entries()].map(([c, n]) => `${c}:${n}`);
}

function csvCell(v: string | number | null) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function PaymentsBoard({ slug, rows }: { slug: string; rows: PayRow[] }) {
  const t = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const money = (cents: number | null, cur: string) => fmtMoney(cents, cur, t.intl);
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "—");

  const count = (f: Filter) => (f === "all" ? rows.length : rows.filter((r) => r.status === f).length);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (filter === "all" || r.status === filter)
      && (!needle || `${r.number} ${r.name} ${r.email ?? ""} ${r.affiliation ?? ""} ${r.invoiceNumber ?? ""}`.toLowerCase().includes(needle)));
  }, [rows, filter, q]);

  const total = (st: PayRow["status"]) => sums(rows.filter((r) => r.status === st)).map((x) => { const [c, n] = x.split(":"); return money(Number(n), c); }).join(" + ") || money(0, rows[0]?.currency ?? "EUR");

  const exportCsv = () => {
    const head = ["Number", "Name", "Email", "Affiliation", "Type", "Amount", "Currency", "Method", "Status", "Invoice", "Paid on", "Registered on"];
    const lines = shown.map((r) => [r.number, r.name, r.email, r.affiliation, r.type, r.amountCents == null ? "" : (r.amountCents / 100).toFixed(2), r.currency,
      r.method ? METHOD[r.method] ?? r.method : "", LABEL[r.status], r.invoiceNumber, r.paidAt?.slice(0, 10) ?? "", r.createdAt.slice(0, 10)].map(csvCell).join(","));
    const blob = new Blob([`﻿${[head.join(","), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${slug}-payments.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const doc = (id: string, kind: "invoice" | "receipt") => `/venues/${slug}/register/document?r=${id}&kind=${kind}`;
  const chips: Filter[] = ["all", "awaiting", "paid", "free", "cancelled"];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={ui.card}><p className={ui.kicker}>{t("Collected")}</p><p className="m-0 mt-1 font-serif text-[28px]">{total("paid")}</p><p className={`${ui.hint} m-0`}>{t("{n} paid", { n: count("paid") })}</p></div>
        <div className={ui.card}><p className={ui.kicker}>{t("Awaiting payment")}</p><p className="m-0 mt-1 font-serif text-[28px] text-[#7A4508]">{total("awaiting")}</p><p className={`${ui.hint} m-0`}>{t("{n} to follow up", { n: count("awaiting") })}</p></div>
        <div className={ui.card}><p className={ui.kicker}>{t("Free and cancelled")}</p><p className="m-0 mt-1 font-serif text-[28px]">{count("free") + count("cancelled")}</p><p className={`${ui.hint} m-0`}>{t("{a} free · {b} cancelled", { a: count("free"), b: count("cancelled") })}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button key={c} type="button" onClick={() => setFilter(c)} aria-pressed={filter === c}
            className={`h-9 rounded-full border px-3.5 text-[14px] ${filter === c ? "border-[#0E1B3D] bg-[#0E1B3D] text-white" : "border-[#DADDE3] bg-white text-[#121826] hover:bg-[#F7F8F6]"}`}>
            {t(c === "all" ? "All" : LABEL[c as PayRow["status"]])} <span className="ms-1 font-mono text-[12px] opacity-80">{count(c)}</span>
          </button>
        ))}
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search name, email, number or invoice")} aria-label={t("Search payments")}
          className={`${ui.input} ms-auto h-10 w-full sm:w-[300px]`} />
        <button type="button" onClick={exportCsv} disabled={!shown.length} className={`${ui.ghost} h-10`}>{t("Export CSV")}</button>
      </div>

      {rows.length === 0 ? (
        <div className={ui.card}>
          <p className="m-0 font-semibold">{t("No payments yet")}</p>
          <p className={`${ui.hint} m-0 mt-1`}>{t("Payments appear here as soon as people register. Set the fees in Setup › Registration & fees.")}</p>
          <Link href={`/manage/${slug}/setup`} className={`${ui.ghost} mt-3 h-10`}>{t("Open setup")}</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
          <table className={`${ui.table} min-w-[860px]`}>
            <thead><tr>
              <th className={ui.th}>{t("Number")}</th><th className={ui.th}>{t("Person")}</th><th className={ui.th}>{t("Type")}</th>
              <th className={`${ui.th} text-right`}>{t("Amount")}</th><th className={ui.th}>{t("Method")}</th><th className={ui.th}>{t("Status")}</th>
              <th className={ui.th}>{t("Documents")}</th>
            </tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className={`${ui.td} font-mono text-[13px]`}>{r.number}</td>
                  <td className={ui.td}><span className="font-medium">{r.name}</span>{r.affiliation ? <span className="block text-[13px] text-[#4A5263]">{r.affiliation}</span> : null}</td>
                  <td className={ui.td}>{r.type}</td>
                  <td className={`${ui.td} text-right font-mono`}>{money(r.amountCents, r.currency)}</td>
                  <td className={ui.td}>{r.method ? t(METHOD[r.method] ?? r.method) : "—"}</td>
                  <td className={ui.td}>
                    <span className={`${ui.tag} ${TONE[r.status]}`}>{t(LABEL[r.status])}</span>
                    <span className="block text-[12px] text-[#4A5263]">{r.status === "paid" ? t("on {date}", { date: day(r.paidAt) }) : t("registered {date}", { date: day(r.createdAt) })}</span>
                    {r.status === "awaiting" ? (
                      <div className="mt-1"><Act action={markRegistrationPaid} fields={{ slug, id: r.id, paid: "1" }} className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-[#14603F] underline" pendingLabel={t("Saving…")}>{t("Mark paid")}</Act></div>
                    ) : null}
                  </td>
                  <td className={`${ui.td} whitespace-nowrap text-[13px]`}>
                    {r.invoiceNumber ? <a href={doc(r.id, "invoice")} className="text-[#2F5FD0]">{t("Invoice")}</a> : null}
                    {r.invoiceNumber && r.status === "paid" ? " · " : null}
                    {r.status === "paid" ? <a href={doc(r.id, "receipt")} className="text-[#2F5FD0]">{t("Receipt")}</a> : null}
                    {!r.invoiceNumber && r.status !== "paid" ? "—" : null}
                  </td>
                </tr>
              ))}
              {shown.length === 0 ? <tr><td colSpan={7} className={`${ui.td} text-center text-[#4A5263]`}>{t("No payments match.")}</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
