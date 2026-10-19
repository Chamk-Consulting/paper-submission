"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client";
import { reissueBadge, type AttendState } from "@/lib/attend/actions";

function Btn({ children, busy }: { children: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex h-9 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60">{pending ? busy : children}</button>;
}

/** Lost badge: issue a new QR (the old one stops working at the desk). */
export function ReissueBadge({ slug, id }: { slug: string; id: string }) {
  const t = useT();
  const [state, run] = useActionState<AttendState, FormData>(reissueBadge, {});
  return (
    <form action={run} onSubmit={(e) => { if (!window.confirm(t("Issue a new badge? The QR code on any printed badge stops working."))) e.preventDefault(); }} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
      <Btn busy={t("Issuing…")}>{t("Lost it? Issue a new badge")}</Btn>
      {state.info ? <span role="status" className="text-[13px] text-[#14603F]">{t(state.info)}</span> : null}
      {state.error ? <span role="alert" className="text-[13px] text-[#B3261E]">{t(state.error)}</span> : null}
    </form>
  );
}

export function PrintBadge() {
  const t = useT();
  return <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] print:hidden">{t("Print")}</button>;
}
