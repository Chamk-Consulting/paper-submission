"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { deleteDraft } from "@/lib/submission/actions";

/** "Delete draft" with an inline second click to confirm (no browser dialog). */
export function DeleteDraftButton({ id }: { id: string }) {
  const t = useT();
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!ask) return <button type="button" onClick={() => setAsk(true)} className="mt-2 border-0 bg-transparent p-0 text-[12px] font-semibold text-[#B3261E] underline">{t("Delete draft")}</button>;
  return (
    <div className="mt-2 text-[12px]">
      <p className="m-0 text-[#5C1A15]">{t("Delete this draft and its files? This can't be undone.")}</p>
      <div className="mt-1.5 flex gap-2">
        <button type="button" disabled={pending} onClick={() => start(async () => { const r = await deleteDraft(id); if (r?.error) setError(r.error); })}
          className="h-7 rounded-[4px] border-0 bg-[#B3261E] px-2.5 font-semibold text-white disabled:opacity-60">{pending ? t("Deleting…") : t("Delete")}</button>
        <button type="button" disabled={pending} onClick={() => { setAsk(false); setError(null); }} className="h-7 rounded-[4px] border border-[#B7BDC9] bg-white px-2.5">{t("Cancel")}</button>
      </div>
      {error ? <p role="alert" className="m-0 mt-1.5 text-[#B3261E]">{t(error)}</p> : null}
    </div>
  );
}
