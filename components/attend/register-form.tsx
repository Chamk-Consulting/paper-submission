"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client";
import { registerAttendee, type AttendState } from "@/lib/attend/actions";
import { fmtMoney } from "@/lib/attend/money";
import type { RegistrationOptions } from "@/lib/attend/data";

/* RG01 — ticket, papers this registration covers, extras, invoice details, order summary + pay. */

export const card = "rounded-[8px] border border-[#DADDE3] bg-white px-6 py-5";
export const kicker = "m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]";
const label = "flex flex-col gap-1.5 text-[13px] font-semibold";
const input = "box-border h-10 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px] font-normal text-[#121826]";
const primary = "inline-flex h-[42px] w-full items-center justify-center rounded-[4px] border-0 bg-[#F2A93B] px-[18px] text-[15px] font-semibold text-[#0E1B3D] hover:bg-[#E89B26] disabled:opacity-60";
const ghost = "inline-flex h-[42px] w-full items-center justify-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60";

function Box({ on }: { on: boolean }) {
  return <span aria-hidden className={`flex size-5 flex-none items-center justify-center rounded-[3px] text-[13px] font-bold text-white ${on ? "bg-[#18744F]" : "border-[1.5px] border-[#8A93A6] bg-white"}`}>{on ? "✓" : ""}</span>;
}

function PayButtons({ cardReady, disabled }: { cardReady: boolean; disabled: boolean }) {
  const t = useT();
  const { pending, data } = useFormStatus();
  const which = data?.get("method");
  return (
    <div className="mt-3.5 flex flex-col gap-2">
      <button type="submit" name="method" value="card" disabled={!cardReady || disabled || pending} className={primary} title={cardReady ? undefined : t("Card payment isn't set up for this event yet")}>
        {pending && which === "card" ? t("Opening secure payment…") : t("Pay by card")}
      </button>
      {!cardReady ? <p className="m-0 text-[12px] text-[#4A5263]">{t("Card payment isn't set up for this event yet")}</p> : null}
      <button type="submit" name="method" value="invoice" disabled={disabled || pending} className={ghost}>
        {pending && which === "invoice" ? t("Saving…") : t("Bank transfer — send me an invoice")}
      </button>
    </div>
  );
}

export function RegisterForm({ slug, venueId, opts, cardReady }: { slug: string; venueId: string; opts: RegistrationOptions; cardReady: boolean }) {
  const t = useT();
  const [state, action] = useActionState<AttendState, FormData>(registerAttendee, {});
  const sellable = opts.tickets.filter((x) => x.price_cents !== null);
  const [ticket, setTicket] = useState<number>(sellable[0]?.index ?? 0);
  const free = opts.papers.filter((p) => !p.covered_by);
  const [papers, setPapers] = useState<string[]>(free.slice(0, opts.papers_per_registration).map((p) => p.id));
  const [extras, setExtras] = useState<Record<number, number>>({});
  const cur = opts.tickets.find((x) => x.index === ticket) ?? null;
  const covers = cur?.covers ?? 0;
  const chosen = papers.filter((id) => free.some((p) => p.id === id)).slice(0, covers);
  const money = (c: number | null) => fmtMoney(c, opts.currency, t.intl);
  const total = (cur?.price_cents ?? 0) + opts.extras.reduce((sum, e) => sum + (e.price_cents ?? 0) * (extras[e.index] ?? 0), 0);
  const uncovered = free.filter((p) => !chosen.includes(p.id));
  const f = state.fieldErrors ?? {};

  return (
    <form action={action} className="mt-6 flex flex-col items-start gap-6 lg:flex-row">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="ticket" value={ticket || ""} />
      {chosen.map((id) => <input key={id} type="hidden" name="paper" value={id} />)}
      {opts.extras.filter((e) => (extras[e.index] ?? 0) > 0).map((e) => (
        <span key={e.index}><input type="hidden" name="extra" value={e.index} /><input type="hidden" name={`qty_${e.index}`} value={extras[e.index]} /></span>
      ))}

      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-[18px]">
        <section className={card}>
          <p className={kicker}>{t("1 · Ticket")}</p>
          {sellable.length === 0 ? <p className="mb-0 mt-3 rounded-[6px] bg-[#FBEFDD] px-3 py-2 text-[14px] text-[#7A4508]">{t("The organizers haven't published prices yet. Registration opens when they do.")}</p> : null}
          <div role="radiogroup" aria-label={t("Ticket")} className="mt-3 flex flex-col gap-2">
            {opts.tickets.map((tk) => {
              const on = tk.index === ticket, off = tk.price_cents === null;
              return (
                <button key={tk.index} type="button" role="radio" aria-checked={on} disabled={off} onClick={() => setTicket(tk.index)}
                  className={`flex items-start gap-3 rounded-[6px] border px-3.5 py-3 text-left text-[#121826] disabled:cursor-not-allowed disabled:opacity-60 ${on ? "border-[#2F5FD0] bg-[#FBFCFF]" : "border-[#DADDE3] bg-white"}`}>
                  <span aria-hidden className={`mt-0.5 box-border size-[18px] flex-none rounded-full ${on ? "border-[6px] border-[#2F5FD0]" : "border-[1.5px] border-[#8A93A6]"}`} />
                  <span className="flex-auto text-[14px]"><strong>{t(tk.name)}</strong>
                    <span className="block text-[13px] text-[#4A5263]">{tk.covers === 0 ? t("Does not cover papers") : t("Covers up to {n} paper(s)", { n: tk.covers })}
                      {opts.is_early && tk.early_cents !== null && tk.late_cents !== null && tk.late_cents !== tk.early_cents ? ` · ${t("then {p}", { p: money(tk.late_cents) })}` : ""}</span></span>
                  <span className="font-mono text-[14px] font-semibold">{off ? t("Price not set") : money(tk.price_cents)}</span>
                </button>
              );
            })}
          </div>
          {f.ticket ? <p role="alert" className="mb-0 mt-2 text-[13px] text-[#B3261E]">{t(f.ticket)}</p> : null}
        </section>

        <section className={card}>
          <p className={kicker}>{t("2 · Papers this registration covers")}</p>
          <p className="mb-0 mt-1.5 text-[13px] text-[#4A5263]">{t("Every accepted paper needs one author with a full registration (rule G4). Student and one-day tickets don't cover papers.")}</p>
          {opts.papers.length === 0 ? <p className="mb-0 mt-3 text-[14px] text-[#4A5263]">{t("You have no accepted papers at this event — you can still register to attend.")}</p> : (
            <div className="mt-3 flex flex-col gap-2">
              {opts.papers.map((p) => {
                const on = chosen.includes(p.id), taken = !!p.covered_by, full = !on && chosen.length >= covers;
                const disabled = taken || covers === 0 || full;
                return (
                  <button key={p.id} type="button" role="checkbox" aria-checked={on} disabled={disabled}
                    onClick={() => setPapers((xs) => (xs.includes(p.id) ? xs.filter((x) => x !== p.id) : [...xs.filter((x) => chosen.includes(x)), p.id]))}
                    className={`flex w-full items-start gap-3 rounded-[6px] border px-3.5 py-3 text-left text-[#121826] disabled:cursor-not-allowed ${on ? "border-[#B9E0CB] bg-[#F3FAF6]" : "border-[#DADDE3] bg-white"} ${taken ? "opacity-70" : ""}`}>
                    <Box on={on} />
                    <span className="text-[14px]"><strong>#{String(p.number).padStart(4, "0")}</strong> {p.title}
                      <span className="block text-[13px] text-[#4A5263]">
                        {taken ? t("Already covered by {n}", { n: p.covered_by ?? "" }) : p.presenter ? t("{name} presents", { name: p.presenter }) : t("Not yet covered by anyone")}
                      </span></span>
                  </button>
                );
              })}
            </div>
          )}
          {covers === 0 && uncovered.length ? (
            <p role="alert" className="mb-0 mt-2.5 rounded-[6px] bg-[#FBEFDD] px-2.5 py-2 text-[13px] text-[#7A4508]">
              {t("This ticket doesn't cover papers. {list} still needs a full registration from one of its authors.", { list: uncovered.map((p) => `#${String(p.number).padStart(4, "0")}`).join(", ") })}
            </p>
          ) : null}
        </section>

        {opts.extras.length ? (
          <section className={card}>
            <p className={kicker}>{t("3 · Extras")}</p>
            <div className="mt-3 flex flex-col gap-2">
              {opts.extras.map((e) => {
                const q = extras[e.index] ?? 0, off = e.price_cents === null;
                return (
                  <div key={e.index} className={`flex items-center gap-3 rounded-[6px] border px-3.5 py-2.5 ${q ? "border-[#B9E0CB] bg-[#F3FAF6]" : "border-[#DADDE3] bg-white"}`}>
                    <button type="button" role="checkbox" aria-checked={q > 0} disabled={off} aria-label={t(e.name)} onClick={() => setExtras((x) => ({ ...x, [e.index]: q ? 0 : 1 }))} className="flex border-0 bg-transparent p-0 disabled:opacity-50"><Box on={q > 0} /></button>
                    <span className="flex-auto text-[14px]">{t(e.name)}</span>
                    {q > 0 ? (
                      <label className="flex items-center gap-1.5 text-[13px] text-[#4A5263]">{t("Qty")}
                        <input type="number" min={1} max={10} value={q} onChange={(ev) => setExtras((x) => ({ ...x, [e.index]: Math.max(1, Math.min(10, Number(ev.target.value) || 1)) }))} className="h-8 w-14 rounded-[4px] border border-[#B7BDC9] px-2 text-[14px]" />
                      </label>
                    ) : null}
                    <span className="font-mono text-[14px]">{off ? t("Price not set") : money(e.price_cents)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className={card}>
          <p className={kicker}>{opts.extras.length ? t("4 · Invoice details") : t("3 · Invoice details")}</p>
          <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
            <label className={label}>{t("Invoice to")}<input name="billing_name" defaultValue={opts.me?.affiliation ?? opts.me?.name ?? ""} maxLength={200} className={input} /></label>
            <label className={label}>{t("VAT number (optional)")}<input name="billing_vat" placeholder={t("e.g. DE123456789")} maxLength={40} className={input} /></label>
            <label className={`${label} sm:col-span-2`}>{t("Billing address")}<input name="billing_address" placeholder={t("Street, postcode, city, country")} maxLength={400} className={input} /></label>
            <label className={label}>{t("Purchase order (optional)")}<input name="billing_po" maxLength={60} className={input} /></label>
            <label className={label}>{t("Send invoice to")}<input name="billing_email" type="email" defaultValue={opts.me?.email ?? ""} maxLength={254} className={input} />
              {f.billing_email ? <span className="text-[12px] font-normal text-[#B3261E]">{t(f.billing_email)}</span> : null}</label>
          </div>
        </section>
      </div>

      <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-4 lg:w-auto lg:flex-[1_1_300px]">
        <section className={card}>
          <p className={kicker}>{t("Order summary")}</p>
          <div className="mt-2.5 flex flex-col gap-1.5 text-[14px]">
            <div className="flex justify-between gap-2"><span>{cur ? t(cur.name) : t("Choose a ticket")}</span><span className="font-mono">{cur ? money(cur.price_cents) : "—"}</span></div>
            {opts.extras.filter((e) => (extras[e.index] ?? 0) > 0).map((e) => (
              <div key={e.index} className="flex justify-between gap-2"><span>{t(e.name)}{(extras[e.index] ?? 0) > 1 ? ` × ${extras[e.index]}` : ""}</span><span className="font-mono">{money((e.price_cents ?? 0) * (extras[e.index] ?? 0))}</span></div>
            ))}
            <div className="flex justify-between border-t border-[#EEF0EC] pt-2 font-bold"><span>{t("Total")}</span><span className="font-mono">{money(total)}</span></div>
          </div>
          <p className="mb-0 mt-2.5 text-[13px] text-[#4A5263]">{t("Covers: {list}", { list: chosen.length ? chosen.map((id) => `#${String(opts.papers.find((p) => p.id === id)?.number ?? 0).padStart(4, "0")}`).join(", ") : t("no papers") })}</p>
          <PayButtons cardReady={cardReady} disabled={!cur || cur.price_cents === null} />
          {state.error ? <p role="alert" className="mb-0 mt-2.5 text-[13px] text-[#B3261E]">{t(state.error)}</p> : null}
          <p className="mb-0 mt-2.5 text-[12px] text-[#4A5263]">{t("Prices include no VAT unless the organizers say so. Your registration is reserved now and confirmed when the payment arrives.")}</p>
        </section>
      </aside>
    </form>
  );
}
