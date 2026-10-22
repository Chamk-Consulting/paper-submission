"use client";

import Link from "@/components/site/link";
import { useEffect, useMemo, useState } from "react";
import type { Row } from "@/components/venues/directory";
import { useFollows } from "@/components/venues/use-clock";
import { getMyTasks } from "@/lib/venues/polish-actions";
import type { MyTask } from "@/lib/venues/polish-types";
import { DAY, cityOf, dayKey, fmtAoE, fmtLocal } from "@/lib/venues/time";
import { useT } from "@/lib/i18n/client";

type T = "sub" | "prop" | "notif" | "conf" | "mine";
const TY: Record<T, { label: string; kind: string; bg: string; ink: string; bar: string; tag: string; border?: string }> = {
  sub: { label: "Submission deadlines", kind: "SUBMISSION", bg: "#E6EDFC", ink: "#1F47A8", bar: "#2F5FD0", tag: "" },
  prop: { label: "Proposals & abstracts", kind: "PROPOSALS", bg: "#E1F3EA", ink: "#14603F", bar: "#18744F", tag: " · proposals" },
  notif: { label: "Notifications", kind: "NOTIFICATION", bg: "#EEF0EC", ink: "#4A5263", bar: "#B7BDC9", tag: " · decisions" },
  conf: { label: "Conference dates", kind: "CONFERENCE", bg: "#0E1B3D", ink: "#F5F6F3", bar: "#0E1B3D", tag: " ▸ on" },
  mine: { label: "My tasks", kind: "YOUR TASK", bg: "#FFFFFF", ink: "#7A4508", bar: "#F2A93B", tag: "", border: "1.5px solid #F2A93B" },
};
const PUBLIC_TYPES: T[] = ["sub", "prop", "notif", "conf"];
const typeOf = (k: string): T => (k === "proposal" ? "prop" : k === "notification" ? "notif" : k === "conference" ? "conf" : "sub");

type Ev = { key: string; type: T; acr: string; slug: string; what: string; start: number; endKey: string; startKey: string; ext: boolean; when: string; href?: string };

/** Canvas PV01 "Deadline calendar" tab. */
export function CalendarView({ rows, now, tz }: { rows: Row[]; now: number; tz: string }) {
  const t = useT();
  const todayKey = dayKey(now, tz);
  const [ym, setYm] = useState<[number, number] | null>(null);
  const [types, setTypes] = useState<T[]>(["sub", "prop", "notif", "conf", "mine"]);
  const follows = useFollows();
  const [tasks, setTasks] = useState<MyTask[] | null>(null);
  const wantTasks = follows.signedIn && types.includes("mine");
  useEffect(() => {
    if (!wantTasks || tasks) return;
    let live = true;
    getMyTasks().then((r) => { if (live) setTasks(r.tasks); }).catch(() => { if (live) setTasks([]); });
    return () => { live = false; };
  }, [wantTasks, tasks]);
  const [copied, setCopied] = useState(false);
  const [sel, setSel] = useState("");
  const [y, m] = ym ?? [Number(todayKey.slice(0, 4)), Number(todayKey.slice(5, 7))];

  const evs: Ev[] = useMemo(
    () => rows.flatMap((v) => v.dates.map((d) => {
      const type = typeOf(d.kind);
      const start = Date.parse(d.startsAt);
      const startKey = type === "conf" ? d.startsAt.slice(0, 10) : dayKey(start, tz);
      const endKey = type === "conf" && d.endsAt ? dayKey(Date.parse(d.endsAt) - 1, "UTC") : startKey;
      const when = type === "conf" ? (v.location ?? "") : type === "notif" ? t("Target date") : `${fmtAoE(d.startsAt, t.intl)} = ${fmtLocal(d.startsAt, tz, false, t.intl)} ${cityOf(tz)}`;
      return { key: d.id, type, acr: v.acr, slug: v.slug, what: t(d.label), start, startKey, endKey, ext: d.isExtended, when };
    })),
    [rows, tz, t],
  );
  const mine: Ev[] = useMemo(
    () => (tasks ?? []).map((k) => {
      const start = Date.parse(k.startsAt);
      const startKey = dayKey(start, tz);
      return { key: `mine-${k.id}`, type: "mine" as T, acr: k.title.split(" · ")[0] ?? "", slug: "", what: k.title, start, startKey, endKey: startKey, ext: false, when: `${fmtLocal(k.startsAt, tz, false, t.intl)} ${cityOf(tz)}${k.detail ? ` · ${k.detail}` : ""}`, href: k.href ?? undefined };
    }),
    [tasks, tz, t],
  );
  const allEvs = follows.signedIn ? [...evs, ...mine] : evs;
  const shown = allEvs.filter((e) => types.includes(e.type));
  const onDay = (k: string) => shown.filter((e) => (e.type === "conf" ? k >= e.startKey && k <= e.endKey : e.startKey === k));

  const len = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleString(t.intl, { month: "long", year: "numeric", timeZone: "UTC" });
  const keyOf = (d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const monthCount = shown.filter((e) => e.startKey.startsWith(`${y}-${String(m).padStart(2, "0")}`)).length;
  const move = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setYm([d.getUTCFullYear(), d.getUTCMonth() + 1]); };

  const label = (e: Ev) => e.type === "mine" ? `★ ${e.what}` : `${e.acr}${e.ext ? ` · ${t("ext.")}` : ""}${TY[e.type].tag ? ` ${t(TY[e.type].tag.trim())}` : ""}`;
  const daysLeft = (e: Ev) => Math.floor((e.start - now) / DAY);
  const soonSub = (e: Ev) => e.type === "sub" && e.start > now && daysLeft(e) <= 7;

  const panel = sel ? onDay(sel) : shown.filter((e) => e.start >= now - DAY && e.start - now <= 14 * DAY).sort((a, b) => a.start - b.start);
  const selLabel = sel ? new Date(`${sel}T00:00:00Z`).toLocaleString(t.intl, { month: "short", day: "numeric", timeZone: "UTC" }) : "";

  // Per-filter feed: the venues currently shown + the public date types switched on.
  const feedTypes = PUBLIC_TYPES.filter((k) => types.includes(k));
  const feedQuery = new URLSearchParams();
  if (rows.length && rows.length <= 200) feedQuery.set("v", rows.map((r) => r.slug).join(","));
  if (feedTypes.length < PUBLIC_TYPES.length) feedQuery.set("types", feedTypes.join(","));
  const feedPath = `/feed/venues.ics${feedQuery.size ? `?${feedQuery.toString()}` : ""}`;
  const openGcal = () => {
    const webcal = `${window.location.origin.replace(/^https?:/, "webcal:")}${feedPath}`;
    window.open(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`, "_blank", "noopener,noreferrer");
  };
  const copyFeed = () => { void navigator.clipboard?.writeText(`${window.location.origin}${feedPath}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <>
      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("Show")}</span>
        {(Object.keys(TY) as T[]).filter((k) => k !== "mine" || follows.signedIn).map((k) => {
          const on = types.includes(k);
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => setTypes((a) => (on ? a.filter((x) => x !== k) : [...a, k]))}
              className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-[#121826]"
              style={{ background: on ? "#FFFFFF" : "#F5F6F3", border: `1px solid ${on ? "#B7BDC9" : "#DADDE3"}`, opacity: on ? 1 : 0.55 }}>
              <span aria-hidden className="box-border size-2.5 rounded-[2px]" style={{ background: TY[k].bg, border: TY[k].border }} />{t(TY[k].label)}
            </button>
          );
        })}
        {!follows.signedIn && follows.loaded ? <Link href="/sign-in?next=/venues?view=calendar" className="ml-1 text-[12px] text-[#2F5FD0] underline">{t("Sign in to see your own deadlines here")}</Link> : null}
      </div>
      <div className="mt-3 flex flex-col items-start gap-4 xl:flex-row">
        <div className="w-full min-w-0 flex-auto overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#DADDE3] px-3.5 py-2.5">
            <div className="flex gap-1.5">
              <button type="button" onClick={() => move(-1)} aria-label={t("Previous month")} className="size-8 rounded-[4px] border border-[#DADDE3] bg-white">‹</button>
              <button type="button" onClick={() => move(1)} aria-label={t("Next month")} className="size-8 rounded-[4px] border border-[#DADDE3] bg-white">›</button>
              <button type="button" onClick={() => { setYm(null); setSel(todayKey); }} className="h-8 rounded-[4px] border border-[#DADDE3] bg-white px-2.5 text-[13px] font-semibold">{t("Today")}</button>
            </div>
            <span className="font-serif text-[22px]">{monthLabel}</span>
            <span className="font-mono text-[12px] text-[#4A5263]">{monthCount} {monthCount === 1 ? "date" : "dates"} this month</span>
          </div>
          <div className="grid grid-cols-7 border-b border-[#EEF0EC] text-center font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} className="py-[7px]">{new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(t.intl, { weekday: "short", timeZone: "UTC" })}</span>)}
          </div>
          <div role="grid" aria-label={monthLabel} className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (!d) return <span key={`b${i}`} className="min-h-[104px] border-b border-r border-[#EEF0EC] bg-[#FBFBF9]" />;
              const k = keyOf(d);
              const items = onDay(k);
              const isToday = k === todayKey, past = k < todayKey, isSel = sel === k;
              return (
                <button key={k} type="button" onClick={() => setSel(k)} aria-pressed={isSel} aria-label={`${d} ${monthLabel}${items.length ? `, ${t("{n} dates", { n: items.length })}` : ""}`}
                  className="box-border flex min-h-[104px] min-w-0 flex-col items-stretch gap-[3px] border-0 border-b border-r border-solid border-[#EEF0EC] p-1.5 text-left"
                  style={{ background: isSel ? "#FFFBF3" : past ? "#FBFBF9" : "#FFFFFF", outline: isSel ? "2px solid #F2A93B" : "none", outlineOffset: -2 }}>
                  <span className="flex items-center justify-between">
                    <span className="flex size-6 items-center justify-center rounded-full font-mono text-[12px]" style={{ fontWeight: isToday ? 700 : 400, color: isToday ? "#FFFFFF" : past ? "#B7BDC9" : "#4A5263", background: isToday ? "#0E1B3D" : "transparent" }}>{d}</span>
                    {isToday ? <span className="hidden font-mono text-[10px] font-semibold text-[#0E1B3D] sm:inline">{t("TODAY")}</span> : null}
                  </span>
                  {items.slice(0, 3).map((e) => {
                    const soon = soonSub(e);
                    return <span key={e.key + k} className="block truncate rounded-[3px] px-1.5 py-0.5 text-[11px] font-semibold leading-[1.35]" style={{ background: soon ? "#F2A93B" : TY[e.type].bg, color: soon ? "#0E1B3D" : TY[e.type].ink, border: TY[e.type].border }}>{label(e)}</span>;
                  })}
                  {items.length > 3 ? <span className="text-[11px] font-semibold text-[#2F5FD0]">{t("+{n} more", { n: items.length - 3 })}</span> : null}
                </button>
              );
            })}
          </div>
          <p className="m-0 border-t border-[#EEF0EC] px-3.5 py-2.5 text-[12px] text-[#4A5263]">
            {t("Deadlines are placed on the day they close in your time ({city}). A 23:59 AoE deadline can land on the next day here.", { city: cityOf(tz) })}{" "}
            <a href={feedPath} className="text-[#2F5FD0] underline">{t("Subscribe (.ics)")}</a>{" · "}
            <button type="button" onClick={openGcal} className="border-0 bg-transparent p-0 text-[12px] text-[#2F5FD0] underline">{t("Add to Google Calendar")}</button>{" · "}
            <button type="button" onClick={copyFeed} className="border-0 bg-transparent p-0 text-[12px] text-[#2F5FD0] underline">{copied ? t("Link copied") : t("Copy feed link")}</button>
            <span className="block">{rows.length > 200 ? t("The feed follows every published venue.") : t("The feed follows the venues and date types shown now, and updates when organizers change dates.")}</span>
          </p>
        </div>

        <aside aria-label={sel ? selLabel : t("Next 14 days")} className="w-full rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5 xl:w-[300px] xl:flex-none">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="m-0 text-[16px] font-semibold">{sel ? `${selLabel}${sel === todayKey ? ` · ${t("today")}` : ""}` : t("Next 14 days")}</h3>
            {sel ? <button type="button" onClick={() => setSel("")} className="border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline">{t("Next 14 days")}</button> : null}
          </div>
          <p className="mt-0.5 text-[13px] text-[#4A5263]">{sel ? `${panel.length === 1 ? t("1 date") : t("{n} dates", { n: panel.length })} · ${t("times in {city}", { city: cityOf(tz) })}` : `${t("From today")} · ${panel.length === 1 ? t("1 date") : t("{n} dates", { n: panel.length })}`}</p>
          <ul className="m-0 mt-2.5 flex list-none flex-col gap-2.5 p-0">
            {panel.map((e) => {
              const soon = soonSub(e), left = daysLeft(e);
              return (
                <li key={e.key} className="rounded-[6px] border border-l-4 border-[#DADDE3] px-3 py-2.5" style={{ borderLeftColor: soon ? "#F2A93B" : TY[e.type].bar }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: e.type === "conf" ? "#0E1B3D" : TY[e.type].ink }}>{t(TY[e.type].kind)}{e.ext ? ` · ${t("EXTENDED")}` : ""}</span>
                    <span className="font-mono text-[12px] font-semibold" style={{ color: soon ? "#A8600F" : "#4A5263" }}>{e.start < now ? (e.type === "conf" ? t("now") : t("past")) : left === 0 ? t("today") : left === 1 ? t("in 1 day") : t("in {n} days", { n: left })}</span>
                  </div>
                  {e.type === "mine" ? <div className="mt-[3px] text-[14px] font-semibold">{e.what}</div> : <div className="mt-[3px] text-[14px] font-semibold">{e.acr} <span className="font-normal text-[#4A5263]">· {e.what}</span></div>}
                  {e.when ? <div className="text-[12px] text-[#4A5263]">{e.when}</div> : null}
                  <div className="mt-1.5 text-[13px]">{e.type === "mine" ? (e.href ? <Link href={e.href} className="font-semibold text-[#2F5FD0]">{t("Open →")}</Link> : null) : <Link href={`/venues/${e.slug}`} className="font-semibold text-[#2F5FD0]">{t("View call →")}</Link>}</div>
                </li>
              );
            })}
          </ul>
          {panel.length === 0 ? <p className="mt-2.5 text-[14px] text-[#4A5263]">{sel ? t("Nothing on this day.") : t("Nothing due in the next 14 days.")}</p> : null}
        </aside>
      </div>
    </>
  );
}
