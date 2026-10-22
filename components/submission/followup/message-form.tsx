"use client";

import Link from "@/components/site/link";
import { useActionState } from "react";
import { messageChairs } from "@/lib/submission/message-actions";
import type { ActionState } from "@/lib/submission/actions";
import { ghostBtn, primaryBtn } from "@/components/submission/shell";
import { ErrorBox } from "@/components/submission/followup/bits";
import { useT } from "@/lib/i18n/client";

const field = "box-border w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[15px] text-[#121826] outline-none focus:border-[#2F5FD0] focus:shadow-[0_0_0_3px_rgba(47,95,208,.18)]";

export function MessageChairForm({ id, defaultSubject }: { id: string; defaultSubject: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(messageChairs, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="submissionId" value={id} />
      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        {t("Subject")}
        <input name="subject" defaultValue={defaultSubject} maxLength={300} className={`${field} h-11`} />
      </label>
      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        {t("Message")}
        <textarea name="body" required rows={8} maxLength={8000} aria-invalid={!!state.fieldErrors?.body} placeholder={t("Write your question. The chairs reply in your Plenary inbox.")} className={`${field} py-2.5 font-normal leading-[1.55]`} />
        {state.fieldErrors?.body ? <span className="text-[13px] font-normal text-[#B3261E]">{t(state.fieldErrors.body)}</span> : null}
      </label>
      <ErrorBox msg={state.error} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryBtn}>{pending ? t("Sending…") : t("Send message")}</button>
        <Link href={`/submissions/${id}`} className={ghostBtn}>{t("Cancel")}</Link>
      </div>
    </form>
  );
}
