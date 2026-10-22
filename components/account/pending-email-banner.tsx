"use client";

import { useState, useTransition } from "react";
import { cancelEmailChange, resendEmailChange } from "@/lib/account/security-actions";
import { useT } from "@/lib/i18n/client";

/** Plan C3: shown on Sign-in & security until the new sign-in email is confirmed. */
export function PendingEmailBanner({ email }: { email: string }) {
  const t = useT();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  if (gone) return msg ? <p role="status" className="mb-4 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3.5 py-2.5 text-[14px] text-[#14603F]">{t(msg.text)}</p> : null;
  const run = (fn: typeof resendEmailChange, cancel = false) =>
    start(async () => {
      const r = await fn();
      if (r.error) return setMsg({ text: r.error, bad: true });
      setMsg({ text: r.info ?? "Done." });
      if (cancel) setGone(true);
    });
  return (
    <div role="status" className="mb-4 rounded-[8px] border border-[#F1D29A] bg-[#FFF6E6] px-4 py-3.5 text-[14px] text-[#3B2A07]">
      <p className="m-0 font-semibold">{t("Email change waiting for confirmation")}</p>
      <p className="m-0 mt-1">{t("Your sign-in email changes to {email} once you confirm from both inboxes. Until then you keep signing in with your current email.", { email })}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => run(resendEmailChange)} className="h-9 rounded-[4px] border-0 bg-[#0E1B3D] px-3.5 text-[14px] font-semibold text-white disabled:opacity-60">{t("Resend")}</button>
        <button type="button" disabled={pending} onClick={() => run(cancelEmailChange, true)} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-medium text-[#121826] disabled:opacity-60">{t("Cancel change")}</button>
      </div>
      {msg ? <p role={msg.bad ? "alert" : "status"} className={`m-0 mt-2 text-[13px] ${msg.bad ? "text-[#B3261E]" : "text-[#14603F]"}`}>{t(msg.text)}</p> : null}
    </div>
  );
}
