"use client";

import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { messageChairs } from "@/lib/submission/message-actions";
import type { ActionState } from "@/lib/submission/actions";
import { ghostBtn, primaryBtn } from "@/components/submission/shell";
import { ErrorBox } from "@/components/submission/followup/bits";
import { useT } from "@/lib/i18n/client";
import { RichTextEditor } from "@/components/rich-text/editor";

const field = "box-border w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[15px] text-[#121826] outline-none focus:border-[#2F5FD0] focus:shadow-[0_0_0_3px_rgba(47,95,208,.18)]";

export function MessageChairForm({ id, defaultSubject }: { id: string; defaultSubject: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(messageChairs, {});
  const [body, setBody] = useState("");
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="submissionId" value={id} />
      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        {t("Subject")}
        <input name="subject" defaultValue={defaultSubject} maxLength={300} className={`${field} h-11`} />
      </label>
      <div className="flex flex-col gap-1.5 text-[14px]">
        <span id="msg-body-l" className="font-semibold">{t("Message")}</span>
        <RichTextEditor mode="full" name="body" id="msg-body" value={body} onChange={setBody} maxLength={8000} minRows={8} labelledBy="msg-body-l" invalid={!!state.fieldErrors?.body}
          placeholder={t("Write your question. The chairs reply in your Plenary inbox.")} />
        {state.fieldErrors?.body ? <span className="text-[13px] font-normal text-[#B3261E]">{t(state.fieldErrors.body)}</span> : null}
      </div>
      <ErrorBox msg={state.error} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryBtn}>{pending ? t("Sending…") : t("Send message")}</button>
        <Link href={`/submissions/${id}`} className={ghostBtn}>{t("Cancel")}</Link>
      </div>
    </form>
  );
}
