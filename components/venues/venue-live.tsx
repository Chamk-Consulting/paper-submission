"use client";

import Link from "next/link";
import { PublicHeader } from "@/components/venues/public-header";
import { useClock, useFollows } from "@/components/venues/use-clock";
import type { VenueDate } from "@/lib/venues/types";
import { DAY, cityOf, fmtAoE, fmtLocal } from "@/lib/venues/time";

const dateOnly = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" });

const DEADLINE = new Set(["submission", "proposal", "final", "registration"]);
const pad = (n: number) => String(n).padStart(2, "0");

/** Navy countdown card (top right of canvas PV02). */
export function CountdownCard({ dates, generatedAt }: { dates: VenueDate[]; generatedAt: string }) {
  const { now, tz } = useClock(generatedAt);
  const next = dates.find((d) => DEADLINE.has(d.kind) && Date.parse(d.startsAt) > now);
  if (!next) {
    return (
      <div className="w-full rounded-[8px] bg-[#0E1B3D] px-5 py-[18px] text-[#F5F6F3] lg:w-[380px]">
        <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#F2A93B]">Deadlines</div>
        <p className="mt-2 text-[15px] text-[#D6DCEA]">No upcoming deadlines. Follow the venue to hear when the next call opens.</p>
      </div>
    );
  }
  const ms = Date.parse(next.startsAt) - now;
  const parts: [string, string][] = [[pad(Math.floor(ms / DAY)), "days"], [pad(Math.floor((ms % DAY) / 3600e3)), "h"], [pad(Math.floor((ms % 3600e3) / 60e3)), "min"]];
  return (
    <div className="w-full rounded-[8px] bg-[#0E1B3D] px-5 py-[18px] text-[#F5F6F3] lg:w-[380px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#F2A93B]">Next deadline · {next.label}</span>
        {next.isExtended ? <span className="rounded-[2px] bg-[#2F5FD0] px-2 py-0.5 font-mono text-[11px] text-white">EXTENDED</span> : null}
      </div>
      <div className="mt-3 flex items-baseline gap-4" aria-label={`${parts[0][0]} days ${parts[1][0]} hours ${parts[2][0]} minutes left`}>
        {parts.map(([v, u]) => <span key={u}><span className="font-mono text-[40px] font-medium leading-none">{v}</span><span className="ml-1 text-[13px] text-[#B9C3DA]">{u}</span></span>)}
      </div>
      <p className="mt-3 text-[13px] text-[#B9C3DA]">{fmtAoE(next.startsAt)}</p>
      <p className="text-[15px] font-semibold">= {fmtLocal(next.startsAt, tz)} in {cityOf(tz)}</p>
      <p className="mt-3 border-t border-[#24335C] pt-3 text-[12px] text-[#B9C3DA]">
        {next.isExtended && next.extendedFrom ? `Extended from ${dateOnly(next.extendedFrom, tz)}. ` : ""}
        {next.isHard ? "Hard deadline — the system closes on time." : "Soft deadline — it may move."}
      </p>
    </div>
  );
}

export function FollowButton({ venueId, slug }: { venueId: string; slug: string }) {
  const f = useFollows();
  const on = f.followed.includes(venueId);
  return (
    <button type="button" onClick={() => f.toggle(venueId, `/venues/${slug}`)} aria-pressed={on}
      className="h-11 rounded-[4px] px-4 text-[15px] font-medium"
      style={{ color: on ? "#7A4508" : "#121826", background: on ? "#FFF6E6" : "#FFFFFF", border: `1px solid ${on ? "#F1D29A" : "#B7BDC9"}` }}>
      {on ? "★ Following" : "☆ Follow venue"}
    </button>
  );
}

/** "Important dates" list with done / next / upcoming states. */
export function DatesList({ dates, generatedAt }: { dates: VenueDate[]; generatedAt: string }) {
  const { now, tz } = useClock(generatedAt);
  const list = dates.filter((d) => d.kind !== "conference");
  const nextId = list.find((d) => Date.parse(d.startsAt) > now)?.id;
  return (
    <>
      <p className="mt-1 text-[14px] text-[#4A5263]">All times in {tz === "UTC" ? "your time zone" : `${cityOf(tz)} (${tz})`}. Hard deadlines close on time; soft ones may move.</p>
      {list.length ? (
        <ol className="m-0 mt-4 list-none overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white p-0">
          {list.map((d) => {
            const t = Date.parse(d.startsAt), done = t <= now, isNext = d.id === nextId, days = Math.ceil((t - now) / DAY);
            return (
              <li key={d.id} className="flex items-center gap-3.5 border-b border-[#EEF0EC] px-[18px] py-3.5 last:border-b-0" style={{ background: isNext ? "#FFFBF3" : undefined }}>
                <span aria-hidden className="flex size-[22px] flex-none items-center justify-center rounded-full text-[12px]"
                  style={{ background: done ? "#18744F" : isNext ? "#F2A93B" : "#FFFFFF", color: done ? "#FFFFFF" : "#0E1B3D", border: done || isNext ? "none" : "1.5px solid #B7BDC9" }}>{done ? "✓" : isNext ? "•" : ""}</span>
                <span className="min-w-0 flex-auto">
                  <span className="block font-mono text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: done ? "#14603F" : isNext ? "#A8600F" : "#4A5263" }}>{done ? "Done" : isNext ? `Next · ${days} ${days === 1 ? "day" : "days"}` : "Upcoming"}</span>
                  <span className="block font-semibold">{d.label}</span>
                  {d.isExtended && d.extendedFrom ? <span className="block text-[13px] text-[#1F47A8]">Extended from {dateOnly(d.extendedFrom, tz)}</span> : null}
                </span>
                <span className="text-right">
                  <span className="block font-mono text-[13px]">{d.kind === "notification" ? dateOnly(d.startsAt, tz) : fmtLocal(d.startsAt, tz)}</span>
                  <span className="block text-[12px] text-[#4A5263]">{done ? "closed" : d.kind === "notification" ? "target" : `= ${fmtAoE(d.startsAt)}`}</span>
                </span>
                <span className="hidden rounded-[2px] bg-[#EEF0EC] px-2 py-0.5 font-mono text-[11px] text-[#4A5263] sm:inline">{d.isHard ? "HARD" : "SOFT"}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-5 text-[14px] text-[#4A5263]">The organizers haven&apos;t published dates yet.</p>
      )}
    </>
  );
}

/** "Your status here" card. */
export function StatusCard({ acr, slug }: { acr: string; slug: string }) {
  const f = useFollows();
  return (
    <section aria-labelledby="st-h" className="rounded-[8px] border border-[#DADDE3] bg-white p-[18px]">
      <h2 id="st-h" className="m-0 text-[17px] font-semibold">Your status here</h2>
      {f.signedIn ? (
        // TODO(workspace): your papers, reviews and roles at this venue.
        <p className="mt-1.5 text-[14px] text-[#4A5263]">You have no papers or roles at {acr} yet. <Link href="/workspace/submissions" className="text-[#2F5FD0] underline">My submissions</Link></p>
      ) : (
        <>
          <p className="mt-1.5 text-[14px] text-[#4A5263]">Sign in to see your papers, reviews and roles at {acr}.</p>
          <Link href={`/sign-in?next=/venues/${slug}`} className="mt-3 flex h-11 items-center justify-center rounded-[4px] bg-[#F2A93B] text-[15px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">Sign in</Link>
          <p className="mt-2.5 text-[13px] text-[#4A5263]">New? <Link href={`/create-account?next=/venues/${slug}`} className="text-[#2F5FD0] underline">Create a free account</Link></p>
        </>
      )}
    </section>
  );
}

export function LiveHeader() {
  const f = useFollows();
  return <PublicHeader signedIn={f.signedIn} />;
}
