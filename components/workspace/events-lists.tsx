"use client";

import { Award, BadgeCheck, CalendarPlus, CalendarRange, FileCheck, Gauge, Receipt, Ticket, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";
import { useClock } from "@/components/venues/use-clock";
import { DeadlineStrip, FollowButton } from "@/components/venues/venue-live";
import { fmtRange, statusOf } from "@/lib/venues/time";
import { STAGE_LABEL, STAGE_TONE, primaryAction, roleChips } from "@/lib/workspace/event-action";
import type { EventRow } from "@/lib/workspace/events-pages";

/* Events › My events, Following, Past events. One look for all three: a white card per event in one column. */

const ORGANIZER = /^(owner|chair|program_chair|deputy_chair|ceb_chair|publication_chair|registration_chair|staff)$/;
const card = "rounded-[8px] border border-[#DADDE3] bg-white p-[18px] shadow-[0_1px_0_rgba(18,24,38,.04)]";
const chipBtn = (on: boolean) => `inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] ${on ? "border-[#0E1B3D] bg-[#0E1B3D] font-semibold text-white" : "border-[#DADDE3] bg-white text-[#121826] hover:border-[#B7BDC9]"}`;
const linkCls = "inline-flex h-9 items-center gap-1.5 rounded-[6px] px-2.5 text-[14px] text-[#121826] no-underline hover:bg-[#F5F6F3]";
const primary = "inline-flex h-10 items-center whitespace-nowrap rounded-[4px] px-3.5 text-[14px] font-semibold no-underline";

type Kind = "author" | "reviewer" | "chair" | "organiser" | "attending";
const KINDS: [Kind, string][] = [["author", "As author"], ["reviewer", "As reviewer"], ["chair", "Chairing a session"], ["organiser", "Organising"], ["attending", "Attending"]];
function kindsOf(r: EventRow): Kind[] {
  const roles = r.mine?.roles ?? [];
  const out: Kind[] = [];
  if (r.mine?.papers.length) out.push("author");
  if (roles.some((x) => x === "reviewer" || x === "associate_editor")) out.push("reviewer");
  if (roles.includes("session_chair")) out.push("chair");
  if (roles.some((x) => ORGANIZER.test(x))) out.push("organiser");
  if (r.reg) out.push("attending");
  return out;
}

function Head({ v }: { v: EventRow["v"] }) {
  const t = useT();
  return (
    <>
      <p className="m-0 font-mono text-[12px] text-[#4A5263]">{v.acr}</p>
      <h2 className="m-0 mt-0.5 text-[17px] font-semibold leading-[1.3]">
        <Link href={`/workspace/events/${v.slug}`} className="text-[#121826] no-underline hover:underline">{v.name}</Link>
      </h2>
      <p className="m-0 mt-0.5 text-[13px] text-[#4A5263]">{[fmtRange(v.startsOn, v.endsOn, t.intl, t, v.kind === "journal"), v.location].filter(Boolean).join(" · ")}</p>
    </>
  );
}

function Chips<K extends string>({ items, value, onChange, all }: { items: [K, string, number][]; value: K | "all"; onChange: (k: K | "all") => void; all: number }) {
  const t = useT();
  if (items.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Show")}>
      <button type="button" aria-pressed={value === "all"} onClick={() => onChange("all")} className={chipBtn(value === "all")}>{t("All")} <span className="opacity-70">{all}</span></button>
      {items.map(([k, label, n]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className={chipBtn(value === k)}>{t(label)} <span className="opacity-70">{n}</span></button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- search, sort, filter (shared) */
const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);
/** Every word must appear somewhere: acronym, name, place, field, society, your roles, your paper titles and numbers. */
function matches(r: EventRow, q: string) {
  const w = words(q);
  if (!w.length) return true;
  const v = r.v;
  const hay = [v.acr, v.name, v.location, v.city, v.country, v.field, v.society, v.kind, ...(r.mine?.roles ?? []), ...roleChips(r.mine?.roles ?? []),
    ...(r.mine?.papers ?? []).flatMap((p) => [p.title, p.number ? `#${p.number}` : ""]), (v.startsOn ?? "").slice(0, 4)].join(" ").toLowerCase();
  return w.every((x) => hay.includes(x));
}
const nextMs = (r: EventRow, now: number) => { const d = r.v.dates.find((x) => Date.parse(x.startsAt) > now); return d ? Date.parse(d.startsAt) : Number.MAX_SAFE_INTEGER; };
const startMs = (r: EventRow) => (r.v.startsOn ? Date.parse(r.v.startsOn) : Number.MAX_SAFE_INTEGER);
const endKey = (r: EventRow) => r.v.endsOn ?? r.v.startsOn ?? "";
const byName = (a: EventRow, b: EventRow) => a.v.acr.localeCompare(b.v.acr);

function Toolbar<S extends string>({ id, q, setQ, sort, setSort, sorts, shown, total, onClear, active, placeholder }: {
  id: string; q: string; setQ: (v: string) => void; sort: S; setSort: (v: S) => void; sorts: [S, string][]; shown: number; total: number; onClear: () => void; active: boolean; placeholder: string;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div role="search" className="flex h-10 min-w-[220px] flex-[1_1_320px] items-center gap-2 rounded-[6px] border border-[#B7BDC9] bg-white px-3 focus-within:border-[#2F5FD0]">
          <Search size={16} strokeWidth={1.75} aria-hidden className="flex-none text-[#4A5263]" />
          <label htmlFor={`${id}-q`} className="sr-only">{t("Search")}</label>
          <input id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(placeholder)}
            className="h-9 min-w-0 flex-auto border-0 bg-transparent text-[14px] text-[#121826] outline-none" />
        </div>
        <select aria-label={t("Sort")} value={sort} onChange={(e) => setSort(e.target.value as S)}
          className="h-10 cursor-pointer rounded-[6px] border border-[#B7BDC9] bg-white px-2.5 text-[14px] text-[#121826] hover:border-[#8A93A6]">
          {sorts.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
        </select>
      </div>
      <p aria-live="polite" className="m-0 text-[13px] text-[#4A5263]">
        {active ? t("Showing {n} of {total}", { n: shown, total }) : (total === 1 ? t("1 event") : t("{n} events", { n: total }))}
        {active ? <> · <button type="button" onClick={onClear} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-[#2F5FD0] underline">{t("Clear")}</button></> : null}
      </p>
    </div>
  );
}

function NoMatch({ onClear }: { onClear: () => void }) {
  const t = useT();
  return (
    <div className={`${card} text-[14px] text-[#4A5263]`}>
      {t("No events match.")} <button type="button" onClick={onClear} className="cursor-pointer border-0 bg-transparent p-0 text-[14px] font-semibold text-[#2F5FD0] underline">{t("Clear search and filters")}</button>
    </div>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  const t = useT();
  return (
    <div className={`${card} text-[14px] text-[#4A5263]`}>
      {t(text)} <Link href={href} className="font-semibold text-[#2F5FD0]">{t(cta)}</Link>
    </div>
  );
}

/* ---------------------------------------------------------------- My events */
export function MyEventsList({ rows, generatedAt }: { rows: EventRow[]; generatedAt: string }) {
  const t = useT();
  const { now, tz } = useClock(generatedAt);
  const [k, setK] = useState<Kind | "all">("all");
  const [q, setQ] = useState("");
  const [todo, setTodo] = useState(false);
  const [sort, setSort] = useState<"next" | "start" | "name" | "papers">("next");
  const needs = (r: EventRow) => (r.mine?.papers ?? []).some((p) => ["draft", "revise", "final"].includes(p.stage)) || (!!r.reg && !r.reg.paid);
  const counts = KINDS.map(([key, label]) => [key, label, rows.filter((r) => kindsOf(r).includes(key)).length] as [Kind, string, number]).filter((x) => x[2] > 0);
  const nNeeds = rows.filter(needs).length;
  const order = { next: (a: EventRow, b: EventRow) => nextMs(a, now) - nextMs(b, now), start: (a: EventRow, b: EventRow) => startMs(a) - startMs(b), name: byName,
    papers: (a: EventRow, b: EventRow) => (b.mine?.papers.length ?? 0) - (a.mine?.papers.length ?? 0) }[sort];
  const shown = rows.filter((r) => (k === "all" || kindsOf(r).includes(k)) && (!todo || needs(r)) && matches(r, q)).sort(order);
  const active = k !== "all" || todo || !!q.trim();
  const clear = () => { setK("all"); setTodo(false); setQ(""); };
  if (!rows.length) return <Empty text="You’re not part of any event yet. Submit a paper, review, or register to attend, and it appears here." href="/workspace/events" cta="Explore events" />;
  return (
    <div className="flex flex-col gap-3.5">
      <Toolbar id="me" q={q} setQ={setQ} sort={sort} setSort={setSort} shown={shown.length} total={rows.length} onClear={clear} active={active}
        placeholder="Search by event, place, role or paper title"
        sorts={[["next", "Next deadline"], ["start", "Starting soonest"], ["name", "Name (A–Z)"], ["papers", "Most papers"]]} />
      <div className="flex flex-wrap items-center gap-1.5">
        {nNeeds ? <button type="button" aria-pressed={todo} onClick={() => setTodo(!todo)} className={`${chipBtn(todo)} ${todo ? "" : "border-[#F2C98A]! bg-[#FFF6E6]! text-[#7A4508]!"}`}>{t("Needs action")} <span className="opacity-70">{nNeeds}</span></button> : null}
        <Chips items={counts} value={k} onChange={setK} all={rows.length} />
      </div>
      {!shown.length ? <NoMatch onClear={clear} /> : null}
      {shown.map((r) => {
        const v = r.v;
        const st = statusOf(v, now, tz, t, t.intl);
        const open = ["soon", "open", "later", "rolling"].includes(st.state) && st.closes !== "—";
        const act = primaryAction(v.slug, r.mine ?? undefined, open);
        const roles = [...(r.mine?.papers.length ? ["Author"] : []), ...roleChips(r.mine?.roles ?? []), ...(r.reg ? ["Attending"] : [])];
        const organiser = r.mine?.roles.some((x) => ORGANIZER.test(x));
        const papers = r.mine?.papers ?? [];
        return (
          <article key={v.slug} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-auto"><Head v={v} /></div>
              <Link href={act.href} className={`${primary} ${act.label === "View event" ? "border border-[#B7BDC9] bg-white text-[#0E1B3D] hover:bg-[#F7F8F6]" : "bg-[#F2A93B] text-[#0E1B3D] hover:bg-[#E89B26]"}`}>{t(act.label)}</Link>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {roles.map((x) => <span key={x} className="rounded-full bg-[#0E1B3D] px-2.5 py-0.5 text-[12px] font-semibold text-white">{t(x)}</span>)}
            </div>
            <div className="mt-2.5"><DeadlineStrip dates={v.dates} generatedAt={generatedAt} /></div>
            {papers.length ? (
              <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
                {papers.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <Link href={p.href} className="flex items-center gap-2.5 rounded-[6px] border border-[#EEF0EC] px-3 py-2 text-[14px] text-[#121826] no-underline hover:border-[#B7BDC9]">
                      <span className="flex-none rounded-full px-2 py-px text-[11px] font-semibold" style={{ background: STAGE_TONE[p.stage][0], color: STAGE_TONE[p.stage][1] }}>{t(STAGE_LABEL[p.stage])}</span>
                      <span className="min-w-0 flex-auto truncate">{p.title || t("Untitled paper")}</span>
                      {p.detail ? <span className="hidden flex-none text-[12px] text-[#4A5263] sm:inline">{t(p.detail)}</span> : null}
                    </Link>
                  </li>
                ))}
                {papers.length > 3 ? <li className="text-[13px] text-[#4A5263]">{t("+{n} more papers", { n: papers.length - 3 })}</li> : null}
              </ul>
            ) : null}
            <p className={`m-0 mt-3 text-[13px] ${r.reg ? (r.reg.paid ? "text-[#14603F]" : "text-[#7A4508]") : "text-[#4A5263]"}`}>
              {r.reg ? (r.reg.paid ? `✓ ${t("Registered")} · ${t("Badge ready")}` : t("Registration awaiting payment")) : t("Not registered yet")}
            </p>
            <nav aria-label={t("Pages for {event}", { event: v.acr })} className="mt-2 flex flex-wrap gap-0.5 border-t border-[#EEF0EC] pt-2">
              <Link href={`/workspace/events/${v.slug}`} className={linkCls}><CalendarRange size={15} aria-hidden className="text-[#4A5263]" />{t("Event page")}</Link>
              {r.mine?.roles.length ? <Link href={`/venues/${v.slug}/me`} className={linkCls}><UserRound size={15} aria-hidden className="text-[#4A5263]" />{t("My page")}</Link> : null}
              <Link href={`/workspace/events/${v.slug}/program`} className={linkCls}><CalendarRange size={15} aria-hidden className="text-[#4A5263]" />{t("Program")}</Link>
              {r.reg ? (r.reg.paid ? <Link href={`/venues/${v.slug}/badge`} className={linkCls}><BadgeCheck size={15} aria-hidden className="text-[#4A5263]" />{t("Badge")}</Link> : null)
                : <Link href={`/venues/${v.slug}/register`} className={linkCls}><Ticket size={15} aria-hidden className="text-[#4A5263]" />{t("Register")}</Link>}
              {organiser ? <Link href={`/manage/${v.slug}`} className={linkCls}><Gauge size={15} aria-hidden className="text-[#4A5263]" />{t("Event dashboard")}</Link> : null}
            </nav>
          </article>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Following */
export function FollowingList({ rows, generatedAt }: { rows: EventRow[]; generatedAt: string }) {
  const t = useT();
  const { now, tz } = useClock(generatedAt);
  const withSt = useMemo(() => rows.map((r) => {
    const st = statusOf(r.v, now, tz, t, t.intl);
    return { r, open: ["soon", "open", "later", "rolling"].includes(st.state) && st.closes !== "—" };
  }), [rows, now, tz, t]);
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "open" | "d30" | "online">("all");
  const [sort, setSort] = useState<"next" | "start" | "name">("next");
  if (!rows.length) return <Empty text="Follow events to keep their deadlines here." href="/workspace/events" cta="Explore events" />;
  const soon = (x: { r: EventRow }) => nextMs(x.r, now) - now <= 30 * 86_400_000;
  const online = (x: { r: EventRow }) => x.r.v.format === "online" || x.r.v.format === "hybrid";
  const test = { all: () => true, open: (x: { open: boolean }) => x.open, d30: soon, online }[f] as (x: { r: EventRow; open: boolean }) => boolean;
  const order = { next: (a: { r: EventRow }, b: { r: EventRow }) => nextMs(a.r, now) - nextMs(b.r, now), start: (a: { r: EventRow }, b: { r: EventRow }) => startMs(a.r) - startMs(b.r), name: (a: { r: EventRow }, b: { r: EventRow }) => byName(a.r, b.r) }[sort];
  const kept = withSt.filter((x) => test(x) && matches(x.r, q)).sort(order);
  const active = f !== "all" || !!q.trim();
  const clear = () => { setF("all"); setQ(""); };
  const fl: ["open" | "d30" | "online", string, number][] = ([["open", "Open for papers", withSt.filter((x) => x.open).length], ["d30", "Deadline within 30 days", withSt.filter(soon).length], ["online", "Online or hybrid", withSt.filter(online).length]] as ["open" | "d30" | "online", string, number][]).filter((x) => x[2] > 0);
  const groups: [string, typeof withSt][] = [["Open for papers", kept.filter((x) => x.open)], ["Other events you follow", kept.filter((x) => !x.open)]];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <Toolbar id="fo" q={q} setQ={setQ} sort={sort} setSort={setSort} shown={kept.length} total={rows.length} onClear={clear} active={active}
          placeholder="Search by event, place or field" sorts={[["next", "Next deadline"], ["start", "Starting soonest"], ["name", "Name (A–Z)"]]} />
        <Chips items={fl} value={f} onChange={setF} all={rows.length} />
      </div>
      {!kept.length ? <NoMatch onClear={clear} /> : null}
      {groups.map(([title, list]) => list.length ? (
        <section key={title} aria-label={t(title)}>
          <h2 className="m-0 mb-2.5 text-[14px] font-semibold text-[#4A5263]">{t(title)} <span className="font-normal">· {list.length}</span></h2>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {list.map(({ r, open }) => (
              <li key={r.v.slug} className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-auto"><Head v={r.v} /></div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${open ? "bg-[#E1F3EA] text-[#14603F]" : "bg-[#EEF0EC] text-[#4A5263]"}`}>{open ? t("Open for papers") : t("No open call")}</span>
                </div>
                <div className="mt-2.5"><DeadlineStrip dates={r.v.dates} generatedAt={generatedAt} /></div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#EEF0EC] pt-3">
                  {open ? <Link href={`/submit/${r.v.slug}`} className={`${primary} bg-[#F2A93B] text-[#0E1B3D] hover:bg-[#E89B26]`}>{t("Submit a paper")}</Link> : null}
                  <Link href={`/workspace/events/${r.v.slug}`} className={`${primary} border border-[#B7BDC9] bg-white text-[#0E1B3D] hover:bg-[#F7F8F6]`}>{t("View event")}</Link>
                  <a href={`/venues/${r.v.slug}/calendar.ics`} className={linkCls}><CalendarPlus size={15} aria-hidden className="text-[#4A5263]" />{t("Add deadlines to calendar")}</a>
                  <span className="ms-auto"><FollowButton venueId={r.v.id} slug={r.v.slug} compact /></span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null)}
    </div>
  );
}

/* ---------------------------------------------------------------- Past events */
export function PastList({ rows }: { rows: EventRow[] }) {
  const t = useT();
  const years = [...new Set(rows.map((r) => (r.v.endsOn ?? r.v.startsOn ?? "").slice(0, 4)).filter(Boolean))].sort().reverse();
  const [year, setYear] = useState<string | "all">("all");
  const [who, setWho] = useState<"all" | "yours" | "followed">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "oldest" | "name">("recent");
  if (!rows.length) return <Empty text="Events you took part in or followed appear here after they end." href="/workspace/events" cta="Explore events" />;
  const yours = (r: EventRow) => !!r.mine || !!r.reg;
  const order = { recent: (a: EventRow, b: EventRow) => endKey(b).localeCompare(endKey(a)), oldest: (a: EventRow, b: EventRow) => endKey(a).localeCompare(endKey(b)), name: byName }[sort];
  const shown = rows.filter((r) => (year === "all" || endKey(r).startsWith(year)) && (who === "all" || (who === "yours" ? yours(r) : r.following && !yours(r))) && matches(r, q)).sort(order);
  const active = year !== "all" || who !== "all" || !!q.trim();
  const clear = () => { setYear("all"); setWho("all"); setQ(""); };
  return (
    <div className="flex flex-col gap-3.5">
      <Toolbar id="pa" q={q} setQ={setQ} sort={sort} setSort={setSort} shown={shown.length} total={rows.length} onClear={clear} active={active}
        placeholder="Search by event, place, year or paper title" sorts={[["recent", "Most recent"], ["oldest", "Oldest first"], ["name", "Name (A–Z)"]]} />
      {!shown.length ? <NoMatch onClear={clear} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Chips items={years.map((y) => [y, y, rows.filter((r) => (r.v.endsOn ?? r.v.startsOn ?? "").startsWith(y)).length] as [string, string, number])} value={year} onChange={setYear} all={rows.length} />
        <Chips items={([["yours", "Yours", rows.filter(yours).length], ["followed", "Followed", rows.filter((r) => r.following && !yours(r)).length]] as ["yours" | "followed", string, number][]).filter((x) => x[2] > 0)} value={who} onChange={setWho} all={rows.length} />
      </div>
      {shown.map((r) => {
        const v = r.v;
        const finals = (r.mine?.papers ?? []).filter((p) => p.stage === "final" || p.stage === "done");
        const reviewer = r.mine?.roles.some((x) => x === "reviewer" || x === "associate_editor");
        const roles = [...(r.mine?.papers.length ? ["Author"] : []), ...roleChips(r.mine?.roles ?? []), ...(r.reg ? ["Attended"] : []), ...(!yours(r) && r.following ? ["Followed"] : [])];
        const keep: { href: string; label: string; icon: typeof Award; dl?: boolean }[] = [
          ...(reviewer ? [{ href: `/api/reviews/certificate/${v.slug}`, label: "Reviewer certificate", icon: Award, dl: true }] : []),
          ...finals.map((p) => ({ href: p.href, label: finals.length > 1 ? `${t("Final paper")} #${p.number ?? ""}` : "Final paper", icon: FileCheck })),
          ...(r.reg?.invoice ? [{ href: `/venues/${v.slug}/register/document?r=${r.reg.id}&kind=invoice`, label: "Invoice", icon: Receipt, dl: true }] : []),
          ...(r.reg?.paid ? [{ href: `/venues/${v.slug}/register/document?r=${r.reg.id}&kind=receipt`, label: "Receipt", icon: Receipt, dl: true }] : []),
          { href: `/workspace/events/${v.slug}/program`, label: "Program", icon: CalendarRange },
        ];
        return (
          <article key={v.slug} className={card}>
            <Head v={v} />
            {roles.length ? <div className="mt-2.5 flex flex-wrap gap-1.5">{roles.map((x) => <span key={x} className="rounded-full bg-[#EEF0EC] px-2.5 py-0.5 text-[12px] font-semibold text-[#121826]">{t(x)}</span>)}</div> : null}
            <nav aria-label={t("Keep from {event}", { event: v.acr })} className="mt-3 flex flex-wrap gap-0.5 border-t border-[#EEF0EC] pt-2">
              {keep.map((k) => {
                const Icon = k.icon;
                return k.dl
                  ? <a key={k.label} href={k.href} className={linkCls}><Icon size={15} aria-hidden className="text-[#4A5263]" />{t(k.label)}</a>
                  : <Link key={k.label} href={k.href} className={linkCls}><Icon size={15} aria-hidden className="text-[#4A5263]" />{t(k.label)}</Link>;
              })}
            </nav>
          </article>
        );
      })}
    </div>
  );
}
