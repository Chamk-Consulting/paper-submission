"use client";

import Link from "@/components/site/link";
import { useMemo, useState } from "react";
import { Chips, EventSelect, NoMatch, Toolbar, matchWords, useUrlState, warnChip } from "@/components/workspace/list-toolbar";
import type { Check, MyPaper, Stage } from "@/lib/workspace/data";
import { useT } from "@/lib/i18n/client";

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
/** Status filters. "Needs action" overlaps the others on purpose (a final version due is also accepted). */
type Status = "needs" | "progress" | "accepted" | "closed";
const STATUS: [Status, string, (p: MyPaper) => boolean][] = [
  ["needs", "Needs action", (p) => p.pending || p.stage === "draft" || p.stage === "revise" || p.stage === "final"],
  ["progress", "In progress", (p) => !p.pending && (p.stage === "submitted" || p.stage === "review")],
  ["accepted", "Accepted", (p) => p.stage === "decision" || p.stage === "final" || p.stage === "done"],
  ["closed", "Not accepted or withdrawn", (p) => p.stage === "rejected" || p.stage === "withdrawn"],
];
type Sort = "next" | "recent" | "event" | "title";
const SORTS: [Sort, string][] = [["next", "Next deadline"], ["recent", "Recently updated"], ["event", "Event"], ["title", "Title (A–Z)"]];
export type PapersInit = { q?: string; status?: string; event?: string; sort?: string; co?: string };
const AFTER_ACCEPTANCE = new Set(["final", "done"]);
const TICK: Record<Check, [string, string, string]> = { ok: ["#E1F3EA", "#14603F", "done"], need: ["#FBEFDD", "#7A4508", "needed"], no: ["#EEF0EC", "#4A5263", "not yet"] };

const month = (d: string | null, intl: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleString(intl, { month: "short", year: "numeric", timeZone: "UTC" }) : null);

function Tick({ label, title, s }: { label: string; title: string; s: Check }) {
  const t = useT();
  const [bg, ink, word] = TICK[s];
  return <span title={`${t(title)}: ${t(word)}`} className="inline-flex h-[22px] items-center rounded-[3px] px-1.5 font-mono text-[11px] font-semibold" style={{ background: bg, color: ink }}>{label}</span>;
}

/** "Step 3 of 7" and other stage details come from the server in English. */
function detailText(t: ReturnType<typeof useT>, d: string) {
  const m = d.match(/^Step (\d+) of 7$/);
  return m ? t("Step {n} of 7", { n: m[1] }) : t(d);
}

/** Canvas WS02 list: search, sort, status chips, an Event filter and Co-author requests; papers grouped by event
 *  (or one flat list when sorted by date updated or title). The choices stay in the address. */
export function PapersList({ papers, next = {}, init = {} }: { papers: MyPaper[]; next?: Record<string, number | null>; init?: PapersInit }) {
  const t = useT();
  const okStatus = (x?: string): Status | "all" => (STATUS.some(([k]) => k === x) ? (x as Status) : "all");
  const [status, setStatus] = useState<Status | "all">(okStatus(init.status));
  const [q, setQ] = useState(init.q ?? "");
  const [event, setEvent] = useState(init.event ?? "");
  const [co, setCo] = useState(init.co === "1");
  const [sort, setSort] = useState<Sort>(SORTS.some(([k]) => k === init.sort) ? (init.sort as Sort) : "next");
  useUrlState({ q, status, event, sort, co: co ? "1" : "" }, { q: "", status: "all", event: "", sort: "next", co: "" });

  const events = useMemo(() => [...new Map(papers.map((p) => [p.venue.slug, p.venue.shortName ?? p.venue.name])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [papers]);
  const nPending = papers.filter((p) => p.pending).length;
  const test = STATUS.find(([k]) => k === status)?.[2];
  const hay = (p: MyPaper) => [p.title, p.venue.name, p.venue.shortName ?? "", p.venue.slug, p.number ? `#${p.number} ${p.number}` : "", p.paperType, t(p.role), ...p.authors].join(" ");
  const list = papers.filter((p) => (!test || test(p)) && (!event || p.venue.slug === event) && (!co || p.pending) && matchWords(hay(p), q));
  const nextOf = (p: MyPaper) => next[p.venue.id] ?? Number.MAX_SAFE_INTEGER;
  const flat = sort === "recent" || sort === "title";
  const byTitle = (a: MyPaper, b: MyPaper) => a.title.localeCompare(b.title);
  const byRecent = (a: MyPaper, b: MyPaper) => (a.updatedAt < b.updatedAt ? 1 : -1);
  const sorted = [...list].sort(sort === "title" ? byTitle : byRecent);
  const groups = useMemo(() => {
    const map = new Map<string, { venue: MyPaper["venue"]; items: MyPaper[] }>();
    for (const p of sorted) {
      const g = map.get(p.venue.id) ?? { venue: p.venue, items: [] };
      g.items.push(p);
      map.set(p.venue.id, g);
    }
    const name = (v: MyPaper["venue"]) => v.shortName ?? v.name;
    return [...map.values()].sort((a, b) => sort === "event" ? name(a.venue).localeCompare(name(b.venue)) : (nextOf(a.items[0]) - nextOf(b.items[0])) || name(a.venue).localeCompare(name(b.venue)));
  }, [sorted, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = status !== "all" || !!event || co || !!q.trim();
  const clear = () => { setStatus("all"); setEvent(""); setCo(false); setQ(""); };
  const counts = STATUS.map(([k, l, f]) => [k, l, papers.filter(f).length] as [Status, string, number]).filter((x) => x[2] > 0);

  const row = (p: MyPaper, showVenue: boolean) => {
    const [label, bg, ink] = p.pending ? ["CONFIRM", "#FBEFDD", "#7A4508"] : ST[p.stage];
    return (
      <Link key={p.id} href={p.href} className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-3.5 border-b border-[#EEF0EC] px-4 py-3 text-[#121826] no-underline last:border-b-0 hover:bg-[#FBFBF9] lg:grid-cols-[70px_minmax(0,1fr)_190px_150px]">
        <span className="font-mono text-[12px] text-[#4A5263]">{p.number ? `#${String(p.number).padStart(4, "0")}` : "—"}</span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{p.title}</span>
          <span className="block text-[12px] text-[#4A5263]">{[showVenue ? p.venue.shortName ?? p.venue.name : "", p.paperType, t(p.role)].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="col-start-2 lg:col-start-auto">
          <span className="rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]" style={{ background: bg, color: ink }}>{t(label)}</span>
          {p.pending ? <span className="mt-1 block text-[12px] text-[#7A4508]">{t("Co-author request: confirm or decline")}</span>
            : p.detail ? <span className="mt-1 block text-[12px] text-[#4A5263]">{detailText(t, p.detail)}</span> : null}
        </span>
        {/* PDF, copyright and registration only matter once a paper is accepted: no grey "not yet" ticks before. */}
        <span className="col-start-2 flex gap-1.5 lg:col-start-auto lg:justify-end">
          {AFTER_ACCEPTANCE.has(p.stage) && !p.pending ? <>
            <Tick label="PDF" title="PDF check" s={p.checks.pdf} />
            <Tick label="©" title="Copyright" s={p.checks.copyright} />
            <Tick label="REG" title="Registration" s={p.checks.registration} />
          </> : null}
        </span>
      </Link>
    );
  };

  return (
    <section aria-label={t("My submissions")} className="mt-6 flex flex-col gap-3">
      <Toolbar id="pp" q={q} setQ={setQ} sort={sort} setSort={setSort} sorts={SORTS} shown={list.length} total={papers.length} onClear={clear} active={active}
        placeholder="Search by title, ID, event or co-author" noun={["1 paper", "{n} papers"]}
        extra={<EventSelect value={event} onChange={setEvent} events={events} />} />
      <div className="flex flex-wrap items-center gap-1.5">
        {nPending ? <button type="button" aria-pressed={co} onClick={() => setCo(!co)} className={warnChip(co)}>{t("Co-author requests")} <span className="opacity-70">{nPending}</span></button> : null}
        <Chips items={counts} value={status} onChange={setStatus} all={papers.length} label="Status" />
      </div>

      {papers.length && !list.length ? <NoMatch onClear={clear} text="No papers match." /> : null}
      {flat ? (list.length ? <div className="overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">{sorted.map((p) => row(p, true))}</div> : null) : groups.map((g) => {
        const meta = g.venue.kind === "journal" ? t("Journal") : [g.venue.location, month(g.venue.startsOn, t.intl)].filter(Boolean).join(" · ");
        return (
          <div key={g.venue.id} className="overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
            <div className="flex items-center justify-between gap-2.5 border-b border-[#DADDE3] bg-[#FBFBF9] px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <Link href={`/workspace/events/${g.venue.slug}`} className="truncate font-semibold text-[#121826] no-underline hover:underline">{g.venue.shortName ?? g.venue.name}</Link>
                {meta ? <span className="text-[13px] text-[#4A5263]">{meta}</span> : null}
              </span>
              <span className="font-mono text-[12px] text-[#4A5263]">{g.venue.kind === "journal" ? t("Rolling") : ""}</span>
            </div>
            {g.items.map((p) => row(p, false))}
          </div>
        );
      })}

      {!papers.length ? (
        <div className="rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-7 text-center text-[#4A5263]">
          {t("Nothing here.")} <Link href="/workspace/events" className="text-[#2F5FD0] underline">{t("Find a venue to submit to.")}</Link>
        </div>
      ) : null}
      <p className="m-0 text-[12px] text-[#4A5263]">{t("After acceptance: PDF file check · © copyright · REG registration. Green = done, amber = needed, grey = not yet.")}</p>
    </section>
  );
}
