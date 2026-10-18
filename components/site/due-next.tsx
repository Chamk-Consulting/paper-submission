"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { DueItem, DueRole } from "@/lib/site/data";

/* Canvas WS01 "Due next": role tabs + a 12-column list. Times shown in the viewer's own zone. */

export const ROLE_TINT: Record<DueRole, [string, string]> = { author: ["#E6EDFC", "#1F47A8"], reviewer: ["#FBEFDD", "#7A4508"], chair: ["#E1F3EA", "#14603F"] };
const DAY = 864e5;

export function useWhen() {
  const t = useT();
  return (iso: string | null, now: number) => {
    if (!iso) return { text: t("No deadline"), soon: false };
    const ms = Date.parse(iso) - now;
    const time = new Date(iso).toLocaleTimeString(t.intl, { hour: "2-digit", minute: "2-digit" });
    const date = new Date(iso).toLocaleDateString(t.intl, { day: "numeric", month: "short" });
    if (ms < 0) return { text: t("Overdue · {date}", { date }), soon: true };
    const days = Math.floor(ms / DAY);
    if (new Date(iso).toDateString() === new Date(now).toDateString()) return { text: t("Today {time}", { time }), soon: true };
    if (days < 1) return { text: t("Tomorrow {time}", { time }), soon: true };
    return { text: days <= 14 ? t(days === 1 ? "In {n} day · {date}" : "In {n} days · {date}", { n: days, date }) : date, soon: days <= 3 };
  };
}

export function DueNext({ items, now }: { items: DueItem[]; now: number }) {
  const t = useT();
  const when = useWhen();
  const [role, setRole] = useState<"all" | DueRole>("all");
  const count = (r: DueRole) => items.filter((i) => i.role === r).length;
  const tabs: ["all" | DueRole, string, number][] = [["all", t("All"), items.length], ["author", t("Author"), count("author")], ["reviewer", t("Reviewer"), count("reviewer")], ["chair", t("Chair"), count("chair")]];
  const shown = role === "all" ? items : items.filter((i) => i.role === role);

  return (
    <section className="rounded-[8px] border border-[#DADDE3] bg-white" aria-labelledby="due-h">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0EC] px-5 py-4">
        <h2 id="due-h" className="m-0 font-serif text-[22px] font-normal">{t("Due next")}</h2>
        <div role="tablist" aria-label={t("Filter by role")} className="flex flex-wrap gap-1 rounded-[6px] bg-[#F5F6F3] p-1">
          {tabs.map(([k, l, n]) => (
            <button key={k} type="button" role="tab" aria-selected={role === k} onClick={() => setRole(k)}
              className={`h-8 cursor-pointer rounded-[4px] border-0 px-3 text-[13px] font-medium ${role === k ? "bg-white text-[#0E1B3D] shadow-[0_1px_2px_rgba(14,27,61,0.12)]" : "bg-transparent text-[#4A5263] hover:text-[#121826]"}`}>
              {l} · {n}
            </button>
          ))}
        </div>
      </div>
      {shown.length ? (
        <ul className="m-0 list-none p-0">
          {shown.map((i) => {
            const w = when(i.at, now);
            const [bg, ink] = ROLE_TINT[i.role];
            return (
              <li key={i.id} className="grid grid-cols-12 items-center gap-x-3 gap-y-1.5 border-b border-[#EEF0EC] px-5 py-3.5 last:border-b-0">
                <span className="col-span-12 sm:col-span-2"><span className="inline-flex rounded-[3px] px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-[0.04em]" style={{ background: bg, color: ink }}>{t(i.tag)}</span></span>
                <span className="col-span-12 min-w-0 sm:col-span-6">
                  <span className="block truncate font-medium">{i.title}</span>
                  <span className="block truncate text-[13px] text-[#4A5263]">{i.venue} · {t(i.detail[0], i.detail[1])}</span>
                </span>
                <span className={`col-span-6 text-[13px] sm:col-span-2 ${w.soon ? "font-semibold text-[#A8600F]" : "text-[#4A5263]"}`} suppressHydrationWarning>{w.text}</span>
                <span className="col-span-6 text-right sm:col-span-2">
                  <Link href={i.href} className="inline-flex h-9 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-medium text-[#121826] no-underline hover:bg-[#F7F8F6]">{t(i.action)}</Link>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 px-5 py-10 text-center text-[#4A5263]">{t("Nothing due in this role.")} <Link href="/venues" className="text-[#2F5FD0]">{t("Browse open calls")}</Link></p>
      )}
    </section>
  );
}
