"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Check, MyPaper, Stage } from "@/lib/workspace/data";

const ST: Record<Stage, [string, string, string]> = {
  draft: ["DRAFT", "#EEF0EC", "#4A5263"],
  submitted: ["SUBMITTED", "#E6EDFC", "#1F47A8"],
  review: ["UNDER REVIEW", "#E6EDFC", "#1F47A8"],
  decision: ["ACCEPTED", "#E1F3EA", "#14603F"],
  revise: ["REVISE", "#FBEFDD", "#7A4508"],
  final: ["FINAL DUE", "#FBEFDD", "#7A4508"],
  done: ["COMPLETE", "#E1F3EA", "#14603F"],
  rejected: ["NOT ACCEPTED", "#FDECEA", "#B3261E"],
  withdrawn: ["WITHDRAWN", "#EEF0EC", "#4A5263"],
};
type Group = "draft" | "review" | "decision" | "done";
const GROUP: Record<Stage, Group> = { draft: "draft", submitted: "review", review: "review", decision: "decision", revise: "decision", final: "decision", done: "done", rejected: "done", withdrawn: "done" };
const FILTERS: [Group | "all", string][] = [["all", "All"], ["draft", "Drafts"], ["review", "In review"], ["decision", "Action needed"], ["done", "Done"]];
const TICK: Record<Check, [string, string, string]> = { ok: ["#E1F3EA", "#14603F", "done"], need: ["#FBEFDD", "#7A4508", "needed"], no: ["#EEF0EC", "#9AA3B5", "not yet"] };

const month = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleString("en", { month: "short", year: "numeric", timeZone: "UTC" }) : null);

function Tick({ t, title, s }: { t: string; title: string; s: Check }) {
  const [bg, ink, word] = TICK[s];
  return <span title={`${title}: ${word}`} className="inline-flex h-[22px] items-center rounded-[3px] px-1.5 font-mono text-[10px] font-semibold" style={{ background: bg, color: ink }}>{t}</span>;
}

/** Canvas WS02 list: filter chips, search, papers grouped by venue. */
export function PapersList({ papers, initialQuery = "" }: { papers: MyPaper[]; initialQuery?: string }) {
  const [f, setF] = useState<Group | "all">("all");
  const [q, setQ] = useState(initialQuery);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = papers.filter((p) => (f === "all" || GROUP[p.stage] === f) && (!needle || `${p.title} ${p.venue.name} ${p.venue.shortName ?? ""} #${p.number ?? ""}`.toLowerCase().includes(needle)));
    const map = new Map<string, { venue: MyPaper["venue"]; items: MyPaper[] }>();
    for (const p of list) {
      const g = map.get(p.venue.id) ?? { venue: p.venue, items: [] };
      g.items.push(p);
      map.set(p.venue.id, g);
    }
    return [...map.values()];
  }, [papers, f, q]);

  return (
    <section aria-labelledby="pp-h" className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pp-h" className="m-0 font-serif text-[20px] font-normal">All my papers</h2>
        <label htmlFor="ws-q" className="sr-only">Search</label>
        <input id="ws-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, venue or ID"
          className="box-border h-9 w-[260px] max-w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px] text-[#121826] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]" />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {FILTERS.map(([key, label]) => {
          const on = f === key;
          const n = key === "all" ? papers.length : papers.filter((p) => GROUP[p.stage] === key).length;
          return (
            <button key={key} type="button" aria-pressed={on} onClick={() => setF(key)}
              className="h-[30px] rounded-full px-3 text-[13px] font-semibold"
              style={{ background: on ? "#0E1B3D" : "#FFFFFF", color: on ? "#F5F6F3" : "#4A5263", border: on ? "1px solid #0E1B3D" : "1px solid #DADDE3" }}>
              {label} <span className="font-mono text-[11px] opacity-75">{n}</span>
            </button>
          );
        })}
      </div>

      {groups.map((g) => {
        const meta = g.venue.kind === "journal" ? "Journal" : [g.venue.location, month(g.venue.startsOn)].filter(Boolean).join(" · ");
        return (
          <div key={g.venue.id} className="mt-3.5 overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
            <div className="flex items-center justify-between gap-2.5 border-b border-[#DADDE3] bg-[#FBFBF9] px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="truncate font-semibold">{g.venue.shortName ?? g.venue.name}</span>
                {meta ? <span className="text-[13px] text-[#4A5263]">{meta}</span> : null}
              </span>
              {/* TODO(data): next venue deadline ("Papers close in 4d") once submission_types/deadlines exist. */}
              <span className="font-mono text-[12px] text-[#4A5263]">{g.venue.kind === "journal" ? "Rolling" : ""}</span>
            </div>
            {g.items.map((p) => {
              const [label, bg, ink] = ST[p.stage];
              return (
                // TODO(submit): link to SB09 status / SB04 draft step once those screens exist.
                <div key={p.id} className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-3.5 border-b border-[#EEF0EC] px-4 py-3 last:border-b-0 lg:grid-cols-[70px_minmax(0,1fr)_190px_150px]">
                  <span className="font-mono text-[12px] text-[#4A5263]">{p.number ? `#${String(p.number).padStart(4, "0")}` : "—"}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{p.title}</span>
                    <span className="block text-[12px] text-[#4A5263]">{p.paperType} · {p.role}</span>
                  </span>
                  <span className="col-start-2 lg:col-start-auto">
                    <span className="rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]" style={{ background: bg, color: ink }}>{label}</span>
                    {p.detail ? <span className="mt-1 block text-[12px] text-[#4A5263]">{p.detail}</span> : null}
                  </span>
                  <span className="col-start-2 flex gap-1.5 lg:col-start-auto lg:justify-end">
                    <Tick t="PDF" title="PDF check" s={p.checks.pdf} />
                    <Tick t="©" title="Copyright" s={p.checks.copyright} />
                    <Tick t="REG" title="Registration" s={p.checks.registration} />
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      {groups.length === 0 ? (
        <div className="mt-3.5 rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-7 text-center text-[#4A5263]">
          {papers.length && (q || f !== "all") ? "No papers match." : "Nothing here."}{" "}
          <Link href="/venues" className="text-[#2F5FD0] underline">Find a venue</Link> to submit to.
        </div>
      ) : null}
      <p className="mt-2.5 text-[12px] text-[#4A5263]">Ticks: <strong>PDF</strong> file check · <strong>©</strong> copyright · <strong>REG</strong> registration. Green = done, amber = needed, grey = not yet.</p>
    </section>
  );
}
