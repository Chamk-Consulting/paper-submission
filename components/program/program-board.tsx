"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { useClock } from "@/components/venues/use-clock";
import { toggleSchedule } from "@/lib/program/actions";
import { KIND_STYLE, dayKey, fmtDay, fmtTime, overlaps } from "@/lib/program/time";
import type { ProgramVenue, Session } from "@/lib/program/data";

/* Canvas PG01 (desktop) and M07 (phone): day tabs, kind filter, search, "add to schedule", overlaps, NOW strip. */

type Kind = "all" | "oral" | "poster" | "workshop";
const KINDS: [Kind, string][] = [["all", "All"], ["oral", "Orals"], ["poster", "Posters"], ["workshop", "Workshops"]];

export function useSchedule(sessions: Session[], slug: string) {
  const [saved, setSaved] = useState<Record<string, boolean>>(() => Object.fromEntries(sessions.map((s) => [s.id, s.saved])));
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const toggle = (id: string) => {
    const was = !!saved[id];
    setSaved((m) => ({ ...m, [id]: !was }));
    start(async () => {
      const r = await toggleSchedule(id);
      if (r.signin) { router.push(`/sign-in?next=${encodeURIComponent(`/program/${slug}`)}`); return; }
      if (r.error) { setSaved((m) => ({ ...m, [id]: was })); setError(r.error); }
      else setError(null);
    });
  };
  const mine = sessions.filter((s) => saved[s.id] || s.iChair || s.iPresent);
  const clashes = (s: Session) => mine.some((o) => o.id !== s.id && overlaps(s, o));
  return { saved, toggle, mine, clashes, error };
}

export function ProgramBoard({ venue, sessions, signedIn, generatedAt }: { venue: ProgramVenue; sessions: Session[]; signedIn: boolean; generatedAt: string }) {
  const t = useT();
  const tz = venue.timezone;
  const { now } = useClock(generatedAt);
  const days = useMemo(() => [...new Set(sessions.map((s) => dayKey(s.startsAt, tz)))].sort(), [sessions, tz]);
  const today = dayKey(new Date(generatedAt).toISOString(), tz);
  const [day, setDay] = useState(days.includes(today) ? today : days[0]);
  const [kind, setKind] = useState<Kind>("all");
  const [view, setView] = useState<"all" | "mine">("all");
  const [q, setQ] = useState("");
  const sched = useSchedule(sessions, venue.slug);

  const needle = q.trim().toLowerCase();
  const list = sessions.filter((s) =>
    dayKey(s.startsAt, tz) === day
    && (kind === "all" || s.kind === kind || (kind === "oral" && s.kind === "keynote"))
    && (view === "all" || sched.saved[s.id] || s.iChair || s.iPresent)
    && (!needle || [s.code, s.title, s.room ?? "", s.chair ?? "", ...s.talks.flatMap((x) => [x.title, x.authors ?? "", x.presenter ?? ""])].join(" ").toLowerCase().includes(needle)));
  const starts = [...new Set(list.map((s) => s.startsAt))].sort();
  const nClash = sched.mine.filter(sched.clashes).length;
  const moved = sessions.filter((s) => s.previousRoom && s.room && s.previousRoom !== s.room);

  // NOW strip (M07): only while the conference runs
  const nowIso = new Date(now).toISOString();
  const running = sessions.filter((s) => Date.parse(s.startsAt) <= now && now < Date.parse(s.endsAt));
  const upcoming = sessions.filter((s) => Date.parse(s.startsAt) > now).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  const live = days.includes(dayKey(nowIso, tz)) && (running.length > 0 || !!upcoming);

  const who = (s: Session) => {
    if (s.kind === "poster") return t("{n} posters", { n: s.talks.length });
    if (s.kind === "keynote") return s.talks[0]?.presenter ?? (s.chair ? t("Chair: {name}", { name: s.chair }) : "");
    if (s.kind === "workshop") return s.chair ? t("Organisers: {names}", { names: [s.chair, s.cochair].filter(Boolean).join(", ") }) : "";
    return s.chair ? t("Chair: {name}", { name: s.chair }) : "";
  };

  return (
    <div>
      {live ? (
        <section aria-live="polite" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-[#0E1B3D] px-4 py-3 text-[#F5F6F3]">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[12px] font-medium tracking-[0.06em] text-[#F2A93B]">{t("NOW")} · {fmtTime(nowIso, tz, t.intl)}</span>
            <span className="font-semibold">{t(running.length === 1 ? "{n} session running" : "{n} sessions running", { n: running.length })}</span>
          </div>
          {upcoming ? <span className="text-[13px] text-[#B9C3DA]">{t("Next: {title} at {time} · {room}", { title: upcoming.title, time: fmtTime(upcoming.startsAt, tz, t.intl), room: upcoming.room ?? "—" })}</span> : null}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t("Days")} className="flex max-w-full gap-1 overflow-x-auto rounded-[6px] bg-[#EEF0EC] p-[3px]">
          {days.map((d) => {
            const on = d === day;
            const iso = sessions.find((s) => dayKey(s.startsAt, tz) === d)!.startsAt;
            return (
              <button key={d} type="button" role="tab" aria-selected={on} onClick={() => setDay(d)}
                className={`h-[34px] flex-none whitespace-nowrap rounded-[4px] border-0 px-3.5 text-[14px] font-semibold ${on ? "bg-white text-[#121826]" : "bg-transparent text-[#4A5263]"}`}>
                {fmtDay(iso, tz, t.intl)}
              </button>
            );
          })}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex gap-1.5 overflow-x-auto">
            {KINDS.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                className={`h-8 flex-none rounded-full px-3 text-[13px] font-semibold ${kind === k ? "border border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border border-[#DADDE3] bg-white text-[#4A5263]"}`}>{t(label)}</button>
            ))}
          </div>
          <label className="sr-only" htmlFor="pg-q">{t("Search program")}</label>
          <input id="pg-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search title, author, room")}
            className="box-border h-9 w-full min-w-0 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px] text-[#121826] sm:w-[240px]" />
        </div>
      </div>

      {/* M07: Everything / ★ My schedule at phone width */}
      <div className="mt-3 flex gap-1.5 lg:hidden">
        {([["all", "Everything"], ["mine", "★ My schedule"]] as const).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}
            className={`h-9 rounded-full px-3.5 text-[13px] font-semibold ${view === k ? "border border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border border-[#DADDE3] bg-white text-[#4A5263]"}`}>{t(label)}</button>
        ))}
      </div>

      {sched.error ? <p role="alert" className="mt-3 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3.5 py-2.5 text-[14px] text-[#8C1D18]">{t(sched.error)}</p> : null}

      <div className="mt-[18px] flex flex-col items-start gap-6 lg:flex-row">
        <div className="flex w-full min-w-0 flex-auto flex-col gap-[18px]">
          {starts.map((st) => (
            <section key={st} aria-label={fmtTime(st, tz, t.intl)}>
              <div className="mb-2 flex items-baseline gap-2.5">
                <span className="font-mono text-[15px] font-semibold">{fmtTime(st, tz, t.intl)}</span>
                <span aria-hidden className="h-px flex-auto bg-[#DADDE3]" />
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {list.filter((s) => s.startsAt === st).map((s) => {
                  const on = !!sched.saved[s.id] || s.iChair || s.iPresent;
                  const cl = on && sched.clashes(s);
                  const [kb, ki, kl] = KIND_STYLE[s.kind] ?? KIND_STYLE.oral;
                  const changed = !!(s.previousRoom && s.previousRoom !== s.room);
                  const auto = s.iChair || s.iPresent;
                  return (
                    <article key={s.id} className="flex flex-col gap-1.5 rounded-[8px] border bg-white px-4 py-3.5" style={{ borderColor: cl ? "#F3C3BE" : on ? "#B9E0CB" : "#DADDE3" }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em]" style={{ background: kb, color: ki }}>{t(kl)}</span>
                        <span className="flex items-center gap-2 font-mono text-[11px] text-[#4A5263]">
                          {s.liveStatus === "late" && s.delayMin > 0 ? <span className="rounded-[2px] bg-[#FBEFDD] px-1.5 text-[#7A4508]">{t("{n} min late", { n: s.delayMin })}</span> : null}
                          {s.code}
                        </span>
                      </div>
                      <Link href={`/program/${venue.slug}/sessions/${encodeURIComponent(s.code)}`} className="text-[16px] font-bold leading-[1.3] text-[#121826] no-underline hover:underline">{s.title}</Link>
                      <span className="text-[13px] text-[#4A5263]">{s.room ?? t("Room to be announced")} · {fmtTime(s.startsAt, tz, t.intl)}–{fmtTime(s.endsAt, tz, t.intl)}</span>
                      <span className="text-[12px]" style={{ color: changed ? "#A8600F" : "#4A5263" }}>{who(s)}{changed ? ` · ${t("room changed")}` : ""}</span>
                      {auto ? (
                        <span className="mt-1 self-start rounded-[4px] bg-[#E1F3EA] px-2.5 py-1.5 text-[12px] font-bold text-[#14603F]">{s.iChair ? t("★ You chair this") : t("★ You present here")}</span>
                      ) : signedIn ? (
                        <button type="button" onClick={() => sched.toggle(s.id)} aria-pressed={on}
                          className="mt-1 h-[30px] self-start rounded-[4px] px-2.5 text-[12px] font-bold"
                          style={{ background: on ? (cl ? "#FDECEA" : "#E1F3EA") : "#FFFFFF", color: on ? (cl ? "#B3261E" : "#14603F") : "#0E1B3D", border: on ? "none" : "1px solid #B7BDC9" }}>
                          {cl ? t("★ In schedule · overlaps") : on ? t("★ In my schedule") : t("+ Add to schedule")}
                        </button>
                      ) : (
                        <Link href={`/sign-in?next=${encodeURIComponent(`/program/${venue.slug}`)}`} className="mt-1 inline-flex h-[30px] items-center self-start rounded-[4px] border border-[#B7BDC9] px-2.5 text-[12px] font-bold text-[#0E1B3D] no-underline">{t("Sign in to save")}</Link>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
          {list.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-9 text-center text-[#4A5263]">
              {view === "mine" ? t("Nothing saved for this day.") : t("Nothing matches. Try another day or clear the search.")}
            </div>
          ) : null}
        </div>

        <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-4 lg:w-[290px] lg:flex-none">
          <section className="rounded-[8px] bg-[#0E1B3D] px-5 py-[18px] text-[#F5F6F3]">
            <p className="m-0 font-mono text-[11px] tracking-[0.06em] text-[#F2A93B]">{t("MY SCHEDULE")}</p>
            <div className="mt-1.5 font-serif text-[30px]">{t(sched.mine.length === 1 ? "{n} session" : "{n} sessions", { n: sched.mine.length })}</div>
            <p className="m-0 text-[13px] text-[#B9C3DA]">
              {!signedIn ? t("Sign in to save sessions and see clashes.") : nClash ? t("{n} sessions overlap — pick one.", { n: nClash }) : t("No overlaps.")}
            </p>
            <Link href={signedIn ? `/program/${venue.slug}/my-schedule` : `/sign-in?next=${encodeURIComponent(`/program/${venue.slug}/my-schedule`)}`} className="mt-2.5 inline-block text-[13px] text-[#F2A93B]">{t("Open my schedule →")}</Link>
          </section>
          <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[18px] py-4 text-[14px]">
            <p className="m-0 mb-2 font-mono text-[11px] tracking-[0.06em] text-[#4A5263]">{t("DOWNLOADS")}</p>
            <div className="flex flex-col gap-1.5">
              <Link href={`/program/${venue.slug}/print`}>{t("Full program (PDF)")}</Link>
              <Link href="/settings/calendar">{t("Add to my calendar")}</Link>
              <Link href={`/program/${venue.slug}/print?abstracts=1`}>{t("Book of abstracts")}</Link>
            </div>
          </section>
          {moved.map((s) => (
            <section key={s.id} className="rounded-[8px] border border-[#F1D29A] bg-[#FFF6E6] px-4 py-3.5 text-[13px] text-[#3B2A07]">
              <strong>{t("Room change:")}</strong> {t("{code} {title} moved to {room}.", { code: s.code, title: s.title, room: s.room ?? "" })}
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}
