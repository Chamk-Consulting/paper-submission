"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { newFeed, saveFeedFlags, type AccountState } from "@/lib/account/actions";
import type { CalItem, FeedFlags } from "@/lib/account/data";
import { sx } from "@/components/account/styles";

/* Canvas CL01 — Add deadlines to my calendar. The feed address exists only in this browser tab right after it is made. */

const INCLUDE: [keyof FeedFlags, string, string][] = [
  ["submissions", "My submission deadlines", "Papers, revisions, final versions — {n} events"],
  ["reviews", "My review due dates", "{n} events"],
  ["sessions", "Sessions I present or chair", "{n} events"],
  ["followed", "Deadlines of venues I follow", "{n} events"],
];
const small = "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#F7F8F6] disabled:opacity-60";
const link = "border-0 bg-transparent p-0 text-[12px] text-[#2F5FD0] underline disabled:opacity-60";

export function CalendarFeed({ hasFeed, since, initialFlags, items, timezone }: { hasFeed: boolean; since: string | null; initialFlags: FeedFlags; items: CalItem[]; timezone: string | null }) {
  const t = useT();
  const [flags, setFlags] = useState(initialFlags);
  const [url, setUrl] = useState<string | null>(null);
  const [exists, setExists] = useState(hasFeed);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<AccountState | null>(null);
  const [pending, start] = useTransition();
  const tz = timezone || undefined;

  const counts = Object.fromEntries(INCLUDE.map(([k]) => [k, items.filter((i) => i.category === k).length])) as Record<keyof FeedFlags, number>;
  const shown = items.filter((i) => flags[i.category]);
  const upcoming = shown.slice(0, 6); // items arrive sorted, past ones already dropped
  const fmtDay = new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", timeZone: tz });
  const fmtTime = new Intl.DateTimeFormat(t.intl, { hour: "2-digit", minute: "2-digit", timeZone: tz });

  const toggle = (k: keyof FeedFlags) => {
    const next = { ...flags, [k]: !flags[k] };
    setFlags(next);
    setCopied(false);
    if (exists) start(async () => setMsg(await saveFeedFlags(next)));
  };
  const make = () => start(async () => {
    const r = await newFeed(flags);
    setMsg(r);
    if (r.url) { setUrl(r.url); setExists(true); setCopied(false); }
  });
  const webcal = url ? url.replace(/^https?:/, "webcal:") : null;
  const copy = async () => {
    if (!webcal) return;
    try { await navigator.clipboard.writeText(webcal); setCopied(true); } catch { setCopied(false); }
  };
  const apps: [string, string | null][] = [
    ["Google Calendar", webcal ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` : null],
    ["Outlook", url ? `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=${encodeURIComponent("Plenary deadlines")}` : null],
    ["Apple Calendar", webcal],
  ];
  const ics = `/feed/me?${new URLSearchParams(Object.entries(flags).map(([k, v]) => [k, v ? "1" : "0"])).toString()}`;

  return (
    <div className="mt-6 flex flex-col items-start gap-6 lg:flex-row">
      <div className="flex w-full min-w-0 max-w-[760px] flex-auto flex-col gap-[18px]">
        <section className={sx.card}>
          <h2 className={sx.h2}>{t("1 · What to include")}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {INCLUDE.map(([k, title, detail]) => (
              <label key={k} className="flex cursor-pointer items-start gap-3 rounded-[6px] border border-[#DADDE3] bg-white px-3.5 py-3 has-[:checked]:border-[#B9E0CB] has-[:checked]:bg-[#F3FAF6]">
                <input type="checkbox" checked={flags[k]} onChange={() => toggle(k)} className="peer sr-only" />
                <span aria-hidden className="mt-px flex size-5 flex-none items-center justify-center rounded-[3px] border-[1.5px] border-[#8A93A6] bg-white text-[13px] font-bold text-white peer-checked:border-0 peer-checked:bg-[#18744F] peer-focus-visible:outline-2 peer-focus-visible:outline-[#2F5FD0] [&>span]:hidden peer-checked:[&>span]:inline"><span>✓</span></span>
                <span className="text-[14px]">{t(title)}<span className="block text-[13px] text-[#4A5263]">{t(detail, { n: counts[k] })}</span></span>
              </label>
            ))}
          </div>
          {msg?.error ? <p role="alert" className="mb-0 mt-2 text-[13px] text-[#B3261E]">{t(msg.error)}</p> : exists && msg?.savedAt && !url ? <p role="status" className="mb-0 mt-2 text-[13px] text-[#14603F]">{t("Feed updated. Calendar apps pick up changes within a few hours.")}</p> : null}
        </section>

        <section className={sx.card}>
          <h2 className={sx.h2}>{t("2 · Add to your calendar app")}</h2>
          {!exists ? (
            <div className="mt-3">
              <p className="m-0 text-[14px] text-[#4A5263]">{t("Make your private feed address first. You can replace it at any time.")}</p>
              <button type="button" onClick={make} disabled={pending} className="mt-3 inline-flex h-[42px] items-center rounded-[4px] border-0 bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white disabled:opacity-60">{pending ? t("Making…") : t("Make my feed address")}</button>
            </div>
          ) : (
            <>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {apps.map(([name, href]) => href
                  ? <a key={name} href={href} target={name === "Apple Calendar" ? undefined : "_blank"} rel="noopener noreferrer" className={`${small} h-11`}>{t(name)}</a>
                  : <span key={name} aria-disabled className={`${small} h-11 text-[#6B7385]!`}>{t(name)}</span>)}
              </div>
              <p className="mb-1.5 mt-3.5 text-[14px] font-medium">{t("Or copy the feed address")}</p>
              {url ? (
                <div className="flex gap-2">
                  <input readOnly value={webcal ?? ""} aria-label={t("Calendar feed address")} onFocus={(e) => e.currentTarget.select()} className={`${sx.input} flex-auto font-mono text-[13px]`} />
                  <button type="button" onClick={copy} className="inline-flex h-[42px] flex-none items-center rounded-[4px] border-0 bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white">{copied ? t("Copied") : t("Copy")}</button>
                </div>
              ) : (
                <p className="m-0 rounded-[6px] border border-[#DADDE3] bg-[#F7F8F6] px-3 py-2.5 text-[13px] text-[#4A5263]">
                  {t("Your feed is on{since}. For your privacy we only show the address once, when it is made.", { since: since ? ` · ${t("since {date}", { date: fmtDay.format(new Date(since)) })}` : "" })}{" "}
                  {t("To add it to another app, make a new address — the old one stops working.")}
                </p>
              )}
              <p className="mb-0 mt-2 text-[12px] text-[#4A5263]">
                {t("Keep this address private — anyone with it can see your deadlines.")}{" "}
                <button type="button" onClick={make} disabled={pending} className={link}>{pending ? t("Making…") : t("Make a new address")}</button>
              </p>
              {url && msg?.savedAt ? <p role="status" className="mb-0 mt-1.5 text-[12px] text-[#14603F]">{t("New address made. Any older address has stopped working.")}</p> : null}
            </>
          )}
        </section>

        <section className={sx.card}>
          <h2 className={sx.h2}>{t("Preview · next events in the feed")}</h2>
          {upcoming.length === 0 ? <p className="mb-0 mt-3 text-[14px] text-[#4A5263]">{t("Nothing coming up yet. Deadlines appear here as soon as you submit, review or follow a venue.")}</p> : upcoming.map((e) => {
            const d = new Date(e.starts_at);
            const timed = e.category === "sessions";
            return (
              <div key={e.uid} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-t border-[#EEF0EC] py-2.5 text-[14px] first-of-type:mt-3">
                <span className="font-mono text-[13px] text-[#4A5263]">{fmtDay.format(d)}{timed ? ` ${fmtTime.format(d)}` : ""}</span>
                <span className="min-w-0"><strong className="break-words">{e.title}</strong>{e.description || e.location ? <span className="block truncate text-[12px] text-[#4A5263]">{[e.location, e.description].filter(Boolean).join(" · ")}</span> : null}</span>
              </div>
            );
          })}
        </section>
      </div>

      <aside className="flex w-full flex-col gap-4 lg:w-[300px] lg:flex-none">
        <section className="rounded-[8px] bg-[#0E1B3D] px-5 py-[18px] text-[#F5F6F3]">
          <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#F2A93B]">{t("In the feed")}</p>
          <div className="mt-1.5 font-serif text-[34px]">{shown.length}</div>
          <p className="m-0 text-[13px] text-[#B9C3DA]">{t("events · times in AoE with your local time in the description")}</p>
        </section>
        <section className="rounded-[8px] border border-[#DADDE3] bg-white px-5 py-[18px]">
          <p className="mb-2 mt-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("One-off download")}</p>
          <p className="m-0 text-[14px] text-[#4A5263]">{t("Prefer a file? It won't update when dates change.")}</p>
          <a href={ics} download className={`${small} mt-2.5`}>{t("Download .ics")}</a>
        </section>
      </aside>
    </div>
  );
}
