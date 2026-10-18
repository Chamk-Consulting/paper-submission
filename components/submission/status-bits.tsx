"use client";

import { useActionState, useState } from "react";
import { fileUrl, withdrawPaper, type ActionState } from "@/lib/submission/actions";
import { useT } from "@/lib/i18n/client";

export function OpenFile({ path, children, className }: { path: string; children: React.ReactNode; className?: string }) {
  const t = useT();
  const [err, setErr] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => { const r = await fileUrl(path); if (r.url) window.open(r.url, "_blank", "noopener"); else setErr(true); }}>
      {err ? t("Couldn't open") : children}
    </button>
  );
}

export function WithdrawBox({ id }: { id: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(withdrawPaper, {});
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="h-11 w-full rounded-[4px] border border-[#F3C3BE] bg-white px-3.5 text-left text-[15px] text-[#B3261E] hover:bg-[#FDECEA]">{t("Withdraw paper")}</button>;
  return (
    <form action={action} className="rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] p-3 text-[14px] text-[#5C1A15]">
      <input type="hidden" name="submissionId" value={id} />
      <p className="m-0 font-semibold">{t("Withdraw this paper?")}</p>
      <p className="mt-1">{t("Reviewers and co-authors are told straight away. This can't be undone.")}</p>
      <label className="mt-2 block">{t("Type WITHDRAW to confirm")}<input name="confirm" autoComplete="off" className="mt-1 h-10 w-full rounded-[4px] border border-[#F3C3BE] bg-white px-2.5" /></label>
      {state.error ? <p role="alert" className="mt-1.5">{t(state.error)}</p> : null}
      <div className="mt-2.5 flex gap-2">
        <button type="submit" disabled={pending} className="h-10 rounded-[4px] bg-[#B3261E] px-3.5 font-semibold text-white">{pending ? t("Withdrawing…") : t("Withdraw")}</button>
        <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-[4px] border border-[#B7BDC9] bg-white px-3.5">{t("Keep it")}</button>
      </div>
    </form>
  );
}
