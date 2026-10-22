"use client";

import Link from "@/components/site/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client";
import { cancelMyRegistration, payByCard, type AttendState } from "@/lib/attend/actions";
import { fmtMoney } from "@/lib/attend/money";
import type { MyRegistration } from "@/lib/attend/data";

/* RG01 after registering: confirmation, documents, badge, pay by card / cancel while unpaid. */

const btn = "inline-flex h-10 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#F7F8F6] disabled:opacity-60";
const primary = "inline-flex h-10 items-center rounded-[4px] border-0 bg-[#F2A93B] px-[18px] text-[14px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26] disabled:opacity-60";

function Pending({ label, busy, className }: { label: string; busy: string; className: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={className}>{pending ? busy : label}</button>;
}

export function RegisterStatus({ slug, reg, justDone, cardReady, cardNote }: { slug: string; reg: MyRegistration; justDone: boolean; cardReady: boolean; cardNote: string | null }) {
  const t = useT();
  const [payState, pay] = useActionState<AttendState, FormData>(payByCard, {});
  const [cancelState, cancel] = useActionState<AttendState, FormData>(cancelMyRegistration, {});
  const paid = !!reg.paid_at;
  const no = (n: number) => `#${String(n).padStart(4, "0")}`;
  const doc = (kind: "invoice" | "receipt") => `/venues/${slug}/register/document?r=${reg.id}&kind=${kind}`;
  return (
    <section className="mt-6 max-w-[760px] rounded-[8px] border border-[#DADDE3] bg-white p-7">
      <div className="flex items-start gap-3.5">
        <span aria-hidden className={`flex size-10 flex-none items-center justify-center rounded-full font-bold ${paid ? "bg-[#E1F3EA] text-[#14603F]" : "bg-[#FBEFDD] text-[#7A4508]"}`}>{paid ? "✓" : "…"}</span>
        <div className="min-w-0">
          <h2 className="m-0 font-serif text-[30px] font-normal leading-[1.15]">{paid ? (justDone ? t("You're registered") : t("Your registration")) : t("Registration reserved — payment pending")}</h2>
          <p className="mb-0 mt-1 text-[#4A5263]">
            {t("Registration")} <strong className="font-mono text-[#121826]">{reg.number}</strong> · {t(reg.reg_type)} · {t("covers {list}", { list: reg.papers.length ? reg.papers.map(no).join(", ") : t("no papers") })}
          </p>
        </div>
      </div>

      <dl className="mb-0 mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[14px]">
        <dt className="text-[#4A5263]">{t("Total")}</dt><dd className="m-0 font-mono">{reg.currency ? fmtMoney(reg.amount_cents, reg.currency, t.intl) : "—"}</dd>
        <dt className="text-[#4A5263]">{t("Status")}</dt>
        <dd className="m-0"><span className={`rounded-[3px] px-2 py-0.5 font-mono text-[11px] ${paid ? "bg-[#E1F3EA] text-[#14603F]" : "bg-[#FBEFDD] text-[#7A4508]"}`}>{paid ? t("PAID") : t("AWAITING PAYMENT")}</span></dd>
        {reg.invoice_number ? <><dt className="text-[#4A5263]">{t("Invoice")}</dt><dd className="m-0 font-mono">{reg.invoice_number}</dd></> : null}
        {reg.checked_in_at ? <><dt className="text-[#4A5263]">{t("Checked in")}</dt><dd className="m-0">✓</dd></> : null}
      </dl>
      {!paid ? <p className="mb-0 mt-3 rounded-[6px] bg-[#F7F8F6] px-3 py-2 text-[14px]">{t("Pay by bank transfer quoting {inv}, or by card if offered. Your papers count as registered once the payment arrives.", { inv: reg.invoice_number ?? reg.number })}</p> : null}
      {cardNote ? <p role="status" className="mb-0 mt-3 rounded-[6px] bg-[#E6EDFC] px-3 py-2 text-[14px] text-[#1F2E5C]">{t(cardNote)}</p> : null}

      <div className="mt-[18px] flex flex-wrap gap-2.5">
        {reg.invoice_number ? <a href={doc("invoice")} className={btn}>{t("Download invoice (PDF)")}</a> : null}
        {paid ? <a href={doc("receipt")} className={btn}>{t("Download receipt (PDF)")}</a> : null}
        <Link href={`/venues/${slug}/badge`} className={primary}>{t("See my badge")}</Link>
      </div>

      {!paid ? (
        <div className="mt-4 flex flex-wrap items-start gap-2.5 border-t border-[#EEF0EC] pt-4">
          {cardReady ? (
            <form action={pay}><input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={reg.id} />
              <Pending label={t("Pay by card now")} busy={t("Opening secure payment…")} className={primary} /></form>
          ) : null}
          <form action={cancel} onSubmit={(e) => { if (!window.confirm(t("Cancel registration {n}? Papers it covers become free for a co-author to register.", { n: reg.number }))) e.preventDefault(); }}>
            <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={reg.id} />
            <Pending label={t("Cancel registration")} busy={t("Cancelling…")} className={`${btn} border-[#F3C3BE]! text-[#B3261E]!`} />
          </form>
          {payState.error ? <p role="alert" className="m-0 w-full text-[13px] text-[#B3261E]">{t(payState.error)}</p> : null}
          {cancelState.error ? <p role="alert" className="m-0 w-full text-[13px] text-[#B3261E]">{t(cancelState.error)}</p> : null}
        </div>
      ) : null}
      {reg.papers.length ? <p className="mb-0 mt-4 text-[14px] text-[#4A5263]">{t("The final-version checklist of the papers it covers shows registration ✓ once paid.")}</p> : null}
    </section>
  );
}
