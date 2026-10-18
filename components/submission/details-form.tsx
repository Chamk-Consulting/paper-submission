"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveDetails, type ActionState } from "@/lib/submission/actions";
import { card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";

const wc = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** SB02: title, abstract, short title, declarations. */
export function DetailsForm({ id, typeLine, initial }: { id: string; typeLine: string; initial: { title: string; abstract: string; shortTitle: string; original: boolean; preprint: boolean; studentAward: boolean } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveDetails, {});
  const [title, setTitle] = useState(initial.title === "Untitled paper" ? "" : initial.title);
  const [abstract, setAbstract] = useState(initial.abstract);
  const fe = state.fieldErrors ?? {};
  const words = wc(abstract);
  const input = "w-full rounded-[4px] bg-white px-3.5 py-3 text-[17px] text-[#121826] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]";
  const border = (bad: boolean) => ({ border: bad ? "2px solid #B3261E" : "1px solid #B7BDC9" });

  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      <section className={card}>
        <h2 className={h2}>Paper details</h2>
        <p className="mt-1 text-[#4A5263]">{typeLine} · <Link href={`/submissions/${id}/type`} className="text-[#2F5FD0] underline">Change</Link></p>

        <div className="mt-5 flex items-baseline justify-between"><label htmlFor="sb2-title" className="font-medium">Title <span className="text-[#B3261E]">*</span></label><span className="font-mono text-[12px] text-[#4A5263]">{title.length} / 200</span></div>
        <textarea id="sb2-title" name="title" rows={2} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!fe.title || undefined} className={`${input} mt-1.5 resize-y`} style={border(!!fe.title)} />
        <p className={`mt-1 text-[14px] ${fe.title ? "text-[#B3261E]" : "text-[#4A5263]"}`}>{fe.title ?? "Exactly as on the PDF. Sentence case."}</p>

        <div className="mt-5 flex items-baseline justify-between"><label htmlFor="sb2-abs" className="font-medium">Abstract <span className="text-[#B3261E]">*</span></label><span className="font-mono text-[12px]" style={{ color: words > 250 ? "#B3261E" : "#4A5263" }}>{words} / 250 words</span></div>
        <textarea id="sb2-abs" name="abstract" rows={9} value={abstract} onChange={(e) => setAbstract(e.target.value)} aria-invalid={!!fe.abstract || words > 250 || undefined} className={`${input} mt-1.5 resize-y text-[16px] leading-[1.6]`} style={border(!!fe.abstract || words > 250)} />
        <div aria-hidden className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-[#EEF0EC]"><div className="h-1" style={{ width: `${Math.min(100, (words / 250) * 100)}%`, background: words > 250 ? "#B3261E" : "#0E1B3D" }} /></div>
        <p className={`mt-1 text-[14px] ${fe.abstract ? "text-[#B3261E]" : "text-[#4A5263]"}`}>{fe.abstract ?? "Plain text. 250 words at most."}</p>

        <label htmlFor="sb2-short" className="mt-5 block font-medium">Short title for the program <span className="font-normal text-[#4A5263]">(optional)</span></label>
        <input id="sb2-short" name="shortTitle" maxLength={120} defaultValue={initial.shortTitle} placeholder="Shown in session listings if your title is long" className={`${input} mt-1.5 h-12 py-0 text-[16px]`} style={border(false)} />
      </section>

      <section className={`${card} mt-6`}>
        <h2 className={h2}>Declarations</h2>
        <label className="mt-4 flex items-start gap-3">
          <input type="checkbox" name="original" defaultChecked={initial.original} aria-invalid={!!fe.original || undefined} className="mt-1 size-[18px] flex-none accent-[#0E1B3D]" />
          <span>This paper is not published or under review elsewhere. <Link href={`/submissions/${id}/review#policies`} className="text-[#2F5FD0] underline">Dual submission policy</Link> <span className="text-[#B3261E]">*</span></span>
        </label>
        {fe.original ? <p className="ml-7 mt-1 text-[13px] text-[#B3261E]">{fe.original}</p> : null}
        <label className="mt-3 flex items-start gap-3">
          <input type="checkbox" name="preprint" defaultChecked={initial.preprint} className="mt-1 size-[18px] flex-none accent-[#0E1B3D]" />
          <span>An earlier version is on a preprint server (e.g. arXiv). <span className="text-[#4A5263]">Allowed — don&apos;t link it in the PDF.</span></span>
        </label>
        <label className="mt-3 flex items-start gap-3">
          <input type="checkbox" name="studentAward" defaultChecked={initial.studentAward} className="mt-1 size-[18px] flex-none accent-[#0E1B3D]" />
          <span>I&apos;d like to be considered for the <strong>Best Student Paper</strong> award. <span className="text-[#4A5263]">The first author must be a student.</span></span>
        </label>
      </section>

      {state.error ? <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{state.error}</p> : null}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] pt-6">
        <div className="flex gap-2">
          <Link href={`/submissions/${id}/type`} className={ghostBtn}>← Back</Link>
          <button type="submit" name="intent" value="exit" className={`${ghostBtn} hidden sm:inline-flex`}>Save and exit</button>
        </div>
        <button type="submit" name="intent" value="next" disabled={pending} className={primaryBtn}>{pending ? "Saving…" : "Continue to authors →"}</button>
      </div>
    </form>
  );
}
