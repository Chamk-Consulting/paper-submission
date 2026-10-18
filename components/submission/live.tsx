"use client";

import { useClock } from "@/components/venues/use-clock";
import { DAY, cityOf, fmtAoE, fmtLocal } from "@/lib/venues/time";

const pad = (n: number) => String(n).padStart(2, "0");

/** "Closes in 4d 06h · 21 Oct, 23:59 AoE · Thu 12:59 your time (Lagos)" pill. */
export function DeadlinePill({ deadline, generatedAt }: { deadline: string | null; generatedAt: string }) {
  const { now, tz } = useClock(generatedAt);
  if (!deadline) return <div className="rounded-[6px] border border-[#DADDE3] bg-white px-3 py-2 text-[14px] text-[#4A5263]">No deadline · submissions open</div>;
  const ms = Date.parse(deadline) - now;
  if (ms <= 0) return <div className="rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">Deadline passed · {fmtAoE(deadline)}</div>;
  return (
    <div className="rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3 py-2 text-[14px] text-[#3B2A07]">
      <span className="font-mono font-semibold text-[#7A4508]">Closes in {Math.floor(ms / DAY)}d {pad(Math.floor((ms % DAY) / 3600e3))}h</span>{" "}
      <span className="hidden sm:inline">{fmtAoE(deadline)} · <strong>{fmtLocal(deadline, tz)}</strong> your time{tz !== "UTC" ? ` (${cityOf(tz)})` : ""}</span>
    </div>
  );
}

export function DeadlineBig({ deadline, generatedAt }: { deadline: string | null; generatedAt: string }) {
  const { now, tz } = useClock(generatedAt);
  const ms = deadline ? Date.parse(deadline) - now : 0;
  return (
    <section className="rounded-[8px] bg-[#0E1B3D] px-[18px] py-4 text-[#F5F6F3]">
      <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#F2A93B]">Deadline</p>
      {deadline ? (
        <>
          <div className="mt-2 font-mono text-[28px] font-medium">{ms > 0 ? `${Math.floor(ms / DAY)}d ${pad(Math.floor((ms % DAY) / 3600e3))}h ${pad(Math.floor((ms % 3600e3) / 60e3))}m` : "Passed"}</div>
          <p className="mt-1 text-[13px] text-[#B9C3DA]">{fmtAoE(deadline)} · {fmtLocal(deadline, tz)} {cityOf(tz)}</p>
        </>
      ) : <p className="mt-2 text-[15px]">No deadline — rolling submissions.</p>}
    </section>
  );
}

export function SavedAgo({ at, generatedAt, label = "Saved" }: { at: string; generatedAt: string; label?: string }) {
  const { now } = useClock(generatedAt);
  const s = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  const ago = s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < DAY / 1000 ? `${Math.floor(s / 3600)} h ago` : new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return <span className="hidden items-center gap-2 text-[14px] text-[#4A5263] sm:flex"><span className="size-2 rounded-full bg-[#18744F]" />{label} · {ago}</span>;
}
