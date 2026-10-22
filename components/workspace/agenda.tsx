"use client";

import Link from "@/components/site/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { dayKey, fmtDay, fmtTime, tzLabel } from "@/lib/program/time";
import { Chips, selectCls, useUrlState } from "@/components/workspace/list-toolbar";
import type { AgendaItem } from "@/lib/workspace/my-work";

/* My work › Agenda: one timetable across events, always in time order. Chips for event and type; "Today" and a day
   picker jump down the list instead of sorting it. */

type Type = AgendaItem["type"];
const TYPES: [Type, string, string, string][] = [
  ["talk", "My talks", "#E6EDFC", "#1F47A8"],
  ["chair", "Sessions I chair", "#FBEFDD", "#7A4508"],
  ["saved", "Saved sessions", "#EEF0EC", "#4A5263"],
  ["deadline", "Deadlines", "#FDECEA", "#B3261E"],
];
const TAG: Record<Type, [string, string, string]> = { talk: ["My talk", "#E6EDFC", "#1F47A8"], chair: ["Chairing", "#FBEFDD", "#7A4508"], saved: ["Saved", "#EEF0EC", "#4A5263"], deadline: ["Deadline", "#FDECEA", "#B3261E"] };

export function Agenda({ items, events, init = {} }: { items: AgendaItem[]; events: [string, string][]; init?: { event?: string; type?: string } }) {
  const t = useT();
  const [event, setEvent] = useState<string>(events.some(([k]) => k === init.event) ? init.event! : "all");
  const [type, setType] = useState<Type | "all">(TYPES.some(([k]) => k === init.type) ? (init.type as Type) : "all");
  useUrlState({ event, type }, { event: "all", type: "all" });

  const inEvent = items.filter((x) => event === "all" || x.venueSlug === event);
  const list = inEvent.filter((x) => type === "all" || x.type === type);
  const days: { key: string; first: AgendaItem; items: AgendaItem[] }[] = [];
  for (const x of list) {
    const k = dayKey(x.startsAt, x.timezone);
    const d = days.find((y) => y.key === k);
    if (d) d.items.push(x); else days.push({ key: k, first: x, items: [x] });
  }
  const evChips = events.map(([k, l]) => [k, l, items.filter((x) => x.venueSlug === k).length] as [string, string, number]).filter((x) => x[2] > 0);
  const typeChips = TYPES.map(([k, l]) => [k, l, inEvent.filter((x) => x.type === k).length] as [Type, string, number]).filter((x) => x[2] > 0);
  const jump = (k: string) => document.getElementById(`day-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const today = () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const d = days.find((x) => x.items.some((i) => Date.parse(i.endsAt ?? i.startsAt) >= start.getTime())) ?? days[0];
    if (d) jump(d.key);
  };

  if (!items.length) {
    return (
      <div className="rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-8 text-center text-[#4A5263]">
        {t("Nothing on your agenda yet. Save sessions from an event’s program; talks you give, sessions you chair and your deadlines are added automatically.")}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[60px] z-10 -mx-1 flex flex-col gap-2.5 bg-[#F5F6F3]/95 px-1 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={today} className="inline-flex h-10 cursor-pointer items-center rounded-[6px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6]">{t("Today")}</button>
          {days.length > 1 ? (
            <select aria-label={t("Go to day")} value="" onChange={(e) => e.target.value && jump(e.target.value)} className={selectCls}>
              <option value="">{t("Go to day…")}</option>
              {days.map((d) => <option key={d.key} value={d.key}>{fmtDay(d.first.startsAt, d.first.timezone, t.intl)}</option>)}
            </select>
          ) : null}
          <p aria-live="polite" className="m-0 ms-auto text-[13px] text-[#4A5263]">{list.length === 1 ? t("1 item") : t("{n} items", { n: list.length })}</p>
        </div>
        <Chips items={evChips} value={event} onChange={(k) => { setEvent(k); setType("all"); }} all={items.length} label="Event" />
        <Chips items={typeChips} value={type} onChange={setType} all={inEvent.length} label="Type" />
      </div>
      {!list.length ? <p className="m-0 rounded-[8px] border border-[#DADDE3] bg-white p-5 text-[14px] text-[#4A5263]">{t("Nothing here.")}</p> : null}
      {days.map((d) => (
        <section key={d.key} id={`day-${d.key}`} aria-label={fmtDay(d.first.startsAt, d.first.timezone, t.intl)} className="scroll-mt-[190px]">
          <h2 className="m-0 mb-2 text-[14px] font-semibold text-[#4A5263]">{fmtDay(d.first.startsAt, d.first.timezone, t.intl)} <span className="font-normal">· {d.items.length}</span></h2>
          <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white p-0">
            {d.items.map((x) => {
              const [tag, bg, ink] = TAG[x.type];
              return (
                <li key={x.id} className="border-b border-[#EEF0EC] last:border-b-0">
                  <Link href={x.href} className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-3 px-4 py-3 text-[#121826] no-underline hover:bg-[#FBFBF9]">
                    <span className="font-mono text-[13px] text-[#121826]">
                      {fmtTime(x.startsAt, x.timezone, t.intl)}{x.endsAt ? `–${fmtTime(x.endsAt, x.timezone, t.intl)}` : ""}
                      <span className="block text-[11px] text-[#4A5263]">{tzLabel(x.timezone, new Date(x.startsAt))}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full px-2 py-px text-[11px] font-semibold" style={{ background: bg, color: ink }}>{t(tag)}</span>
                        <span className="font-mono text-[12px] text-[#4A5263]">{[x.venueShort, x.code].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="mt-0.5 block truncate font-semibold">{x.type === "deadline" ? t(x.title) : x.title}</span>
                      {x.room ? <span className="block text-[13px] text-[#4A5263]">{x.room}</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
