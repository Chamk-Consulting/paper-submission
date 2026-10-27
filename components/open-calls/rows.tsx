"use client";

import Link from "@/components/site/link";
import { useClock } from "@/components/venues/use-clock";
import { useT } from "@/lib/i18n/client";
import { DAY, cityOf, countdown, fmtLocal } from "@/lib/venues/time";
import { KIND_LABEL } from "@/lib/venues/types";
import type { OpenCall } from "@/lib/venues/open-calls";
import { VenueCoverImage } from "@/components/venues/cover";

const month = (d: string | null, intl: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleString(intl, { month: "short", year: "numeric", timeZone: "UTC" }) : null);

type Tone = "dark" | "light";
const STYLE = {
  dark: { row: "border-t border-[#24335C]", name: "text-[#F5F6F3]", sub: "text-[#B9C3DA]", where: "text-[#D6DCEA]", when: "text-[#D6DCEA]", soon: "text-[#F2A93B]", empty: "text-[#B9C3DA]", tag: "bg-[#E6EDFC] text-[#1F47A8]" },
  light: { row: "border-t border-[#EEF0EC] first:border-t-0", name: "text-[#121826]", sub: "text-[#4A5263]", where: "text-[#4A5263]", when: "text-[#121826]", soon: "text-[#A8600F]", empty: "text-[#4A5263]", tag: "bg-[#E6EDFC] text-[#1F47A8]" },
} as const;

/** Live countdown rows in the viewer's time zone. Deadlines that pass while the page is open drop out. */
export function OpenCallRows({ calls, generatedAt, tone }: { calls: OpenCall[]; generatedAt: string; tone: Tone }) {
  const t = useT();
  const { now, tz } = useClock(generatedAt);
  const s = STYLE[tone];
  const live = calls.filter((c) => Date.parse(c.deadline) > now);
  if (!live.length) return <OpenCallsEmpty tone={tone} />;
  return (
    <ul className="m-0 list-none p-0">
      {live.map((c) => {
        const ms = Date.parse(c.deadline) - now;
        const soon = ms < 7 * DAY;
        return (
          <li key={c.slug} className={`grid grid-cols-12 items-center gap-3 px-5 py-3.5 ${s.row}`}>
            <div className="col-span-12 flex min-w-0 items-start gap-3 sm:col-span-6">
              <span className="relative mt-0.5 hidden h-[40px] w-[56px] flex-none overflow-hidden rounded-[4px] sm:block"><VenueCoverImage cover={c.cover} field={c.field} alt="" /></span>
              <div className="min-w-0">
              <Link href={`/events/${c.slug}`} className={`font-semibold no-underline hover:underline ${s.name}`}>{c.name}</Link>
              <div className={`mt-0.5 text-[13px] ${s.sub}`}>
                <span className={`mr-1.5 rounded-[2px] px-1.5 py-px font-mono text-[11px] uppercase ${s.tag}`}>{c.shortName ?? t(KIND_LABEL[c.kind as keyof typeof KIND_LABEL] ?? c.kind)}</span>
                {t(c.label)}{c.extended ? ` · ${t("extended")}` : ""}
              </div>
              </div>
            </div>
            <div className={`col-span-6 text-[13px] sm:col-span-3 ${s.where}`}>{[c.location, month(c.startsOn, t.intl)].filter(Boolean).join(" · ") || <span className="italic">{t("Location and dates to be announced")}</span>}</div>
            <div className="col-span-6 text-right sm:col-span-3">
              <div className={`font-mono text-[14px] font-semibold ${soon ? s.soon : s.when}`} aria-label={t("Closes in {time}", { time: countdown(ms) })}>{countdown(ms)}</div>
              <div className={`text-[12px] ${s.sub}`} title={tz}>{fmtLocal(c.deadline, tz, true, t.intl)} · {cityOf(tz)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function OpenCallsEmpty({ tone }: { tone: Tone }) {
  const t = useT();
  const s = STYLE[tone];
  return (
    <div className={`px-5 py-7 text-[14px] ${s.empty}`}>
      <p className="m-0 font-semibold">{t("No open calls right now.")}</p>
      <p className="m-0 mt-1">{t("New calls for papers appear here as soon as a venue publishes its deadlines.")} <Link href="/events" className={tone === "dark" ? "text-[#F2A93B]" : "text-[#2F5FD0]"}>{t("Browse all venues →")}</Link></p>
    </div>
  );
}

export function OpenCallsError({ tone }: { tone: Tone }) {
  const t = useT();
  const s = STYLE[tone];
  return (
    <div role="status" className={`px-5 py-7 text-[14px] ${s.empty}`}>
      <p className="m-0 font-semibold">{t("Open calls couldn't load.")}</p>
      <p className="m-0 mt-1">{t("Refresh the page in a moment, or")} <Link href="/events" className={tone === "dark" ? "text-[#F2A93B]" : "text-[#2F5FD0]"}>{t("browse all venues")}</Link>.</p>
    </div>
  );
}

/** Loading rows with the same height as real rows, so nothing jumps when data arrives. */
export function OpenCallsSkeleton({ tone, rows = 4 }: { tone: Tone; rows?: number }) {
  const sk = tone === "dark" ? "sk-dark" : "sk";
  return (
    <div aria-busy="true" aria-label="Loading open calls">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`grid grid-cols-12 items-center gap-3 px-5 py-3.5 ${STYLE[tone].row}`}>
          <div className="col-span-12 flex flex-col gap-2 sm:col-span-6"><span className={`${sk} block h-4 w-4/5 rounded-[3px]`} /><span className={`${sk} block h-3 w-2/5 rounded-[3px]`} /></div>
          <div className="col-span-6 sm:col-span-3"><span className={`${sk} block h-3 w-3/4 rounded-[3px]`} /></div>
          <div className="col-span-6 flex flex-col items-end gap-2 sm:col-span-3"><span className={`${sk} block h-4 w-14 rounded-[3px]`} /><span className={`${sk} block h-3 w-24 rounded-[3px]`} /></div>
        </div>
      ))}
    </div>
  );
}
