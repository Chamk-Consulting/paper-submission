"use client";

import Link from "@/components/site/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Chips, EventSelect, NoMatch, Toolbar, matchWords, useUrlState } from "@/components/workspace/list-toolbar";
import type { TalkItem } from "@/lib/workspace/my-work";

/* My work › Talks & sessions: talks you give and sessions you chair, by date. Chips only (short list, fixed order). */

/** `when` is formatted on the server so the page never disagrees with itself on load. */
export type TalkRow = TalkItem & { when: string };

const btn = "inline-flex h-10 items-center rounded-[4px] px-3.5 text-[14px] no-underline";

/** Search and the Event filter appear once there is more than a handful. */
const SEARCH_FROM = 6;

export function TalksList({ items, generatedAt, init = {} }: { items: TalkRow[]; generatedAt: string; init?: { when?: string; role?: string; q?: string; event?: string } }) {
  const t = useT();
  const now = Date.parse(generatedAt);
  const isPast = (x: TalkRow) => Date.parse(x.endsAt) < now;
  const nPast = items.filter(isPast).length;
  const nUp = items.length - nPast;
  const [when, setWhen] = useState<"upcoming" | "past">(init.when === "past" && nPast ? "past" : nUp || !nPast ? "upcoming" : "past");
  const [role, setRole] = useState<"present" | "chair" | "all">(init.role === "present" || init.role === "chair" ? init.role : "all");
  const [q, setQ] = useState(init.q ?? "");
  const [event, setEvent] = useState(init.event ?? "");
  useUrlState({ when, role, q, event }, { when: "upcoming", role: "all", q: "", event: "" });
  const events = [...new Map(items.map((x) => [x.venueSlug, x.venueShort])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const searchable = items.length >= SEARCH_FROM;

  const inWhen = items.filter((x) => (when === "past" ? isPast(x) : !isPast(x)) && (!event || x.venueSlug === event));
  const list = inWhen.filter((x) => (role === "all" || x.kind === role) && matchWords([x.title, x.sessionTitle, x.code, x.venueShort, x.room ?? "", x.number ? `#${x.number}` : ""].join(" "), q));
  const clear = () => { setQ(""); setEvent(""); setRole("all"); };
  if (when === "past") list.reverse();
  const roles = ([["present", "Presenting", inWhen.filter((x) => x.kind === "present").length], ["chair", "Chairing", inWhen.filter((x) => x.kind === "chair").length]] as ["present" | "chair", string, number][]).filter((x) => x[2] > 0);

  if (!items.length) {
    return (
      <div className="rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-10 text-center text-[#4A5263]">
        {t("No talks or sessions yet. When your paper is placed in a program, or a program chair names you to chair a session, it shows up here.")}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {searchable ? (
        <Toolbar id="ts" q={q} setQ={setQ} sort="date" setSort={() => {}} sorts={[["date", "Date"]]} shown={list.length} total={inWhen.length}
          onClear={clear} active={!!q.trim() || !!event || role !== "all"} placeholder="Search by title, session, room or event" noun={["1 item", "{n} items"]}
          extra={<EventSelect value={event} onChange={setEvent} events={events} />} />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {nPast && nUp ? (
          <div role="tablist" aria-label={t("When")} className="inline-flex rounded-[6px] border border-[#DADDE3] bg-white p-0.5">
            {([["upcoming", "Upcoming", nUp], ["past", "Past", nPast]] as const).map(([k, l, n]) => (
              <button key={k} type="button" role="tab" aria-selected={when === k} onClick={() => { setWhen(k); setRole("all"); }}
                className={`h-8 cursor-pointer rounded-[4px] border-0 px-3 text-[13px] font-medium ${when === k ? "bg-[#0E1B3D] text-[#F5F6F3]" : "bg-transparent text-[#4A5263] hover:text-[#121826]"}`}>{t(l)} · {n}</button>
            ))}
          </div>
        ) : null}
        <Chips items={roles} value={role} onChange={setRole} all={inWhen.length} label="Role" />
      </div>
      {!list.length ? (searchable && (q.trim() || event) ? <NoMatch onClear={clear} text="Nothing matches." /> : <p className="m-0 rounded-[8px] border border-[#DADDE3] bg-white p-5 text-[14px] text-[#4A5263]">{t("Nothing here.")}</p>) : null}
      <ul className={`m-0 flex list-none flex-col gap-3 p-0 ${when === "past" ? "opacity-85" : ""}`}>
        {list.map((x) => {
          const time = `${x.when} · ${x.room ?? t("Room to be announced")}`;
          if (x.kind === "chair") {
            const ok = (x.total ?? 0) > 0 && x.ready === x.total;
            return (
              <li key={x.id} className="rounded-[8px] border border-[#DADDE3] bg-white px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]"><span className="text-[#A8600F]">{t("Chairing")}</span> · {x.code} · {x.venueShort}</p>
                    <Link href={`/chair/${x.sessionId}`} className="mt-1 block font-serif text-[22px] leading-[1.2] text-[#121826] no-underline hover:underline">{x.sessionTitle}</Link>
                    <p className="m-0 mt-1 text-[14px] text-[#4A5263]">{time}</p>
                  </div>
                  <span className="rounded-[4px] px-2.5 py-1 text-[13px] font-semibold" style={{ background: ok ? "#E1F3EA" : "#FBEFDD", color: ok ? "#14603F" : "#7A4508" }}>{t("{n}/{total} presenters ready", { n: x.ready ?? 0, total: x.total ?? 0 })}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/chair/${x.sessionId}`} className={`${btn} border border-[#B7BDC9] bg-white font-medium text-[#121826]`}>{t("Run sheet")}</Link>
                  <Link href={`/chair/${x.sessionId}?view=live`} className={`${btn} bg-[#0E1B3D] font-semibold text-white`}>{t("On the day")}</Link>
                </div>
              </li>
            );
          }
          return (
            <li key={x.id} className="rounded-[8px] border border-[#DADDE3] bg-white px-5 py-4">
              <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]"><span className="text-[#1F47A8]">{t("Presenting")}</span> · {x.code} · {x.venueShort}{x.number ? ` · #${x.number}` : ""}</p>
              {x.submissionId
                ? <Link href={`/submissions/${x.submissionId}`} className="mt-1 block font-serif text-[22px] leading-[1.2] text-[#121826] no-underline hover:underline">{x.title}</Link>
                : <p className="m-0 mt-1 font-serif text-[22px] leading-[1.2]">{x.title}</p>}
              <p className="m-0 mt-1 text-[14px] text-[#4A5263]">{time}</p>
              <p className="m-0 mt-0.5 text-[13px] text-[#4A5263]">{t("In session: {name}", { name: x.sessionTitle })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {x.submissionId ? <Link href={`/submissions/${x.submissionId}`} className={`${btn} border border-[#B7BDC9] bg-white font-medium text-[#121826]`}>{t("My paper")}</Link> : null}
                <Link href={`/workspace/events/${x.venueSlug}/program`} className={`${btn} border border-[#B7BDC9] bg-white font-medium text-[#121826]`}>{t("Session in the program")}</Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
