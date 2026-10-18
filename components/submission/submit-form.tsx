"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitPaper, type ActionState } from "@/lib/submission/actions";
import { card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";

export function SubmitForm({ id, ready, resubmit }: { id: string; ready: boolean; resubmit: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitPaper, {});
  const [a, setA] = useState(false), [b, setB] = useState(false);
  const [tried, setTried] = useState(false);
  return (
    <form action={action} onSubmit={(e) => { if (!a || !b) { e.preventDefault(); setTried(true); } }}>
      <input type="hidden" name="submissionId" value={id} />
      <section className={`${card} mt-6`}>
        <h2 className={h2}>Confirm</h2>
        <label className="mt-4 flex items-start gap-3"><input type="checkbox" name="agree" checked={a} onChange={(e) => setA(e.target.checked)} className="mt-1 size-[18px] flex-none accent-[#0E1B3D]" /><span>All authors agree to this submission and its author order. <span className="text-[#B3261E]">*</span></span></label>
        <label className="mt-3 flex items-start gap-3"><input type="checkbox" name="present" checked={b} onChange={(e) => setB(e.target.checked)} className="mt-1 size-[18px] flex-none accent-[#0E1B3D]" /><span>If accepted, one author will register and present the paper. <span className="text-[#B3261E]">*</span></span></label>
        {tried && (!a || !b) ? <p role="alert" className="mt-2 text-[13px] text-[#B3261E]">Tick both boxes to submit.</p> : null}
        <p className="mt-4 text-[14px] text-[#4A5263]">You can still replace the PDF and edit details until the deadline. After that, the paper is locked for review.</p>
      </section>
      {state.error ? <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{state.error}</p> : null}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] pt-6">
        <div className="flex gap-2">
          <Link href={`/submissions/${id}/conflicts`} className={ghostBtn}>← Back</Link>
          <Link href="/workspace/submissions" className={`${ghostBtn} hidden sm:inline-flex`}>Save draft and exit</Link>
        </div>
        <button type="submit" disabled={pending || !ready} className={primaryBtn}>{pending ? "Submitting…" : resubmit ? "Save changes" : "Submit paper"}</button>
      </div>
    </form>
  );
}
