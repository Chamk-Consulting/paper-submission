"use client";

import { useClock } from "@/components/venues/use-clock";
import { DAY, cityOf, fmtAoE, fmtLocal } from "@/lib/venues/time";
import { useT } from "@/lib/i18n/client";

const pad = (n: number) => String(n).padStart(2, "0");

const DUE_LABEL = {
  edit: "Editing closes in {d}d {h}h",
  due: "Due in {d}d {h}h",
  closes: "Closes in {d}d {h}h",
};
export type DueKind = keyof typeof DUE_LABEL;

/** "Editing closes in 4d 06h · 21 Oct, 23:59 AoE · 12:59 your time". */
export function DuePill({ at, kind, generatedAt }: { at: string | null; kind: DueKind; generatedAt: string }) {
  const { now, tz } = useClock(generatedAt);
  const t = useT();
  if (!at) return null;
  const ms = Date.parse(at) - now;
  if (ms <= 0) return <div className="rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{t("Closed")} · {fmtAoE(at, t.intl)}</div>;
  return (
    <div className="rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3 py-2 text-[14px] text-[#3B2A07]">
      <span className="font-mono font-semibold text-[#7A4508]">{t(DUE_LABEL[kind], { d: Math.floor(ms / DAY), h: pad(Math.floor((ms % DAY) / 3600e3)) })}</span>{" "}
      <span className="hidden sm:inline">{fmtAoE(at, t.intl)} · <strong>{fmtLocal(at, tz, true, t.intl)}</strong> {t("your time")}{tz !== "UTC" ? ` (${cityOf(tz)})` : ""}</span>
    </div>
  );
}

/** Countdown text only ("2d 11h"). */
export function Countdown({ at, generatedAt }: { at: string; generatedAt: string }) {
  const { now } = useClock(generatedAt);
  const ms = Math.max(0, Date.parse(at) - now);
  return <span className="font-mono">{Math.floor(ms / DAY)}d {pad(Math.floor((ms % DAY) / 3600e3))}h</span>;
}

/** A date in the viewer's locale + time zone. */
export function LocalDate({ at, generatedAt, time = false }: { at: string; generatedAt: string; time?: boolean }) {
  const { tz } = useClock(generatedAt);
  const t = useT();
  return <>{time ? fmtLocal(at, tz, true, t.intl) : new Date(at).toLocaleDateString(t.intl, { day: "numeric", month: "short", year: "numeric", timeZone: tz })}</>;
}
