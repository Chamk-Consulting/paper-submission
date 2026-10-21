"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicHeader } from "@/components/venues/public-header";
import { getMyVenueStatus } from "@/lib/venues/polish-actions";
import type { MyVenueStatus } from "@/lib/venues/polish-types";
import { useClock, useFollows } from "@/components/venues/use-clock";
import type { VenueDate } from "@/lib/venues/types";
import { DAY, cityOf, fmtAoE, fmtLocal, weekdayDate } from "@/lib/venues/time";
import { useT } from "@/lib/i18n/client";

const dateOnly = (iso: string, tz: string, intl = "en-GB") => weekdayDate(new Date(iso), intl, { timeZone: tz });

const DEADLINE = new Set(["submission", "proposal", "final", "registration"]);
const pad = (n: number) => String(n).padStart(2, "0");

/** Navy countdown card (top right of canvas PV02). */
export function CountdownCard({ dates, generatedAt }: { dates: VenueDate[]; generatedAt: string }) {
  const t = useT();
  const { now, tz } = useClock(generatedAt);
  const next = dates.find((d) => DEADLINE.has(d.kind) && Date.parse(d.startsAt) > now);
  if (!next) {
    return (
      <div className="w-full rounded-[8px] bg-[#0E1B3D] px-5 py-[18px] text-[#F5F6F3] lg:w-[380px]">
        <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#F2A93B]">{t("Deadlines")}</div>
        <p className="mt-2 text-[15px] text-[#D6DCEA]">{t("No upcoming deadlines. Follow the venue to hear when the next call opens.")}</p>
      </div>
    );
  }
  const ms = Date.parse(next.startsAt) - now;
  const parts: [string, string][] = [[pad(Math.floor(ms / DAY)), t("days")], [pad(Math.floor((ms % DAY) / 3600e3)), t("h")], [pad(Math.floor((ms % 3600e3) / 60e3)), t("min")]];
  return (
    <div className="w-full rounded-[8px] bg-[#0E1B3D] px-5 py-[18px] text-[#F5F6F3] lg:w-[380px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#F2A93B]">{t("Next deadline")} · {t(next.label)}</span>
        {next.isExtended ? <span className="rounded-[2px] bg-[#2F5FD0] px-2 py-0.5 font-mono text-[11px] text-white">{t("EXTENDED")}</span> : null}
      </div>
      <div className="mt-3 flex items-baseline gap-4" aria-label={t("{d} days {h} hours {m} minutes left", { d: parts[0][0], h: parts[1][0], m: parts[2][0] })}>
        {parts.map(([v, u]) => <span key={u}><span className="font-mono text-[40px] font-medium leading-none">{v}</span><span className="ml-1 text-[13px] text-[#B9C3DA]">{u}</span></span>)}
      </div>
      <p className="mt-3 text-[13px] text-[#B9C3DA]">{fmtAoE(next.startsAt, t.intl)}</p>
      <p className="text-[15px] font-semibold">= {t("{time} in {city}", { time: fmtLocal(next.startsAt, tz, true, t.intl), city: cityOf(tz) })}</p>
      <p className="mt-3 border-t border-[#24335C] pt-3 text-[12px] text-[#B9C3DA]">
        {next.isExtended && next.extendedFrom ? `${t("Extended from {date}.", { date: dateOnly(next.extendedFrom, tz, t.intl) })} ` : ""}
        {next.isHard ? t("Hard deadline — the system closes on time.") : t("Soft deadline — it may move.")}
      </p>
    </div>
  );
}

export function FollowButton({ venueId, slug }: { venueId: string; slug: string }) {
  const t = useT();
  const f = useFollows();
  const on = f.followed.includes(venueId);
  return (
    <button type="button" onClick={() => f.toggle(venueId, `/venues/${slug}`)} aria-pressed={on}
      className="h-11 rounded-[4px] px-4 text-[15px] font-medium"
      style={{ color: on ? "#7A4508" : "#121826", background: on ? "#FFF6E6" : "#FFFFFF", border: `1px solid ${on ? "#F1D29A" : "#B7BDC9"}` }}>
      {on ? `★ ${t("Following")}` : `☆ ${t("Follow venue")}`}
    </button>
  );
}

/** "Important dates" list with done / next / upcoming states. */
export function DatesList({ dates, generatedAt }: { dates: VenueDate[]; generatedAt: string }) {
  const t = useT();
  const { now, tz } = useClock(generatedAt);
  const list = dates.filter((d) => d.kind !== "conference");
  const nextId = list.find((d) => Date.parse(d.startsAt) > now)?.id;
  return (
    <>
      <p className="mt-1 text-[14px] text-[#4A5263]">{t("All times in {zone}. Hard deadlines close on time; soft ones may move.", { zone: tz === "UTC" ? t("your time zone") : `${cityOf(tz)} (${tz})` })}</p>
      {list.length ? (
        <ol className="m-0 mt-4 list-none overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white p-0">
          {list.map((d) => {
            const ts = Date.parse(d.startsAt), done = ts <= now, isNext = d.id === nextId, days = Math.ceil((ts - now) / DAY);
            return (
              <li key={d.id} className="flex items-center gap-3.5 border-b border-[#EEF0EC] px-[18px] py-3.5 last:border-b-0" style={{ background: isNext ? "#FFFBF3" : undefined }}>
                <span aria-hidden className="flex size-[22px] flex-none items-center justify-center rounded-full text-[12px]"
                  style={{ background: done ? "#18744F" : isNext ? "#F2A93B" : "#FFFFFF", color: done ? "#FFFFFF" : "#0E1B3D", border: done || isNext ? "none" : "1.5px solid #B7BDC9" }}>{done ? "✓" : isNext ? "•" : ""}</span>
                <span className="min-w-0 flex-auto">
                  <span className="block font-mono text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: done ? "#14603F" : isNext ? "#A8600F" : "#4A5263" }}>{done ? t("Done") : isNext ? `${t("Next")} · ${days === 1 ? t("1 day") : t("{n} days", { n: days })}` : t("Upcoming")}</span>
                  <span className="block font-semibold">{t(d.label)}</span>
                  {d.isExtended && d.extendedFrom ? <span className="block text-[13px] text-[#1F47A8]">{t("Extended from {date}", { date: dateOnly(d.extendedFrom, tz, t.intl) })}</span> : null}
                </span>
                <span className="text-right">
                  <span className="block font-mono text-[13px]">{d.kind === "notification" ? dateOnly(d.startsAt, tz, t.intl) : fmtLocal(d.startsAt, tz, true, t.intl)}</span>
                  <span className="block text-[12px] text-[#4A5263]">{done ? t("closed") : d.kind === "notification" ? t("target") : `= ${fmtAoE(d.startsAt, t.intl)}`}</span>
                </span>
                <span className="hidden rounded-[2px] bg-[#EEF0EC] px-2 py-0.5 font-mono text-[11px] text-[#4A5263] sm:inline">{d.isHard ? t("HARD") : t("SOFT")}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-5 text-[14px] text-[#4A5263]">{t("The organizers haven't published dates yet.")}</p>
      )}
    </>
  );
}

const STAGE: Record<string, string> = {
  draft: "DRAFT", submitted: "SUBMITTED", review: "IN REVIEW", decision: "DECISION", revise: "REVISION", final: "FINAL VERSION", done: "ACCEPTED", rejected: "NOT ACCEPTED", withdrawn: "WITHDRAWN",
};
const ROLE: Record<string, string> = {
  owner: "OWNER", chair: "GENERAL CHAIR", program_chair: "PROGRAM CHAIR", deputy_chair: "DEPUTY CHAIR", ceb_chair: "EDITORIAL BOARD CHAIR", publication_chair: "PUBLICATION CHAIR",
  registration_chair: "REGISTRATION CHAIR", session_chair: "SESSION CHAIR", associate_editor: "ASSOCIATE EDITOR", reviewer: "REVIEWER", staff: "STAFF",
};

function MyStatus({ venueId, acr, slug }: { venueId: string; acr: string; slug: string }) {
  const t = useT();
  const [s, setS] = useState<MyVenueStatus | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    getMyVenueStatus(venueId).then((r) => { if (live) setS(r); }).catch(() => { if (live) setS(null); });
    return () => { live = false; };
  }, [venueId]);
  if (s === undefined) return <div aria-busy="true" className="mt-2 h-14 animate-pulse rounded-[6px] bg-[#F5F6F3]" />;
  const empty = !s || (!s.roles.length && !s.papers.length && !s.reviews.length);
  if (empty) return <p className="mt-1.5 text-[14px] text-[#4A5263]">{t("You have no papers or roles at {acr} yet.", { acr })} <Link href="/workspace/submissions" className="text-[#2F5FD0] underline">{t("My submissions")}</Link></p>;
  const no = (n: number | null) => (n ? `#${String(n).padStart(4, "0")}` : t("Draft"));
  return (
    <>
      <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0">
        {s.roles.map((r) => (
          <li key={r} className="rounded-[6px] border border-[#DADDE3] px-3 py-2">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#1F47A8]">{t(ROLE[r] ?? r.toUpperCase())}</span>
            {["owner", "chair", "program_chair", "deputy_chair", "ceb_chair", "publication_chair", "registration_chair", "staff"].includes(r)
              ? <Link href={`/manage/${slug}`} className="block text-[13px] font-semibold text-[#2F5FD0]">{t("Open the event dashboard →")}</Link> : null}
          </li>
        ))}
        {s.papers.slice(0, 4).map((p) => (
          <li key={p.id} className="rounded-[6px] border border-[#DADDE3] px-3 py-2">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t(STAGE[p.stage] ?? p.stage)} · {no(p.number)}</span>
            <span className="block truncate text-[14px] font-semibold">{p.title || t("Untitled draft")}</span>
            <span className="block text-[13px] text-[#4A5263]">
              {p.stage === "draft" && p.draft_step ? `${t("Step {n} of 7", { n: p.draft_step })} · ` : ""}
              <Link href={`/submissions/${p.id}`} className="font-semibold text-[#2F5FD0]">{p.stage === "draft" ? t("Continue →") : t("Open →")}</Link>
            </span>
          </li>
        ))}
        {s.reviews.slice(0, 4).map((r) => (
          <li key={r.id} className="rounded-[6px] border border-[#DADDE3] px-3 py-2">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#7A4508]">{t("REVIEWER")} · {no(r.number)}</span>
            <span className="block text-[13px] text-[#4A5263]">
              {r.status === "invited" ? t("Invitation — reply needed") : r.status === "submitted" ? t("Review submitted") : t("Due {date}", { date: new Date(r.due_at).toLocaleDateString(t.intl, { day: "numeric", month: "short" }) })}
              {" · "}<Link href={r.status === "accepted" ? `/reviews/${r.id}` : "/reviews"} className="font-semibold text-[#2F5FD0]">{t("Open →")}</Link>
            </span>
          </li>
        ))}
      </ul>
      <Link href={`/venues/${slug}/me`} className="mt-3 inline-block text-[13px] font-semibold text-[#2F5FD0]">{t("Everything for you at {acr} →", { acr })}</Link>
    </>
  );
}

/** "Your status here" card. */
export function StatusCard({ venueId, acr, slug }: { venueId: string; acr: string; slug: string }) {
  const t = useT();
  const f = useFollows();
  return (
    <section aria-labelledby="st-h" className="rounded-[8px] border border-[#DADDE3] bg-white p-[18px]">
      <h2 id="st-h" className="m-0 text-[17px] font-semibold">{t("Your status here")}</h2>
      {f.signedIn ? (
        <MyStatus venueId={venueId} acr={acr} slug={slug} />
      ) : (
        <>
          <p className="mt-1.5 text-[14px] text-[#4A5263]">{t("Sign in to see your papers, reviews and roles at {acr}.", { acr })}</p>
          <Link href={`/sign-in?next=/venues/${slug}`} className="mt-3 flex h-11 items-center justify-center rounded-[4px] bg-[#F2A93B] text-[15px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{t("Sign in")}</Link>
          <p className="mt-2.5 text-[13px] text-[#4A5263]">{t("New?")} <Link href={`/create-account?next=/venues/${slug}`} className="text-[#2F5FD0] underline">{t("Create a free account")}</Link></p>
        </>
      )}
    </section>
  );
}

export function LiveHeader() {
  const f = useFollows();
  return <PublicHeader signedIn={f.signedIn} />;
}
