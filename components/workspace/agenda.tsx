"use client";

import { ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import Link from "@/components/site/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { Chips, EventSelect, NoMatch, matchWords, selectCls, useUrlState, warnChip } from "@/components/workspace/list-toolbar";
import type { AgendaItem } from "@/lib/workspace/my-work";

/* My work › Agenda: one timetable across events. Three views — List (day by day), Month (a grid of days with coloured
   marks) and Day (a time grid, rooms side by side) — sharing one search, an Event filter, type chips and Clashes.
   A side panel holds a small month calendar, "Next up" and calendar sync. Everything is kept in the address.
   Dates come formatted from the server; the calendar grids draw only after load, so the page never disagrees with
   itself on first paint. */

/** Formatted on the server: day key and label, time text, zone label, minutes from midnight in the event's zone. */
export type AgendaRow = AgendaItem & { day: string; dayLabel: string; time: string; tzl: string; startMin: number; endMin: number };

type Type = AgendaItem["type"];
type View = "list" | "month" | "day";
const TYPES: [Type, string][] = [["talk", "My talks"], ["chair", "Sessions I chair"], ["saved", "Saved sessions"], ["deadline", "Deadlines"]];
/** [tag, fill, ink, solid] — the same colours as the tags on the list. */
const TONE: Record<Type, [string, string, string, string]> = {
  talk: ["My talk", "#E6EDFC", "#1F47A8", "#2F5FD0"],
  chair: ["Chairing", "#FBEFDD", "#7A4508", "#D98A1E"],
  saved: ["Saved", "#EEF0EC", "#4A5263", "#8A93A6"],
  deadline: ["Deadline", "#FDECEA", "#B3261E", "#D2453B"],
};

/* ---------------------------------------------------------------- dates (keys are YYYY-MM-DD; maths in UTC) */
const keyMs = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
const msKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (k: string, n: number) => msKey(keyMs(k) + n * 86_400_000);
const addMonths = (ym: string, n: number) => { const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
/** Six weeks starting on the Monday on or before the 1st. */
function monthDays(ym: string): string[] {
  const first = `${ym}-01`;
  const start = addDays(first, -((new Date(keyMs(first)).getUTCDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Timed items that overlap another timed item (deadlines never clash). */
function clashIds(items: AgendaRow[]): Set<string> {
  const timed = items.filter((x) => x.type !== "deadline" && x.endsAt).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const out = new Set<string>();
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length && Date.parse(timed[j].startsAt) < Date.parse(timed[i].endsAt!); j++) { out.add(timed[i].id); out.add(timed[j].id); }
  }
  return out;
}

const noop = () => () => {};
/** False on the server and during hydration, true after: the calendar grids draw only in the browser. */
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);
/** Today in the viewer's own calendar ("" on the server). */
const useToday = () => useSyncExternalStore(noop, localToday, () => "");

const seg = (on: boolean) => `h-8 cursor-pointer rounded-[4px] border-0 px-3 text-[13px] font-medium ${on ? "bg-[#0E1B3D] text-[#F5F6F3]" : "bg-transparent text-[#4A5263] hover:text-[#121826]"}`;
const iconBtn = "flex size-9 cursor-pointer items-center justify-center rounded-[6px] border border-[#B7BDC9] bg-white text-[#121826] hover:bg-[#F7F8F6]";
const ghostBtn = "inline-flex h-10 cursor-pointer items-center rounded-[6px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6]";

type Init = { view?: string; month?: string; day?: string; q?: string; event?: string; type?: string; clash?: string };

export function Agenda({ items, events, init = {} }: { items: AgendaRow[]; events: [string, string][]; init?: Init }) {
  const t = useT();
  const mounted = useMounted();
  const firstDay = items[0]?.day ?? "";
  const okDay = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "");
  const [view, setView] = useState<View>(init.view === "month" || init.view === "day" ? init.view : "list");
  const [day, setDay] = useState(okDay(init.day) || firstDay);
  const [month, setMonth] = useState(/^\d{4}-\d{2}$/.test(init.month ?? "") ? init.month! : (okDay(init.day) || firstDay).slice(0, 7));
  const [q, setQ] = useState(init.q ?? "");
  const [event, setEvent] = useState(events.some(([k]) => k === init.event) ? init.event! : "");
  const [type, setType] = useState<Type | "all">(TYPES.some(([k]) => k === init.type) ? (init.type as Type) : "all");
  const [onlyClash, setOnlyClash] = useState(init.clash === "1");
  useUrlState({ view, month: view === "month" ? month : "", day: view === "day" ? day : "", q, event, type, clash: onlyClash ? "1" : "" },
    { view: "list", month: "", day: "", q: "", event: "", type: "all", clash: "" });
  const today = useToday();

  const clashes = clashIds(items);
  const hay = (x: AgendaRow) => [x.title, t(x.title), x.code ?? "", x.room ?? "", x.venueShort, t(TONE[x.type][0])].join(" ");
  const inEvent = items.filter((x) => !event || x.venueSlug === event);
  const list = inEvent.filter((x) => (type === "all" || x.type === type) && (!onlyClash || clashes.has(x.id)) && matchWords(hay(x), q));
  const byDay = new Map<string, AgendaRow[]>();
  for (const x of list) byDay.set(x.day, [...(byDay.get(x.day) ?? []), x]);
  const dayKeys = [...byDay.keys()].sort();
  const labelOf = (k: string) => byDay.get(k)?.[0]?.dayLabel ?? items.find((x) => x.day === k)?.dayLabel ?? k;
  const typeChips = TYPES.map(([k, l]) => [k, l, inEvent.filter((x) => x.type === k).length] as [Type, string, number]).filter((x) => x[2] > 0);
  const active = !!q.trim() || !!event || type !== "all" || onlyClash;
  const clear = () => { setQ(""); setEvent(""); setType("all"); setOnlyClash(false); };
  const nClash = inEvent.filter((x) => clashes.has(x.id)).length;

  const openDay = (k: string) => { setDay(k); setMonth(k.slice(0, 7)); setView("day"); };
  const goToday = () => {
    const k = today || localToday();
    if (view === "month") { setMonth(k.slice(0, 7)); return; }
    if (view === "day") { setDay(k); setMonth(k.slice(0, 7)); return; }
    const next = dayKeys.find((d) => d >= k) ?? dayKeys[dayKeys.length - 1];
    if (next) document.getElementById(`day-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!items.length) {
    return (
      <div className="rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-8 text-center text-[#4A5263]">
        {t("Nothing on your agenda yet. Save sessions from an event’s program; talks you give, sessions you chair and your deadlines are added automatically.")}
      </div>
    );
  }

  const toolbar = (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div role="search" className="flex h-10 min-w-[200px] max-w-[460px] flex-[1_1_260px] items-center gap-2 rounded-[6px] border border-[#B7BDC9] bg-white px-3 focus-within:border-[#2F5FD0]">
          <label htmlFor="ag-q" className="sr-only">{t("Search")}</label>
          <input id="ag-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search title, session, room or event")}
            className="h-9 min-w-0 flex-auto border-0 bg-transparent text-[14px] text-[#121826] outline-none" />
        </div>
        <EventSelect value={event} onChange={setEvent} events={events} />
        <div role="tablist" aria-label={t("View")} className="inline-flex rounded-[6px] border border-[#DADDE3] bg-white p-0.5">
          {([["list", "List"], ["month", "Month"], ["day", "Day"]] as [View, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => { if (k === "day" && !byDay.has(day)) setDay(dayKeys.find((d) => d >= (today || "")) ?? dayKeys[0] ?? day); setView(k); }} className={seg(view === k)}>{t(l)}</button>
          ))}
        </div>
        <button type="button" onClick={goToday} className={ghostBtn}>{t("Today")}</button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {nClash ? <button type="button" aria-pressed={onlyClash} onClick={() => setOnlyClash(!onlyClash)} className={warnChip(onlyClash)}>{t("Clashes")} <span className="opacity-70">{nClash}</span></button> : null}
        <Chips items={typeChips} value={type} onChange={setType} all={inEvent.length} label="Type" />
      </div>
      <p aria-live="polite" className="m-0 text-[13px] text-[#4A5263]">
        {active ? t("Showing {n} of {total}", { n: list.length, total: items.length }) : (items.length === 1 ? t("1 item") : t("{n} items", { n: items.length }))}
        {active ? <> · <button type="button" onClick={clear} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-[#2F5FD0] underline">{t("Clear")}</button></> : null}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-auto flex-col gap-4">
        {toolbar}
        {!list.length ? <NoMatch onClear={clear} text="Nothing matches." /> : null}
        {list.length && view === "list" ? <ListView days={dayKeys} byDay={byDay} clashes={clashes} label={labelOf} /> : null}
        {list.length && view !== "list" && !mounted ? <div className="h-[420px] animate-pulse rounded-[8px] border border-[#DADDE3] bg-white" /> : null}
        {list.length && view === "month" && mounted ? <MonthView month={month} setMonth={setMonth} byDay={byDay} clashes={clashes} today={today} onDay={openDay} /> : null}
        {list.length && view === "day" && mounted ? (
          <DayView day={day} items={byDay.get(day) ?? []} clashes={clashes} label={labelOf(day)}
            prev={[...dayKeys].reverse().find((d) => d < day)} next={dayKeys.find((d) => d > day)} onDay={openDay} days={dayKeys} labelOf={labelOf} />
        ) : null}
      </div>
      <aside className="flex w-full flex-col gap-3.5 lg:sticky lg:top-[76px] lg:w-[300px] lg:flex-none">
        <Panel title={t("Calendar")}>
          {mounted ? <MiniMonth key={((view === "day" ? day : month) || (today || firstDay)).slice(0, 7)} initial={(view === "day" ? day : month) || (today || firstDay).slice(0, 7)} byDay={byDay} today={today} selected={view === "day" ? day : ""} onDay={openDay} />
            : <div className="h-[230px]" />}
        </Panel>
        <NextUp items={list} />
        <Link href="/settings/calendar" className={`${ghostBtn} justify-center gap-2 font-medium no-underline`}><CalendarPlus size={16} aria-hidden />{t("Sync to calendar")}</Link>
      </aside>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5">
      <p className="m-0 mb-2 text-[13px] font-semibold text-[#4A5263]">{title}</p>
      {children}
    </section>
  );
}

function Tag({ x, clash }: { x: AgendaRow; clash?: boolean }) {
  const t = useT();
  const [tag, bg, ink] = TONE[x.type];
  return (
    <>
      <span className="rounded-full px-2 py-px text-[11px] font-semibold" style={{ background: bg, color: ink }}>{t(tag)}</span>
      {clash ? <span className="rounded-full bg-[#FDECEA] px-2 py-px text-[11px] font-semibold text-[#B3261E]">{t("Clash")}</span> : null}
    </>
  );
}

/* ---------------------------------------------------------------- list */
function ListView({ days, byDay, clashes, label }: { days: string[]; byDay: Map<string, AgendaRow[]>; clashes: Set<string>; label: (k: string) => string }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      {days.map((k) => {
        const its = byDay.get(k)!;
        return (
          <section key={k} id={`day-${k}`} aria-label={label(k)} className="scroll-mt-[80px]">
            <h2 className="m-0 mb-2 text-[14px] font-semibold text-[#4A5263]">{label(k)} <span className="font-normal">· {its.length}</span></h2>
            <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white p-0">
              {its.map((x) => (
                <li key={x.id} className="border-b border-[#EEF0EC] last:border-b-0">
                  <Link href={x.href} className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-3 px-4 py-3 text-[#121826] no-underline hover:bg-[#FBFBF9]">
                    <span className="font-mono text-[13px] text-[#121826]">{x.time}<span className="block text-[11px] text-[#4A5263]">{x.tzl}</span></span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5"><Tag x={x} clash={clashes.has(x.id)} /><span className="font-mono text-[12px] text-[#4A5263]">{[x.venueShort, x.code].filter(Boolean).join(" · ")}</span></span>
                      <span className="mt-0.5 block truncate font-semibold">{x.type === "deadline" ? t(x.title) : x.title}</span>
                      {x.room ? <span className="block text-[13px] text-[#4A5263]">{x.room}</span> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- month */
function useMonthLabels(ym: string) {
  const t = useT();
  const title = new Intl.DateTimeFormat(t.intl, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(keyMs(`${ym}-01`)));
  const week = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(t.intl, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i))));
  return { title, week };
}

function MonthHead({ ym, setYm, small }: { ym: string; setYm: (v: string) => void; small?: boolean }) {
  const t = useT();
  const { title } = useMonthLabels(ym);
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className={`m-0 font-semibold capitalize ${small ? "text-[14px]" : "text-[17px]"}`}>{title}</h2>
      <span className="flex gap-1">
        <button type="button" aria-label={t("Previous month")} onClick={() => setYm(addMonths(ym, -1))} className={`${iconBtn} ${small ? "size-7" : ""}`}><ChevronLeft size={16} aria-hidden className="rtl:rotate-180" /></button>
        <button type="button" aria-label={t("Next month")} onClick={() => setYm(addMonths(ym, 1))} className={`${iconBtn} ${small ? "size-7" : ""}`}><ChevronRight size={16} aria-hidden className="rtl:rotate-180" /></button>
      </span>
    </div>
  );
}

function MonthView({ month, setMonth, byDay, clashes, today, onDay }: { month: string; setMonth: (v: string) => void; byDay: Map<string, AgendaRow[]>; clashes: Set<string>; today: string; onDay: (k: string) => void }) {
  const t = useT();
  const { week } = useMonthLabels(month);
  return (
    <section className="rounded-[8px] border border-[#DADDE3] bg-white p-3 sm:p-4">
      <MonthHead ym={month} setYm={setMonth} />
      <div role="grid" aria-label={t("Month")} className="mt-3 grid grid-cols-7 overflow-hidden rounded-[6px] border border-[#EEF0EC]">
        {week.map((w) => <div key={w} role="columnheader" className="border-b border-[#EEF0EC] bg-[#FBFBF9] px-1.5 py-1.5 text-center text-[12px] font-semibold text-[#4A5263]">{w}</div>)}
        {monthDays(month).map((k) => {
          const its = byDay.get(k) ?? [];
          const out = k.slice(0, 7) !== month;
          const isToday = k === today;
          return (
            <button key={k} type="button" role="gridcell" onClick={() => onDay(k)} aria-label={`${k}: ${its.length}`}
              className={`flex min-h-[64px] cursor-pointer flex-col items-stretch gap-0.5 border-0 border-b border-e border-[#EEF0EC] p-1 text-start sm:min-h-[96px] sm:p-1.5 ${out ? "bg-[#FBFBF9] text-[#9AA1B0]" : "bg-white text-[#121826]"} hover:bg-[#F3F6FD]`}>
              <span className={`inline-flex size-6 items-center justify-center self-start rounded-full text-[12px] ${isToday ? "bg-[#0E1B3D] font-semibold text-white" : ""}`}>{+k.slice(8)}</span>
              {/* phones: dots; wider: short labels */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">{its.slice(0, 4).map((x) => <span key={x.id} className="size-1.5 rounded-full" style={{ background: TONE[x.type][3] }} />)}</span>
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {its.slice(0, 3).map((x) => (
                  <span key={x.id} className={`truncate rounded-[3px] px-1 text-[11px] leading-[18px] ${clashes.has(x.id) ? "ring-1 ring-[#D2453B]" : ""}`} style={{ background: TONE[x.type][1], color: TONE[x.type][2] }}>
                    {x.type === "deadline" ? t(x.title) : x.code ?? x.title}
                  </span>
                ))}
                {its.length > 3 ? <span className="px-1 text-[11px] text-[#4A5263]">{t("+{n} more", { n: its.length - 3 })}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <Legend />
    </section>
  );
}

function Legend() {
  const t = useT();
  return (
    <p className="m-0 mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#4A5263]">
      {TYPES.map(([k, l]) => <span key={k} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: TONE[k][3] }} />{t(l)}</span>)}
    </p>
  );
}

function MiniMonth({ initial, byDay, today, selected, onDay }: { initial: string; byDay: Map<string, AgendaRow[]>; today: string; selected: string; onDay: (k: string) => void }) {
  const t = useT();
  const [ym, setYm] = useState(initial.slice(0, 7));
  const { week } = useMonthLabels(ym);
  return (
    <div>
      <MonthHead ym={ym} setYm={setYm} small />
      <div className="mt-2 grid grid-cols-7 gap-y-0.5 text-center">
        {week.map((w) => <span key={w} className="text-[11px] text-[#4A5263]">{w.slice(0, 2)}</span>)}
        {monthDays(ym).map((k) => {
          const its = byDay.get(k) ?? [];
          const out = k.slice(0, 7) !== ym;
          return (
            <button key={k} type="button" onClick={() => onDay(k)} aria-label={`${k}: ${its.length}`} aria-pressed={k === selected}
              className={`relative mx-auto flex size-8 cursor-pointer flex-col items-center justify-center rounded-full border-0 text-[12px] ${k === selected ? "bg-[#0E1B3D] text-white" : k === today ? "bg-[#E6EDFC] font-semibold text-[#0E1B3D]" : out ? "bg-transparent text-[#B7BDC9]" : "bg-transparent text-[#121826] hover:bg-[#F5F6F3]"}`}>
              {+k.slice(8)}
              {its.length ? <span aria-hidden className="absolute bottom-0.5 flex gap-px">{[...new Set(its.map((x) => x.type))].slice(0, 3).map((ty) => <span key={ty} className="size-1 rounded-full" style={{ background: TONE[ty][3] }} />)}</span> : null}
            </button>
          );
        })}
      </div>
      <p className="m-0 mt-2 text-[12px] text-[#4A5263]">{t("Pick a day to open it.")}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- day */
const PX = 1.1; // pixels per minute

function DayView({ day, items, clashes, label, prev, next, onDay, days, labelOf }: {
  day: string; items: AgendaRow[]; clashes: Set<string>; label: string; prev?: string; next?: string; onDay: (k: string) => void; days: string[]; labelOf: (k: string) => string;
}) {
  const t = useT();
  const due = items.filter((x) => x.type === "deadline");
  const timed = items.filter((x) => x.type !== "deadline");
  const rooms = [...new Set(timed.map((x) => x.room ?? ""))];
  const from = Math.min(8 * 60, ...timed.map((x) => Math.floor(x.startMin / 60) * 60));
  const to = Math.max(19 * 60, ...timed.map((x) => Math.ceil(Math.max(x.endMin, x.startMin + 30) / 60) * 60));
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60);
  const hh = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:00`;
  return (
    <section className="rounded-[8px] border border-[#DADDE3] bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[17px] font-semibold">{label}</h2>
        <span className="flex items-center gap-1">
          <button type="button" aria-label={t("Previous day with items")} disabled={!prev} onClick={() => prev && onDay(prev)} className={`${iconBtn} disabled:cursor-default disabled:opacity-40`}><ChevronLeft size={16} aria-hidden className="rtl:rotate-180" /></button>
          <select aria-label={t("Go to day")} value={days.includes(day) ? day : ""} onChange={(e) => e.target.value && onDay(e.target.value)} className={`${selectCls} h-9`}>
            {!days.includes(day) ? <option value="">{label}</option> : null}
            {days.map((d) => <option key={d} value={d}>{labelOf(d)}</option>)}
          </select>
          <button type="button" aria-label={t("Next day with items")} disabled={!next} onClick={() => next && onDay(next)} className={`${iconBtn} disabled:cursor-default disabled:opacity-40`}><ChevronRight size={16} aria-hidden className="rtl:rotate-180" /></button>
        </span>
      </div>
      {due.length ? (
        <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
          {due.map((x) => (
            <li key={x.id}><Link href={x.href} className="flex flex-wrap items-center gap-2 rounded-[6px] border border-[#F3C7C3] bg-[#FDF4F3] px-3 py-2 text-[14px] text-[#121826] no-underline">
              <Tag x={x} /><span className="font-mono text-[12px] text-[#4A5263]">{x.time} {x.tzl} · {x.venueShort}</span><span className="font-semibold">{t(x.title)}</span>
            </Link></li>
          ))}
        </ul>
      ) : null}
      {!items.length ? <p className="m-0 mt-4 text-[14px] text-[#4A5263]">{t("Nothing on this day.")}</p> : null}
      {timed.length ? (
        <div className="mt-3 overflow-x-auto">
          <div className="grid min-w-full" style={{ gridTemplateColumns: `52px repeat(${rooms.length}, minmax(${rooms.length > 1 ? 160 : 220}px, 1fr))`, width: rooms.length > 3 ? `${52 + rooms.length * 170}px` : undefined }}>
            <div />
            {rooms.map((r) => <div key={r || "-"} className="truncate border-b border-[#EEF0EC] px-2 pb-1.5 text-[12px] font-semibold text-[#4A5263]">{r || t("Room to be announced")}</div>)}
            <div className="relative" style={{ height: (to - from) * PX }}>
              {hours.map((m) => <span key={m} className="absolute end-2 -translate-y-1/2 font-mono text-[11px] text-[#4A5263]" style={{ top: (m - from) * PX }}>{hh(m)}</span>)}
            </div>
            {rooms.map((r) => {
              const col = timed.filter((x) => (x.room ?? "") === r);
              return (
                <div key={r || "-"} className="relative border-s border-[#EEF0EC]" style={{ height: (to - from) * PX }}>
                  {hours.map((m) => <span key={m} aria-hidden className="absolute inset-x-0 border-t border-dashed border-[#EEF0EC]" style={{ top: (m - from) * PX }} />)}
                  {col.map((x, i) => {
                    const overlapPrev = col.slice(0, i).some((y) => y.startMin < x.endMin && x.startMin < y.endMin);
                    const clash = clashes.has(x.id);
                    const [, bg, ink, solid] = TONE[x.type];
                    return (
                      <Link key={x.id} href={x.href} title={`${x.time} · ${x.title}`}
                        className={`absolute flex flex-col overflow-hidden rounded-[6px] border-s-[3px] px-2 py-1 text-[12px] no-underline ${clash ? "ring-2 ring-[#D2453B]" : ""}`}
                        style={{ top: (x.startMin - from) * PX + 1, height: Math.max(26, (x.endMin - x.startMin) * PX - 2), insetInlineStart: overlapPrev ? "50%" : 4, insetInlineEnd: 4, background: bg, color: ink, borderInlineStartColor: solid }}>
                        <span className="font-mono text-[11px]">{x.time}{x.code ? ` · ${x.code}` : ""}</span>
                        <span className="truncate font-semibold">{x.title}</span>
                        {clash ? <span className="text-[11px] font-semibold text-[#B3261E]">{t("Clash")}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <Legend />
    </section>
  );
}

/* ---------------------------------------------------------------- side panel */
function NextUp({ items }: { items: AgendaRow[] }) {
  const t = useT();
  const next = items.slice(0, 3);
  if (!next.length) return null;
  return (
    <Panel title={t("Next up")}>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {next.map((x) => (
          <li key={x.id}>
            <Link href={x.href} className="block rounded-[6px] text-[#121826] no-underline hover:bg-[#FBFBF9]">
              <span className="flex flex-wrap items-center gap-1.5"><Tag x={x} /><span className="font-mono text-[11px] text-[#4A5263]">{x.venueShort}</span></span>
              <span className="mt-0.5 block truncate text-[14px] font-semibold">{x.type === "deadline" ? t(x.title) : x.title}</span>
              <span className="block text-[12px] text-[#4A5263]">{x.dayLabel} · {x.time} {x.tzl}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
