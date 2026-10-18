"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { useSchedule } from "@/components/program/program-board";
import { dayKey, fmtDay, fmtTime, overlaps } from "@/lib/program/time";
import type { Session } from "@/lib/program/data";

/* Canvas PG03: saved + automatic (present / chair) sessions per day, with clashes. */

export function PrintButton({ label, className }: { label: string; className: string }) {
  return <button type="button" onClick={() => window.print()} className={className}>{label}</button>;
}

export function MySchedule({ sessions, slug, tz }: { sessions: Session[]; slug: string; tz: string }) {
  const t = useT();
  const sched = useSchedule(sessions, slug);
  const mine = sched.mine.slice().sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const auto = (s: Session) => s.iChair || s.iPresent;

  // A saved session that overlaps one you chair / present is greyed out; plain saved-vs-saved clashes are flagged.
  const pairs: [Session, Session][] = [];
  mine.forEach((a, i) => mine.slice(i + 1).forEach((b) => { if (overlaps(a, b)) pairs.push([a, b]); }));
  const greyed = new Set(pairs.flatMap(([a, b]) => auto(a) && !auto(b) ? [b.id] : auto(b) && !auto(a) ? [a.id] : []));
  const clashing = new Set(pairs.flat().map((s) => s.id));
  const days = [...new Set(mine.map((s) => dayKey(s.startsAt, tz)))];

  if (!mine.length) {
    return (
      <div className="rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-10 text-center text-[#4A5263]">
        {t("Nothing saved.")} <Link href={`/program/${slug}`}>{t("Browse the program")}</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {sched.error ? <p role="alert" className="m-0 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3.5 py-2.5 text-[14px] text-[#8C1D18]">{t(sched.error)}</p> : null}
      {pairs.map(([a, b]) => {
        const keep = auto(a) ? a : auto(b) ? b : null;
        const drop = keep ? (keep === a ? b : a) : null;
        return (
          <div key={a.id + b.id} role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3.5 py-2.5 text-[14px] text-[#8C1D18] print:hidden">
            <span>
              {t("Overlap on {day} at {time}: {a} and {b}.", { day: fmtDay(a.startsAt, tz, t.intl), time: fmtTime(Date.parse(a.startsAt) > Date.parse(b.startsAt) ? a.startsAt : b.startsAt, tz, t.intl), a: a.code, b: b.code })}
              {keep && drop ? ` ${t(keep.iChair ? "You chair {keep}, so {drop} was greyed out." : "You present in {keep}, so {drop} was greyed out.", { keep: keep.code, drop: drop.code })}` : ` ${t("Pick one.")}`}
            </span>
            {drop && sched.saved[drop.id] ? <button type="button" onClick={() => sched.toggle(drop.id)} className="h-8 rounded-[4px] border border-[#B3261E] bg-white px-3 text-[13px] font-semibold text-[#B3261E]">{t("Remove {code}", { code: drop.code })}</button> : null}
          </div>
        );
      })}
      {days.map((d) => {
        const items = mine.filter((s) => dayKey(s.startsAt, tz) === d);
        return (
          <section key={d} aria-label={fmtDay(items[0].startsAt, tz, t.intl)} className="break-inside-avoid">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="m-0 font-serif text-[22px] font-normal">{fmtDay(items[0].startsAt, tz, t.intl)}</h2>
              <span className="font-mono text-[12px] text-[#4A5263]">{t(items.length === 1 ? "{n} item" : "{n} items", { n: items.length })}</span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {items.map((s) => {
                const grey = greyed.has(s.id);
                const clash = clashing.has(s.id);
                return (
                  <li key={s.id} className="flex flex-wrap items-start gap-3.5 rounded-[8px] border px-4 py-3.5 sm:flex-nowrap"
                    style={{ background: grey ? "#FFF8F7" : "#FFFFFF", borderColor: clash ? "#F3C3BE" : "#DADDE3", opacity: grey ? 0.5 : 1 }}>
                    <span className="w-[92px] flex-none font-mono text-[14px] font-semibold">{fmtTime(s.startsAt, tz, t.intl)}–{fmtTime(s.endsAt, tz, t.intl)}</span>
                    <div className="min-w-0 flex-auto">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#4A5263]">
                        {s.code}
                        {s.iChair ? <span className="rounded-[2px] bg-[#0E1B3D] px-1.5 py-px text-[#F2A93B]">{t("YOU CHAIR")}</span> : null}
                        {s.iPresent ? <span className="rounded-[2px] bg-[#E1F3EA] px-1.5 py-px text-[#14603F]">{t("YOU PRESENT")}</span> : null}
                        {s.previousRoom && s.previousRoom !== s.room ? <span className="rounded-[2px] bg-[#FBEFDD] px-1.5 py-px text-[#7A4508]">{t("ROOM CHANGED")}</span> : null}
                      </div>
                      <Link href={`/program/${slug}/sessions/${encodeURIComponent(s.code)}`} className="mt-0.5 block text-[16px] font-bold leading-[1.3] text-[#121826] no-underline hover:underline">{s.title}</Link>
                      <div className="text-[13px] text-[#4A5263]">{s.room ?? t("Room to be announced")}</div>
                    </div>
                    {!auto(s) ? <button type="button" onClick={() => sched.toggle(s.id)} className="h-8 flex-none rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-medium text-[#121826] print:hidden">{t("Remove")}</button> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
