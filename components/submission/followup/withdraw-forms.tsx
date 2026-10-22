"use client";

import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { confirmWithdraw, startWithdraw } from "@/lib/submission/followup-actions";
import type { ActionState } from "@/lib/submission/actions";
import { card, ghostBtn, h2 } from "@/components/submission/shell";
import { ErrorBox, FieldError } from "@/components/submission/followup/bits";
import { useT } from "@/lib/i18n/client";

import { WITHDRAW_REASONS } from "@/lib/submission/followup-shared";

const dangerBtn = "inline-flex h-12 items-center justify-center rounded-[4px] border-0 bg-[#B3261E] px-5 text-[16px] font-semibold text-white hover:bg-[#9A1F18] disabled:opacity-60";

export function WithdrawReasonForm({ id, reason: initial, note }: { id: string; reason?: string; note?: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(startWithdraw, {});
  const [reason, setReason] = useState(initial ?? "");
  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      <div role="note" className="flex gap-3 rounded-[8px] border border-[#F3C3BE] bg-[#FDECEA] px-4 py-3.5 text-[15px] text-[#5C1A15]">
        <span aria-hidden className="flex size-6 flex-none items-center justify-center rounded-full bg-[#B3261E] text-[13px] font-bold text-white">!</span>
        <p className="m-0"><strong>{t("Withdrawing can't be undone.")}</strong> {t("The paper leaves review at once. To submit again you would start a new submission, which is not possible after the deadline.")}</p>
      </div>
      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("Why are you withdrawing?")}</h2>
        <p className="mt-1 text-[#4A5263]">{t("The reason goes to the program chair and your co-authors. It is not shown to reviewers.")}</p>
        <fieldset className="m-0 mt-4 border-0 p-0">
          <legend className="sr-only">{t("Reason")}</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {WITHDRAW_REASONS.map(([k, label]) => {
              const on = reason === k;
              return (
                <label key={k} className={`inline-flex h-10 cursor-pointer items-center rounded-full border px-4 text-[15px] ${on ? "border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#4A5263] hover:border-[#B7BDC9]"}`}>
                  <input type="radio" name="reason" value={k} checked={on} onChange={() => setReason(k)} className="sr-only" />{t(label)}
                </label>
              );
            })}
          </div>
        </fieldset>
        <FieldError msg={state.fieldErrors?.reason} />
        <label htmlFor="wd-n" className="mt-5 block font-semibold">{t("Note to the program chair (optional)")}</label>
        <textarea id="wd-n" name="note" rows={3} maxLength={1000} defaultValue={note} className="mt-1.5 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 py-2.5 text-[15px]" />
        <ErrorBox msg={state.error} />
      </section>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/submissions/${id}`} className={ghostBtn}>← {t("Keep my paper")}</Link>
        <button type="submit" disabled={pending} className="inline-flex h-12 items-center justify-center rounded-[4px] bg-[#0E1B3D] px-5 text-[16px] font-semibold text-white disabled:opacity-60">{pending ? t("Saving…") : `${t("Continue")} →`}</button>
      </div>
    </form>
  );
}

export function WithdrawConfirmForm({ id, reason, note, number }: { id: string; reason: string; note: string; number: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(confirmWithdraw, {});
  const [a1, setA1] = useState(false);
  const [a2, setA2] = useState(false);
  const fe = state.fieldErrors ?? {};
  const box = "mt-0.5 size-5 flex-none accent-[#0E1B3D]";
  return (
    <form action={action} className="mt-5">
      <input type="hidden" name="submissionId" value={id} />
      <input type="hidden" name="reason" value={reason} />
      <input type="hidden" name="note" value={note} />
      <label className="flex gap-3 py-2 text-[15px]"><input type="checkbox" name="understand" checked={a1} onChange={(e) => setA1(e.target.checked)} className={box} />{t("I understand this cannot be undone")}</label>
      <FieldError msg={fe.understand} />
      <label className="flex gap-3 py-2 text-[15px]"><input type="checkbox" name="agree" checked={a2} onChange={(e) => setA2(e.target.checked)} className={box} />{t("My co-authors agree to withdraw this paper")}</label>
      <FieldError msg={fe.agree} />
      <label htmlFor="wd-c" className="mt-4 block font-semibold">{t("Type the paper ID {no} to confirm", { no: number })}</label>
      <input id="wd-c" name="typed" type="text" inputMode="numeric" autoComplete="off" className="mt-1.5 h-12 w-full max-w-[220px] rounded-[4px] border border-[#B7BDC9] bg-white px-3 font-mono text-[17px] tracking-[0.1em]" />
      <FieldError msg={fe.typed} />
      <ErrorBox msg={state.error} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/submissions/${id}/withdraw?reason=${reason}${note ? `&note=${encodeURIComponent(note)}` : ""}`} className={ghostBtn}>← {t("Back")}</Link>
        <button type="submit" disabled={pending} className={dangerBtn}>{pending ? t("Withdrawing…") : t("Withdraw paper #{no}", { no: number })}</button>
      </div>
    </form>
  );
}
