"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { setOrcid } from "@/lib/review/actions";
import { ui } from "@/components/manage/ui";

/** RV04 "Get credit" — review_assignments.orcid_push. */
export function OrcidToggle({ id, initial }: { id: string; initial: boolean }) {
  const t = useT();
  const [on, setOn] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <label className={`flex cursor-pointer items-start gap-3 rounded-[6px] border px-3.5 py-3 ${on ? "border-[#B9E0CB] bg-[#F3FAF6]" : "border-[#DADDE3] bg-white"}`}>
        <input type="checkbox" checked={on} disabled={pending} className="mt-1 size-4 accent-[#18744F]"
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next); setErr(null);
            start(async () => { const r = await setOrcid(id, next); if (r.error) { setOn(!next); setErr(r.error); } });
          }} />
        <span>
          <span className="block text-[15px] font-medium">{t("Add this review to my ORCID record")}</span>
          <span className="block text-[13px] text-[#4A5263]">{t("Shows the venue and year only — never the paper.")}</span>
        </span>
      </label>
      {err ? <p role="alert" className="mb-0 mt-1.5 text-[13px] text-[#B3261E]">{t(err)}</p> : null}
    </div>
  );
}

export function PrintButton({ label }: { label: string }) {
  return <button type="button" onClick={() => window.print()} className={ui.ghost}>{label}</button>;
}
