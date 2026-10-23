"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "@/components/site/link";
import { Clock } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { fmtMoney } from "@/lib/attend/money";
import { createPlatformInvoice, setPlatformInvoiceStatus } from "@/lib/admin/actions";
import type { AdminInvoice, AdminPayment } from "@/lib/admin/data";

/* Platform admin › Payments, Invoices and Payouts (canvas AD02–AD04). */

const chip = (on: boolean) => `h-9 rounded-full border px-3.5 text-[14px] ${on ? "border-[#0E1B3D] bg-[#0E1B3D] text-white" : "border-[#DADDE3] bg-white text-[#121826] hover:bg-[#F7F8F6]"}`;
const TONE: Record<string, string> = {
  paid: "bg-[#E1F3EA] text-[#14603F]", awaiting: "bg-[#FBEFDD] text-[#7A4508]", due: "bg-[#FBEFDD] text-[#7A4508]", overdue: "bg-[#FDECEA] text-[#8C1D18]",
  free: "bg-[#E6EDFC] text-[#1F47A8]", cancelled: "bg-[#EEF0EC] text-[#4A5263]", void: "bg-[#EEF0EC] text-[#4A5263]",
};
const LABEL: Record<string, string> = { paid: "Paid", awaiting: "Awaiting payment", due: "Due", overdue: "Overdue", free: "Free", cancelled: "Cancelled", void: "Cancelled" };
const METHOD: Record<string, string> = { card: "Card", invoice: "Bank transfer", bank: "Bank transfer", manual: "Manual" };

function Head({ title, sub, right }: { title: string; sub: string; right?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Admin")}</p>
        <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t(title)}</h1>
        <p className="mt-1.5 text-[#4A5263]">{t(sub)}</p>
      </div>
      {right}
    </div>
  );
}

function totals(rows: { amount_cents: number | null; currency: string }[], fmt: (c: number, cur: string) => string) {
  const by = new Map<string, number>();
  for (const r of rows) if (r.amount_cents) by.set(r.currency, (by.get(r.currency) ?? 0) + r.amount_cents);
  return [...by.entries()].map(([c, n]) => fmt(n, c)).join(" + ") || "—";
}

/* ------------------------------------------------------------------ Payments */

export function AdminPayments({ rows }: { rows: AdminPayment[] }) {
  const t = useT();
  const [status, setStatus] = useState<"all" | AdminPayment["status"]>("all");
  const [venue, setVenue] = useState("all");
  const [q, setQ] = useState("");
  const money = (c: number | null, cur: string) => fmtMoney(c, cur, t.intl);
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "—");
  const venues = useMemo(() => [...new Map(rows.map((r) => [r.venue_slug, r.venue])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const inVenue = rows.filter((r) => venue === "all" || r.venue_slug === venue);
  const shown = inVenue.filter((r) => (status === "all" || r.status === status)
    && (!q.trim() || `${r.number} ${r.full_name ?? ""} ${r.email ?? ""} ${r.invoice_number ?? ""} ${r.venue}`.toLowerCase().includes(q.trim().toLowerCase())));
  const count = (s: typeof status) => (s === "all" ? inVenue.length : inVenue.filter((r) => r.status === s).length);

  const exportCsv = () => {
    const cell = (v: string | number | null) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ["Event", "Number", "Name", "Email", "Type", "Amount", "Currency", "Method", "Status", "Invoice", "Paid on", "Registered on"];
    const lines = shown.map((r) => [r.venue, r.number, r.full_name, r.email, r.reg_type, r.amount_cents == null ? "" : (r.amount_cents / 100).toFixed(2), r.currency,
      r.payment_method ? METHOD[r.payment_method] ?? r.payment_method : "", LABEL[r.status], r.invoice_number, r.paid_at?.slice(0, 10) ?? "", r.created_at.slice(0, 10)].map(cell).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`﻿${[head.join(","), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" }));
    a.download = "platform-payments.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <Head title="Payments" sub="All money through the platform: every event, every status." right={<button type="button" onClick={exportCsv} disabled={!shown.length} className={`${ui.ghost} h-10`}>{t("Export CSV")}</button>} />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className={ui.card}><p className={ui.kicker}>{t("Collected")}</p><p className="m-0 mt-1 font-serif text-[26px]">{totals(inVenue.filter((r) => r.status === "paid"), (c, cur) => money(c, cur))}</p><p className={`${ui.hint} m-0`}>{t("{n} paid", { n: count("paid") })}</p></div>
        <div className={ui.card}><p className={ui.kicker}>{t("Awaiting payment")}</p><p className="m-0 mt-1 font-serif text-[26px] text-[#7A4508]">{totals(inVenue.filter((r) => r.status === "awaiting"), (c, cur) => money(c, cur))}</p><p className={`${ui.hint} m-0`}>{t("{n} to follow up", { n: count("awaiting") })}</p></div>
        <div className={ui.card}><p className={ui.kicker}>{t("Events")}</p><p className="m-0 mt-1 font-serif text-[26px]">{venues.length}</p><p className={`${ui.hint} m-0`}>{t("with at least one registration")}</p></div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(["all", "awaiting", "paid", "free", "cancelled"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={chip(status === s)}>{t(s === "all" ? "All" : LABEL[s])} <span className="ms-1 font-mono text-[12px] opacity-80">{count(s)}</span></button>
        ))}
        <select value={venue} onChange={(e) => setVenue(e.target.value)} aria-label={t("Event")} className={`${ui.input} h-10 ms-auto`}>
          <option value="all">{t("All events")}</option>
          {venues.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
        </select>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search name, email, number or invoice")} aria-label={t("Search payments")} className={`${ui.input} h-10 w-full sm:w-[280px]`} />
      </div>
      <div className="mt-3 overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
        <table className={`${ui.table} min-w-[920px]`}>
          <thead><tr>
            <th className={ui.th}>{t("Event")}</th><th className={ui.th}>{t("Number")}</th><th className={ui.th}>{t("Person")}</th><th className={`${ui.th} text-right`}>{t("Amount")}</th>
            <th className={ui.th}>{t("Method")}</th><th className={ui.th}>{t("Status")}</th><th className={ui.th}>{t("Documents")}</th>
          </tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className={ui.td}><Link href={`/manage/${r.venue_slug}/payments`} className="font-medium text-[#2F5FD0]">{r.venue}</Link></td>
                <td className={`${ui.td} font-mono text-[13px]`}>{r.number}</td>
                <td className={ui.td}>{r.full_name ?? "—"}{r.email ? <span className="block text-[13px] text-[#4A5263]">{r.email}</span> : null}</td>
                <td className={`${ui.td} text-right font-mono`}>{money(r.amount_cents, r.currency)}</td>
                <td className={ui.td}>{r.payment_method ? t(METHOD[r.payment_method] ?? r.payment_method) : "—"}</td>
                <td className={ui.td}><span className={`${ui.tag} ${TONE[r.status]}`}>{t(LABEL[r.status])}</span><span className="block text-[12px] text-[#4A5263]">{r.paid_at ? t("on {date}", { date: day(r.paid_at) }) : t("registered {date}", { date: day(r.created_at) })}</span></td>
                <td className={`${ui.td} whitespace-nowrap text-[13px]`}>
                  {r.invoice_number ? <a href={`/venues/${r.venue_slug}/register/document?r=${r.id}&kind=invoice`} className="text-[#2F5FD0]">{t("Invoice")}</a> : null}
                  {r.invoice_number && r.status === "paid" ? " · " : null}
                  {r.status === "paid" ? <a href={`/venues/${r.venue_slug}/register/document?r=${r.id}&kind=receipt`} className="text-[#2F5FD0]">{t("Receipt")}</a> : null}
                  {!r.invoice_number && r.status !== "paid" ? "—" : null}
                </td>
              </tr>
            ))}
            {shown.length === 0 ? <tr><td colSpan={7} className={`${ui.td} text-center text-[#4A5263]`}>{t("No payments match.")}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Invoices */

function StatusButton({ id, status, label, tone }: { id: string; status: "paid" | "due" | "void"; label: string; tone?: "ok" | "muted" }) {
  const t = useT();
  const [s, act, pending] = useActionState(setPlatformInvoiceStatus, {});
  return (
    <form action={act} className="inline">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} />
      <button type="submit" disabled={pending} className={`cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold underline ${tone === "ok" ? "text-[#14603F]" : "text-[#4A5263]"}`}>{pending ? t("Saving…") : t(label)}</button>
      {s.error ? <span role="alert" className="ms-1 text-[12px] text-[#B3261E]">{t(s.error)}</span> : null}
    </form>
  );
}

function NewInvoice({ venues }: { venues: { id: string; name: string }[] }) {
  const t = useT();
  const [s, act, pending] = useActionState(createPlatformInvoice, {});
  return (
    <form action={act} className={`${ui.card} mt-6 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_120px_100px_110px_auto] md:items-end`}>
      <label className={ui.label}>{t("Event")}
        <select name="venue" required className={ui.input} defaultValue=""><option value="" disabled>{t("Choose an event")}</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
      </label>
      <label className={ui.label}>{t("For")}<input name="description" required maxLength={200} placeholder={t("e.g. Event fee, or 120 accepted papers × €4")} className={ui.input} /></label>
      <label className={ui.label}>{t("Amount")}<input name="amount" type="number" min={0} step="0.01" required className={ui.input} /></label>
      <label className={ui.label}>{t("Currency")}<input name="currency" defaultValue="EUR" maxLength={3} className={`${ui.input} uppercase`} /></label>
      <label className={ui.label}>{t("Due in (days)")}<input name="due" type="number" min={0} max={120} defaultValue={14} className={ui.input} /></label>
      <button type="submit" disabled={pending} className={ui.navy}>{pending ? t("Saving…") : t("Issue invoice")}</button>
      {s.error ? <p role="alert" className={`${ui.bad} md:col-span-6`}>{t(s.error)}</p> : null}
      {s.ok ? <p role="status" className={`${ui.ok} md:col-span-6`}>{t(s.ok)}</p> : null}
    </form>
  );
}

export function AdminInvoices({ rows, venues, today }: { rows: AdminInvoice[]; venues: { id: string; name: string }[]; today: string }) {
  const t = useT();
  const [filter, setFilter] = useState<"all" | "due" | "overdue" | "paid" | "void">("all");
  const [q, setQ] = useState("");
  const money = (c: number | null, cur: string) => fmtMoney(c, cur, t.intl);
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso)) : "—");
  const state = (i: AdminInvoice) => (i.status === "due" && i.due_on < today ? "overdue" : i.status);
  const count = (f: typeof filter) => (f === "all" ? rows.length : f === "due" ? rows.filter((i) => i.status === "due").length : rows.filter((i) => state(i) === f).length);
  const shown = rows.filter((i) => (filter === "all" || (filter === "due" ? i.status === "due" : state(i) === filter))
    && (!q.trim() || `${i.number} ${i.venue} ${i.description}`.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <div>
      <Head title="Invoices" sub="The platform's invoices to events: the event fee and the fee per accepted paper." />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className={ui.card}><p className={ui.kicker}>{t("Due")}</p><p className="m-0 mt-1 font-serif text-[26px] text-[#7A4508]">{totals(rows.filter((i) => i.status === "due"), (c, cur) => money(c, cur))}</p><p className={`${ui.hint} m-0`}>{t("{n} invoices", { n: count("due") })}</p></div>
        <div className={ui.card}><p className={ui.kicker}>{t("Overdue")}</p><p className="m-0 mt-1 font-serif text-[26px] text-[#8C1D18]">{totals(rows.filter((i) => state(i) === "overdue"), (c, cur) => money(c, cur))}</p><p className={`${ui.hint} m-0`}>{t("{n} invoices", { n: count("overdue") })}</p></div>
        <div className={ui.card}><p className={ui.kicker}>{t("Paid")}</p><p className="m-0 mt-1 font-serif text-[26px]">{totals(rows.filter((i) => i.status === "paid"), (c, cur) => money(c, cur))}</p><p className={`${ui.hint} m-0`}>{t("{n} invoices", { n: count("paid") })}</p></div>
      </div>
      <NewInvoice venues={venues} />
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["all", "due", "overdue", "paid", "void"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={chip(filter === f)}>{t(f === "all" ? "All" : LABEL[f])} <span className="ms-1 font-mono text-[12px] opacity-80">{count(f)}</span></button>
        ))}
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search number, event or description")} aria-label={t("Search invoices")} className={`${ui.input} ms-auto h-10 w-full sm:w-[280px]`} />
      </div>
      <div className="mt-3 overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
        <table className={`${ui.table} min-w-[960px]`}>
          <thead><tr>
            <th className={ui.th}>{t("Invoice")}</th><th className={ui.th}>{t("Event")}</th><th className={ui.th}>{t("For")}</th><th className={ui.th}>{t("Issued")}</th><th className={ui.th}>{t("Due")}</th>
            <th className={`${ui.th} text-right`}>{t("Amount")}</th><th className={ui.th}>{t("Status")}</th><th className={ui.th}>{t("Actions")}</th>
          </tr></thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.id}>
                <td className={`${ui.td} font-mono text-[13px]`}>{i.number}</td>
                <td className={ui.td}><Link href={`/manage/${i.venue_slug}/invoices`} className="font-medium text-[#2F5FD0]">{i.venue}</Link></td>
                <td className={ui.td}>{i.description}</td>
                <td className={ui.td}>{day(i.issued_on)}</td>
                <td className={ui.td}>{day(i.due_on)}</td>
                <td className={`${ui.td} text-right font-mono`}>{money(i.amount_cents, i.currency)}</td>
                <td className={ui.td}><span className={`${ui.tag} ${TONE[state(i)]}`}>{t(LABEL[state(i)])}</span>{i.paid_at ? <span className="block text-[12px] text-[#4A5263]">{t("on {date}", { date: day(i.paid_at) })}{i.method ? ` · ${t(METHOD[i.method] ?? i.method)}` : ""}</span> : null}</td>
                <td className={`${ui.td} whitespace-nowrap`}>
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    <a href={`/api/manage/${i.venue_slug}/invoices/${i.id}`} className="text-[13px] text-[#2F5FD0]">{t("PDF")}</a>
                    {i.status === "due" ? <StatusButton id={i.id} status="paid" label="Mark paid" tone="ok" /> : null}
                    {i.status === "due" ? <StatusButton id={i.id} status="void" label="Cancel" /> : null}
                    {i.status !== "due" ? <StatusButton id={i.id} status="due" label="Set as due" /> : null}
                  </span>
                </td>
              </tr>
            ))}
            {shown.length === 0 ? <tr><td colSpan={8} className={`${ui.td} text-center text-[#4A5263]`}>{t("No invoices match.")}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Payouts */

export function AdminPayouts() {
  const t = useT();
  return (
    <div>
      <Head title="Payouts" sub="What went to each event, once registration money is paid into the events' own Stripe accounts." />
      <section className={`${ui.card} mt-6`}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6EDFC] px-2.5 py-1 text-[13px] font-semibold text-[#1F47A8]"><Clock size={14} aria-hidden /> {t("Coming soon")}</span>
        <h2 className="mb-0 mt-4 text-[20px] font-semibold">{t("Payouts start with Stripe Connect")}</h2>
        <p className="mb-0 mt-1.5 max-w-[68ch] text-[15px] text-[#4A5263]">{t("Today registration payments go to one Stripe account. With Stripe Connect each event connects its own account, attendees pay the event directly, and this page lists each payout, the platform fee kept, and refunds.")}</p>
        <ul className="m-0 mt-3 list-disc ps-5 text-[15px]">
          <li>{t("Payouts per event, with dates and Stripe references")}</li>
          <li>{t("Platform fee kept on each registration")}</li>
          <li>{t("Refunds and disputes")}</li>
        </ul>
      </section>
    </div>
  );
}
