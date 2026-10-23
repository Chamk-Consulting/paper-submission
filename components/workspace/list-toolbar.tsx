"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";

/* Shared list controls for Events (My events, Following, Past) and My work (Papers, Reviews, Talks & sessions, Agenda):
   a search box, a sort menu with no visible label, filter chips, and "Showing n of total · Clear". */

export const listCard = "rounded-[8px] border border-[#DADDE3] bg-white p-[18px] shadow-[0_1px_0_rgba(18,24,38,.04)]";
export const chipBtn = (on: boolean) => `inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] ${on ? "border-[#0E1B3D] bg-[#0E1B3D] font-semibold text-white" : "border-[#DADDE3] bg-white text-[#121826] hover:border-[#B7BDC9]"}`;
/** The amber "needs you" chip (Needs action, Co-author requests, Due this week) while it is off. */
export const warnChip = (on: boolean) => `${chipBtn(on)} ${on ? "" : "border-[#F2C98A]! bg-[#FFF6E6]! text-[#7A4508]!"}`;
export const selectCls = "h-10 max-w-full cursor-pointer rounded-[6px] border border-[#B7BDC9] bg-white px-2.5 text-[14px] text-[#121826] hover:border-[#8A93A6]";

export function Chips<K extends string>({ items, value, onChange, all, label }: { items: [K, string, number][]; value: K | "all"; onChange: (k: K | "all") => void; all: number; label?: string }) {
  const t = useT();
  if (items.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t(label ?? "Show")}>
      <button type="button" aria-pressed={value === "all"} onClick={() => onChange("all")} className={chipBtn(value === "all")}>{t("All")} <span className="opacity-70">{all}</span></button>
      {items.map(([k, l, n]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className={chipBtn(value === k)}>{t(l)} <span className="opacity-70">{n}</span></button>
      ))}
    </div>
  );
}

/** Search + sort. `search={false}` hides the box (short lists); `extra` sits beside the sort menu (an Event filter, say). */
export function Toolbar<S extends string>({ id, q, setQ, sort, setSort, sorts, shown, total, onClear, active, placeholder, search = true, extra, noun }: {
  id: string; q: string; setQ: (v: string) => void; sort: S; setSort: (v: S) => void; sorts: [S, string][]; shown: number; total: number; onClear: () => void; active: boolean;
  placeholder: string; search?: boolean; extra?: ReactNode; noun?: [string, string];
}) {
  const t = useT();
  const [one, many] = noun ?? ["1 event", "{n} events"];
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {search ? (
          <div role="search" className="flex h-10 min-w-[220px] max-w-[560px] flex-[1_1_320px] items-center gap-2 rounded-[6px] border border-[#B7BDC9] bg-white px-3 focus-within:border-[#2F5FD0]">
            <Search size={16} strokeWidth={1.75} aria-hidden className="flex-none text-[#4A5263]" />
            <label htmlFor={`${id}-q`} className="sr-only">{t("Search")}</label>
            <input id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(placeholder)}
              className="h-9 min-w-0 flex-auto border-0 bg-transparent text-[14px] text-[#121826] outline-none" />
          </div>
        ) : null}
        {extra}
        {sorts.length > 1 ? (
          <select aria-label={t("Sort")} value={sort} onChange={(e) => setSort(e.target.value as S)} className={selectCls}>
            {sorts.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
          </select>
        ) : null}
      </div>
      <p aria-live="polite" className="m-0 text-[13px] text-[#4A5263]">
        {active ? t("Showing {n} of {total}", { n: shown, total }) : (total === 1 ? t(one) : t(many, { n: total }))}
        {active ? <> · <button type="button" onClick={onClear} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-[#2F5FD0] underline">{t("Clear")}</button></> : null}
      </p>
    </div>
  );
}

/** A small "Event" filter, shown only when the list spans more than one event. */
export function EventSelect({ value, onChange, events }: { value: string; onChange: (v: string) => void; events: [string, string][] }) {
  const t = useT();
  if (events.length < 2) return null;
  return (
    <select aria-label={t("Event")} value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      <option value="">{t("All events")}</option>
      {events.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

export function NoMatch({ onClear, text = "No events match." }: { onClear: () => void; text?: string }) {
  const t = useT();
  return (
    <div className={`${listCard} text-[14px] text-[#4A5263]`}>
      {t(text)} <button type="button" onClick={onClear} className="cursor-pointer border-0 bg-transparent p-0 text-[14px] font-semibold text-[#2F5FD0] underline">{t("Clear search and filters")}</button>
    </div>
  );
}

/** Every word must appear in the haystack. */
export const matchWords = (hay: string, q: string) => q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.toLowerCase().includes(w));

/** Keeps the chosen filters in the address (?tab=…&sort=…) without a navigation, so a reload or a shared link shows the same view. */
export function useUrlState(state: Record<string, string>, defaults: Record<string, string>) {
  const first = useRef(true);
  const key = JSON.stringify(state);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const u = new URL(window.location.href);
    for (const [k, v] of Object.entries(state)) {
      if (!v || v === defaults[k]) u.searchParams.delete(k); else u.searchParams.set(k, v);
    }
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
