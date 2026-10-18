"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveConflicts, type ActionState } from "@/lib/submission/actions";
import { card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";

export type Member = { personId: string; name: string; institution: string | null; role: string };
const REASONS = ["Co-authored in the last 3 years", "Same institution now or in the last 3 years", "PhD advisor or student", "Close personal relationship", "Other (explain to the PC)"];
const ROLE = { owner: "General chair", chair: "Program chair", associate_editor: "Associate editor" } as Record<string, string>;
const ini = (n: string) => n.replace(/[^\p{L}\s]/gu, "").replace(/\b(Prof|Dr)\b\.?/g, "").split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/** SB06: automatic conflicts (shown) + committee conflicts with reasons. */
export function ConflictsForm({ id, auto, committee, initial }: { id: string; auto: { kind: string; title: string; text: string; source: string }[]; committee: Member[]; initial: Record<string, string> }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveConflicts, {});
  const [marks, setMarks] = useState<Record<string, string>>(initial);
  const [q, setQ] = useState("");
  const [tried, setTried] = useState(false);
  const needle = q.trim().toLowerCase();
  const shown = committee.filter((m) => !needle || `${m.name} ${m.institution ?? ""}`.toLowerCase().includes(needle));
  const missing = Object.values(marks).some((r) => !r);
  const payload = JSON.stringify(Object.entries(marks).map(([personId, reason]) => ({ personId, institution: committee.find((m) => m.personId === personId)?.institution ?? null, reason })));

  return (
    <form action={action} onSubmit={(e) => { if (missing && (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "next") { e.preventDefault(); setTried(true); } }}>
      <input type="hidden" name="submissionId" value={id} />
      <input type="hidden" name="conflicts" value={payload} />
      <section className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className={h2}>Found for you</h2><span className="text-[14px] text-[#4A5263]">Checked automatically — nothing to do unless something is wrong</span></div>
        <ul className="m-0 mt-3 list-none p-0">
          {auto.map((a) => (
            <li key={a.title} className="flex flex-wrap items-center gap-3 border-t border-[#EEF0EC] py-3">
              <span className="rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium uppercase" style={{ background: a.kind === "institution" ? "#E6EDFC" : "#E1F3EA", color: a.kind === "institution" ? "#1F47A8" : "#14603F" }}>{a.kind}</span>
              <span className="min-w-0 flex-auto"><span className="block font-semibold">{a.title}</span><span className="block text-[14px] text-[#4A5263]">{a.text}</span></span>
              <span className="text-[13px] text-[#4A5263]">{a.source}</span>
            </li>
          ))}
          {auto.length === 0 ? <li className="border-t border-[#EEF0EC] py-3 text-[14px] text-[#4A5263]">No institutions on the author list yet — add them in your profile or for each co-author.</li> : null}
        </ul>
        {/* TODO(conflicts): co-authorship conflicts from ORCID works and advisor links from profiles. */}
      </section>

      <section className={`${card} mt-6`}>
        <h2 className={h2}>Program committee and editors</h2>
        <p className="mt-1 text-[#4A5263]">Mark anyone who should not handle your paper. Only conflicts with a real reason count.</p>
        {committee.length ? (
          <>
            <label htmlFor="sb6-q" className="mt-4 block font-medium">Search by name or institution</label>
            <input id="sb6-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Rossi, ETH" className="mt-1.5 h-12 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[16px]" />
            <ul className="m-0 mt-3 list-none p-0">
              {shown.map((m) => {
                const on = m.personId in marks;
                return (
                  <li key={m.personId} className="border-b border-[#EEF0EC] py-3">
                    <div className="flex items-center gap-3">
                      <span aria-hidden className="flex size-9 flex-none items-center justify-center rounded-full bg-[#EEF0EC] text-[13px] font-semibold text-[#4A5263]">{ini(m.name)}</span>
                      <span className="min-w-0 flex-auto"><span className="block font-semibold">{m.name} <span className="font-normal text-[#4A5263]">· {ROLE[m.role] ?? m.role}</span></span><span className="block text-[14px] text-[#4A5263]">{m.institution ?? "—"}</span></span>
                      <button type="button" aria-pressed={on} onClick={() => setMarks((x) => { const n = { ...x }; if (on) delete n[m.personId]; else n[m.personId] = ""; return n; })}
                        className="h-9 rounded-[4px] px-3 text-[14px] font-semibold" style={{ color: on ? "#B3261E" : "#121826", background: on ? "#FDECEA" : "#FFFFFF", border: `1px solid ${on ? "#F3C3BE" : "#B7BDC9"}` }}>{on ? "Conflict ✓" : "Mark conflict"}</button>
                    </div>
                    {on ? (
                      <div className="ml-12 mt-2.5 flex flex-wrap items-center gap-2.5">
                        <label htmlFor={`r-${m.personId}`} className="text-[14px] text-[#4A5263]">Reason</label>
                        <select id={`r-${m.personId}`} value={marks[m.personId]} onChange={(e) => setMarks((x) => ({ ...x, [m.personId]: e.target.value }))}
                          className="h-10 min-w-[260px] rounded-[4px] bg-white px-2 text-[14px]" style={{ border: tried && !marks[m.personId] ? "2px solid #B3261E" : "1px solid #B7BDC9" }}>
                          <option value="">Choose…</option>{REASONS.map((r) => <option key={r}>{r}</option>)}
                        </select>
                        {tried && !marks[m.personId] ? <span className="text-[13px] text-[#B3261E]">Pick a reason.</span> : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {shown.length === 0 ? <p className="mt-3 text-[14px] text-[#4A5263]">Nobody on the committee matches &quot;{q}&quot;.</p> : null}
          </>
        ) : <p className="mt-4 rounded-[6px] border border-dashed border-[#DADDE3] px-4 py-4 text-[14px] text-[#4A5263]">The organizers haven&apos;t published the committee yet. You can come back and mark conflicts until the deadline.</p>}
      </section>

      {state.error || (tried && missing) ? <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{state.error ?? "Add a reason for each conflict."}</p> : null}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] pt-6">
        <div className="flex gap-2">
          <Link href={`/submissions/${id}/files`} className={ghostBtn}>← Back</Link>
          <button type="submit" name="intent" value="exit" className={`${ghostBtn} hidden sm:inline-flex`}>Save and exit</button>
        </div>
        <button type="submit" name="intent" value="next" disabled={pending} className={primaryBtn}>{pending ? "Saving…" : "Continue to review →"}</button>
      </div>
    </form>
  );
}
