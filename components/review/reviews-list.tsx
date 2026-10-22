"use client";

import Link from "@/components/site/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Tag } from "@/components/review/parts";
import type { TAG } from "@/lib/review/shared";
import { EventSelect, NoMatch, Toolbar, matchWords, useUrlState, warnChip } from "@/components/workspace/list-toolbar";

type TabKey = "answer" | "write" | "done" | "declined";
export type Row = {
  id: string; tab: TabKey; tone: keyof typeof TAG; tag: string; no: string; num: number; title: string; venue: string; venueSlug: string;
  /** The date that matters for this row: reply-by, due, or submitted. */
  at: string; week: boolean; detail: string; when: string; soon: boolean; cta: string; href: string;
};

const TABS: [TabKey, string][] = [["answer", "To answer"], ["write", "To write"], ["done", "Done"], ["declined", "Declined"]];
type Sort = "date" | "event" | "title";
const SORTS: Record<TabKey, [Sort, string][]> = {
  answer: [["date", "Reply by, soonest"], ["event", "Event"], ["title", "Title (A–Z)"]],
  write: [["date", "Due soonest"], ["event", "Event"], ["title", "Title (A–Z)"]],
  done: [["date", "Most recent"], ["event", "Event"], ["title", "Title (A–Z)"]],
  declined: [["date", "Most recent"], ["event", "Event"], ["title", "Title (A–Z)"]],
};
/** Search and the Event filter appear once there is enough to look through. */
const SEARCH_FROM = 6;

/** RV01 "My reviews": To answer · To write · Done (· Declined), with search, Event, Due this week and sort. Kept in the address. */
export function ReviewsList({ rows, init = {} }: { rows: Row[]; init?: { tab?: string; q?: string; event?: string; sort?: string; week?: string } }) {
  const t = useT();
  const count = (k: TabKey) => rows.filter((r) => r.tab === k).length;
  const firstTab: TabKey = count("answer") ? "answer" : count("write") ? "write" : "done";
  const [tab, setTabState] = useState<TabKey>(TABS.some(([k]) => k === init.tab) ? (init.tab as TabKey) : firstTab);
  const [q, setQ] = useState(init.q ?? "");
  const [event, setEvent] = useState(init.event ?? "");
  const [week, setWeek] = useState(init.week === "1");
  const [sort, setSort] = useState<Sort>((["date", "event", "title"] as Sort[]).includes(init.sort as Sort) ? (init.sort as Sort) : "date");
  useUrlState({ tab, q, event, sort, week: week ? "1" : "" }, { tab: firstTab, q: "", event: "", sort: "date", week: "" });
  const setTab = (k: TabKey) => { setTabState(k); setWeek(false); };

  const inTab = rows.filter((r) => r.tab === tab);
  const events = [...new Map(rows.map((r) => [r.venueSlug, r.venue])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const searchable = rows.length >= SEARCH_FROM;
  const nWeek = inTab.filter((r) => r.week).length;
  const latestFirst = tab === "done" || tab === "declined";
  const order = {
    date: (a: Row, b: Row) => (latestFirst ? Date.parse(b.at) - Date.parse(a.at) : Date.parse(a.at) - Date.parse(b.at)),
    event: (a: Row, b: Row) => a.venue.localeCompare(b.venue) || Date.parse(a.at) - Date.parse(b.at),
    title: (a: Row, b: Row) => a.title.localeCompare(b.title),
  }[sort];
  const list = inTab.filter((r) => (!event || r.venueSlug === event) && (!week || r.week) && matchWords(`${r.title} ${r.no} #${r.num} ${r.num} ${r.venue}`, q)).sort(order);
  const active = !!q.trim() || !!event || week;
  const clear = () => { setQ(""); setEvent(""); setWeek(false); };
  const empty: Record<TabKey, string> = {
    answer: "No invitations waiting for an answer.", write: "No reviews to write right now.", done: "Reviews you submit appear here, with your certificate.", declined: "Nothing declined.",
  };

  return (
    <section className="rounded-[8px] border border-[#DADDE3] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#EEF0EC] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 font-serif text-[22px] font-normal">{t("My reviews")}</h2>
          <div role="tablist" aria-label={t("My reviews")} className="inline-flex max-w-full flex-wrap rounded-[6px] border border-[#DADDE3] p-0.5">
            {TABS.filter(([k]) => k !== "declined" || count("declined")).map(([k, l]) => {
              const on = tab === k;
              return (
                <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setTab(k)}
                  className={`h-8 cursor-pointer rounded-[4px] border-0 px-3 text-[13px] font-medium ${on ? "bg-[#0E1B3D] text-[#F5F6F3]" : "bg-transparent text-[#4A5263] hover:text-[#121826]"}`}>
                  {t(l)} · {count(k)}
                </button>
              );
            })}
          </div>
        </div>
        {searchable || nWeek ? (
          <>
            {searchable ? (
              <Toolbar id="rv" q={q} setQ={setQ} sort={sort} setSort={setSort} sorts={SORTS[tab]} shown={list.length} total={inTab.length} onClear={clear} active={active}
                placeholder="Search by title, paper ID or event" noun={["1 review", "{n} reviews"]}
                extra={<EventSelect value={event} onChange={setEvent} events={events} />} />
            ) : null}
            {nWeek && tab === "write" ? (
              <div><button type="button" aria-pressed={week} onClick={() => setWeek(!week)} className={warnChip(week)}>{t("Due this week")} <span className="opacity-70">{nWeek}</span></button></div>
            ) : null}
          </>
        ) : null}
      </div>
      {!inTab.length ? (
        <p className="m-0 px-5 py-8 text-center text-[14px] text-[#4A5263]">{t(empty[tab])}</p>
      ) : !list.length ? (
        <div className="p-4"><NoMatch onClear={clear} text="No reviews match." /></div>
      ) : (
        <ul className="m-0 list-none p-0">
          {list.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#EEF0EC] px-5 py-3.5 last:border-b-0">
              <div className="w-[104px] flex-none"><Tag tone={r.tone}>{r.tag}</Tag></div>
              <div className="min-w-[200px] flex-auto">
                <div className="text-[15px] font-medium"><span className="font-mono text-[13px] text-[#4A5263]">{r.no}</span> · {r.title}</div>
                <div className="text-[13px] text-[#4A5263]">{r.detail}</div>
              </div>
              <div className={`w-[120px] flex-none text-[13px] ${r.soon ? "font-medium text-[#A8600F]" : "text-[#4A5263]"}`}>{r.when}</div>
              <Link href={r.href} className={`inline-flex h-9 w-[96px] flex-none items-center justify-center rounded-[4px] text-[14px] font-semibold no-underline ${i === 0 && (tab === "answer" || tab === "write") ? "bg-[#F2A93B] text-[#0E1B3D] hover:bg-[#E89B26]" : "border border-[#B7BDC9] bg-white text-[#121826] hover:bg-[#F7F8F6]"}`}>
                {r.cta}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
