"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveKeywords, type ActionState } from "@/lib/submission/actions";
import { card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";

/** SB04: pick 3–5 venue keywords (first = main), plus optional own keywords. */
export function KeywordsForm({ id, venueName, groups, initial, own }: { id: string; venueName: string; groups: { group: string; keywords: string[] }[]; initial: string[]; own: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveKeywords, {});
  const [picked, setPicked] = useState<string[]>(initial);
  const [q, setQ] = useState("");
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= 5 ? p : [...p, k]));
  const makeMain = (k: string) => setPicked((p) => [k, ...p.filter((x) => x !== k)]);
  const needle = q.trim().toLowerCase();
  const err = state.fieldErrors?.keywords;

  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      {picked.map((k) => <input key={k} type="hidden" name="keyword" value={k} />)}
      <section className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={h2}>Venue keywords</h2>
          <span className="font-mono text-[13px] font-semibold" style={{ color: picked.length >= 3 ? "#14603F" : "#7A4508" }}>{picked.length} of 5 chosen · min 3</span>
        </div>
        <p className="mt-1 text-[#4A5263]">Pick 3–5 from {venueName}&apos;s list. The first one is your <strong className="text-[#121826]">main keyword</strong> — editors use it to find reviewers.</p>
        <div className="mt-4 flex min-h-[64px] flex-wrap items-center gap-2 rounded-[6px] border border-dashed border-[#B7BDC9] bg-[#FBFBF9] p-2.5" aria-live="polite">
          {picked.length === 0 ? <span className="px-1 text-[14px] text-[#4A5263]">Nothing chosen yet.</span> : null}
          {picked.map((k, i) => (
            <span key={k} className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-[15px]" style={{ background: i === 0 ? "#F2A93B" : "#FFFFFF", color: "#121826", border: i === 0 ? "none" : "1px solid #DADDE3" }}>
              <span className="font-mono text-[10px] uppercase">{i === 0 ? "Main" : i + 1}</span>
              <span className={i === 0 ? "font-semibold" : ""}>{k}</span>
              {i > 0 ? <button type="button" onClick={() => makeMain(k)} aria-label={`Make ${k} the main keyword`} className="border-0 bg-transparent p-0 text-[14px]">★</button> : null}
              <button type="button" onClick={() => toggle(k)} aria-label={`Remove ${k}`} className="border-0 bg-transparent p-0 text-[14px] text-[#4A5263]">×</button>
            </span>
          ))}
        </div>
        {err ? <p role="alert" className="mt-2 text-[13px] text-[#B3261E]">{err}</p> : null}

        <label htmlFor="sb4-q" className="mt-5 block font-medium">Search the list</label>
        <input id="sb4-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. adaptive, marine, MPC" className="mt-1.5 h-12 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[16px]" />
        {groups.map((g) => {
          const list = g.keywords.filter((k) => !needle || k.toLowerCase().includes(needle));
          if (!list.length) return null;
          return (
            <div key={g.group} className="mt-4">
              <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{g.group}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {list.map((k) => {
                  const on = picked.includes(k);
                  return (
                    <button key={k} type="button" aria-pressed={on} onClick={() => toggle(k)} disabled={!on && picked.length >= 5}
                      className="h-9 rounded-full px-3.5 text-[15px] disabled:opacity-45"
                      style={{ background: on ? "#0E1B3D" : "#FFFFFF", color: on ? "#FFFFFF" : "#121826", border: on ? "1px solid #0E1B3D" : "1px solid #B7BDC9" }}>
                      {on ? "✓ " : ""}{k}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className={`${card} mt-6`}>
        <h2 className={h2}>Your own keywords <span className="font-sans text-[14px] text-[#4A5263]">(optional)</span></h2>
        <label htmlFor="sb4-own" className="mt-1 block text-[#4A5263]">Up to 5, separated by commas. Printed on the paper&apos;s page; not used for matching.</label>
        <input id="sb4-own" name="own" defaultValue={own.join(", ")} placeholder="e.g. ocean currents, backstepping, sea trials" className="mt-3 h-12 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[16px]" />
      </section>

      {state.error ? <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{state.error}</p> : null}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] pt-6">
        <div className="flex gap-2">
          <Link href={`/submissions/${id}/authors`} className={ghostBtn}>← Back</Link>
          <button type="submit" name="intent" value="exit" className={`${ghostBtn} hidden sm:inline-flex`}>Save and exit</button>
        </div>
        <button type="submit" name="intent" value="next" disabled={pending} className={primaryBtn}>{pending ? "Saving…" : "Continue to upload →"}</button>
      </div>
    </form>
  );
}
