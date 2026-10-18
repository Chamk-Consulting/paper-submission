"use client";

import Link from "next/link";
import { ViewTransition, startTransition, useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { VT } from "@/lib/motion";
import { PublicFooter, PublicHeader } from "@/components/venues/public-header";
import dynamic from "next/dynamic";
import { useT } from "@/lib/i18n/client";
import { useClock, useFollows } from "@/components/venues/use-clock";
import { FIELD_COLOR, FIELD_LABEL, FORMAT_LABEL, KIND_LABEL, type DirectoryVenue, type Field } from "@/lib/venues/types";
import { cityOf, fmtRange, statusOf, type Status } from "@/lib/venues/time";

type View = "list" | "calendar" | "map" | "past";
type Win = "any" | "d7" | "d30" | "open";
const VIEWS: [View, string][] = [["list", "List"], ["calendar", "Deadline calendar"], ["map", "Map"], ["past", "Past venues"]];
const FIELDS: ["all" | Field, string][] = [["all", "All fields"], ["control", "Control"], ["robotics", "Robotics"], ["ocean", "Ocean engineering"], ["systems", "Systems & decision"]];
const WINDOWS: [Win, string][] = [["any", "Any time"], ["d7", "Closes within 7 days"], ["d30", "Closes within 30 days"], ["open", "Open for submission now"]];
const REGIONS = ["Europe", "Americas", "Asia–Pacific", "Africa & Middle East", "Online"];

export type Row = DirectoryVenue & { st: Status; past: boolean };

// Lazy: each tab's code downloads on its own, preloaded in idle time so switching tabs is instant.
const preloadTabs = () => { void import("@/components/venues/calendar-view"); void import("@/components/venues/map-view"); void import("@/components/venues/past-view"); };

/** State whose updates run in a transition, so the list animates (cards glide, enter and leave). */
function useSoftState<T>(init: T) {
  const [v, set] = useState(init);
  const soft = useCallback((x: SetStateAction<T>) => startTransition(() => set(x)), []);
  return [v, soft] as const;
}
const TabSkeleton = ({ h }: { h: number }) => <div aria-busy="true" className="mt-3.5 w-full animate-pulse rounded-[8px] border border-[#DADDE3] bg-white" style={{ height: h }} />;
const CalendarView = dynamic(() => import("@/components/venues/calendar-view").then((m) => m.CalendarView), { loading: () => <TabSkeleton h={760} /> });
const MapView = dynamic(() => import("@/components/venues/map-view").then((m) => m.MapView), { loading: () => <TabSkeleton h={520} /> });
const PastView = dynamic(() => import("@/components/venues/past-view").then((m) => m.PastView), { loading: () => <TabSkeleton h={360} /> });

const kicker = "m-0 mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]";

function Check({ on, label, n, onClick }: { on: boolean; label: string; n: number; onClick: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick} className="flex min-h-[30px] w-full items-center gap-2.5 border-0 bg-transparent p-0 text-left text-[14px] text-[#121826]">
      <span aria-hidden className="box-border flex size-[18px] flex-none items-center justify-center rounded-[3px] text-[12px] text-white" style={{ border: on ? "1.5px solid #0E1B3D" : "1.5px solid #B7BDC9", background: on ? "#0E1B3D" : "#FFFFFF" }}>{on ? "✓" : ""}</span>
      <span className="flex-auto">{label}</span>
      <span className="font-mono text-[12px] text-[#4A5263]">{n}</span>
    </button>
  );
}

function toggleIn<T>(arr: T[], v: T) { return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; }

/** Canvas PV01: venue directory with list, deadline calendar, map and past venues. */
export function Directory({ venues, generatedAt, ready }: { venues: DirectoryVenue[]; generatedAt: string; ready: boolean }) {
  const t = useT();
  const [view, setViewState] = useState<View>("list");
  const [q, setQ] = useState("");
  // Read ?view= and ?q= after hydration so the list itself is server-rendered (and indexable).
  useEffect(() => {
    const tm = setTimeout(() => {
      const p = new URLSearchParams(window.location.search);
      const v = VIEWS.find(([k]) => k === p.get("view"))?.[0];
      if (v) setViewState(v);
      if (p.get("q")) setQ(p.get("q") ?? "");
    }, 0);
    return () => clearTimeout(tm);
  }, []);
  const [field, setField] = useSoftState<"all" | Field>("all");
  const [win, setWin] = useSoftState<Win>("any");
  const [kinds, setKinds] = useSoftState<string[]>([]);
  const [socs, setSocs] = useSoftState<string[]>([]);
  const [formats, setFormats] = useSoftState<string[]>([]);
  const [indexes, setIndexes] = useSoftState<string[]>([]);
  const [region, setRegion] = useSoftState("");
  const [sort, setSort] = useSoftState<"close" | "event" | "name">("close");
  const [followOnly, setFollowOnly] = useSoftState(false);
  const [shown, setShown] = useSoftState(20);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) { const id = w.requestIdleCallback(preloadTabs, { timeout: 3000 }); return () => w.cancelIdleCallback?.(id); }
    const id = window.setTimeout(preloadTabs, 1500);
    return () => window.clearTimeout(id);
  }, []);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { now, tz } = useClock(generatedAt);
  const follows = useFollows();

  function setView(v: View) {
    startTransition(() => setViewState(v));
    const u = new URL(window.location.href);
    if (v === "list") u.searchParams.delete("view"); else u.searchParams.set("view", v);
    window.history.replaceState(null, "", u);
  }

  const rows: Row[] = useMemo(
    () => venues.map((v) => {
      const st = statusOf(v, now, tz, t, t.intl);
      return { ...v, st, past: st.state === "done" };
    }),
    [venues, now, tz, t],
  );
  const current = rows.filter((r) => !r.past);

  const needle = q.trim().toLowerCase();
  const list = current
    .filter((v) => {
      if (field !== "all" && v.field !== field) return false;
      if (needle && !`${v.acr} ${v.name} ${v.society ?? ""} ${v.location ?? ""} ${v.city ?? ""} ${v.country ?? ""} ${v.field ?? ""}`.toLowerCase().includes(needle)) return false;
      if (kinds.length && !kinds.includes(v.kind)) return false;
      if (socs.length && !socs.includes(v.society ?? "")) return false;
      if (formats.length && !formats.includes(v.format ?? "")) return false;
      if (indexes.length && !indexes.some((x) => v.indexedIn.includes(x))) return false;
      if (region && v.region !== region) return false;
      if (win === "d7" && v.st.days > 7) return false;
      if (win === "d30" && v.st.days > 30) return false;
      if (win === "open" && !["soon", "open", "later", "rolling"].includes(v.st.state)) return false;
      if (win === "open" && v.st.closes === "—") return false;
      if (followOnly && follows.signedIn && !follows.followed.includes(v.id)) return false;
      return true;
    })
    .sort((a, b) => (sort === "name" ? a.acr.localeCompare(b.acr) : sort === "event" ? (a.startsOn ?? "9999").localeCompare(b.startsOn ?? "9999") : a.st.days - b.st.days));

  const count = (pred: (v: Row) => boolean) => current.filter(pred).length;
  const societies = [...new Set(current.map((v) => v.society).filter(Boolean) as string[])].sort();
  const indexList = [...new Set(current.flatMap((v) => v.indexedIn))].sort();
  const kindList = (["conference", "workshop", "journal", "award"] as const).filter((k) => current.some((v) => v.kind === k));

  const chips: { label: string; remove: () => void }[] = [];
  if (field !== "all") chips.push({ label: t(FIELD_LABEL[field]), remove: () => setField("all") });
  if (win !== "any") chips.push({ label: t(WINDOWS.find(([k]) => k === win)![1]), remove: () => setWin("any") });
  kinds.forEach((k) => chips.push({ label: t(KIND_LABEL[k as keyof typeof KIND_LABEL]), remove: () => setKinds((a) => a.filter((x) => x !== k)) }));
  socs.forEach((k) => chips.push({ label: k, remove: () => setSocs((a) => a.filter((x) => x !== k)) }));
  formats.forEach((k) => chips.push({ label: t(FORMAT_LABEL[k as keyof typeof FORMAT_LABEL]), remove: () => setFormats((a) => a.filter((x) => x !== k)) }));
  indexes.forEach((k) => chips.push({ label: k, remove: () => setIndexes((a) => a.filter((x) => x !== k)) }));
  if (region) chips.push({ label: t(region), remove: () => setRegion("") });
  const clearAll = () => { setQ(""); setField("all"); setWin("any"); setKinds([]); setSocs([]); setFormats([]); setIndexes([]); setRegion(""); setFollowOnly(false); };

  const pastRows = rows.filter((r) => r.past && (!needle || `${r.acr} ${r.name} ${r.bestPaper ?? ""}`.toLowerCase().includes(needle)) && (field === "all" || r.field === field));
  const mapCount = list.filter((v) => v.lat != null && v.lng != null).length;
  const countLine =
    view === "past" ? [pastRows.length, pastRows.length === 1 ? t("past edition") : t("past editions")]
    : view === "map" ? [mapCount, t("venues on the map")]
    : [list.length, list.length === 1 ? t("venue matches") : t("venues match")];

  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <PublicHeader signedIn={follows.signedIn} />

      <section className="bg-[#0E1B3D] text-[#F5F6F3]">
        <div className="mx-auto max-w-[1280px] px-5 pb-0 pt-10 sm:px-8">
          <p className="m-0 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#F2A93B]">{t("Venue directory")}</p>
          <h1 className="mt-2 font-serif text-[36px] font-[350] leading-[1.05] tracking-[-0.015em] sm:text-[48px]">{t("Find your next call for papers")}</h1>
          <p className="mt-2 text-[16px] text-[#B9C3DA]">
            {current.length} {current.length === 1 ? t("conference, journal or award") : t("conferences, journals and awards")} · {t("deadlines in")} <strong className="text-[#F5F6F3]">{tz === "UTC" ? t("your time zone") : `${cityOf(tz)} (${tz})`}</strong>, {t("AoE alongside")}
          </p>
          <div role="search" className="mt-[22px] flex h-[52px] items-center gap-2.5 rounded-[6px] bg-white px-3.5">
            <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden fill="none" stroke="#4A5263" strokeWidth="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
            <label htmlFor="v-q" className="sr-only">{t("Search venues")}</label>
            <input id="v-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Acronym, name, topic, society or city — e.g. CDC 2027, robotics, IFAC")}
              className="h-[50px] min-w-0 flex-auto border-0 bg-transparent text-[16px] text-[#121826] outline-none" />
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {FIELDS.map(([k, label]) => {
              const on = field === k;
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => setField(k)} className="h-[34px] rounded-full px-3.5 text-[13px] font-semibold"
                  style={{ background: on ? "#F2A93B" : "transparent", color: on ? "#0E1B3D" : "#D6DCEA", border: on ? "1px solid #F2A93B" : "1px solid #2A3C6E" }}>{t(label)}</button>
              );
            })}
          </div>
          <div role="tablist" aria-label={t("View")} className="mt-6 flex gap-1 overflow-x-auto border-b border-[#24335C]">
            {VIEWS.map(([k, label]) => {
              const on = view === k;
              return (
                <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setView(k)} className="h-[42px] flex-none border-0 bg-transparent px-4 text-[14px] font-semibold"
                  style={{ color: on ? "#F5F6F3" : "#B9C3DA", borderBottom: on ? "3px solid #F2A93B" : "3px solid transparent" }}>{t(label)}</button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto box-border flex w-full max-w-[1280px] flex-col items-start gap-8 px-5 pb-14 pt-7 sm:px-8 lg:flex-row">
        <button type="button" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} aria-controls="v-filters"
          className="flex h-10 w-full items-center justify-between rounded-[6px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-semibold text-[#121826] lg:hidden">
          <span>{t("Filters")}{chips.length ? ` · ${chips.length}` : ""}</span><span aria-hidden>{filtersOpen ? "▴" : "▾"}</span>
        </button>
        <aside id="v-filters" aria-label={t("Filters")} className={`${filtersOpen ? "flex" : "hidden"} -mt-4 w-full flex-col gap-[22px] lg:mt-0 lg:flex lg:w-[250px] lg:flex-none`}>
          {follows.signedIn ? (
            <button type="button" role="switch" aria-checked={followOnly} onClick={() => setFollowOnly((v) => !v)} className="flex items-center justify-between gap-2.5 rounded-[8px] border border-[#DADDE3] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#121826]">
              <span>{t("★ Following only")}</span>
              <span aria-hidden className="relative h-5 w-[34px] rounded-full" style={{ background: followOnly ? "#18744F" : "#B7BDC9" }}><span className="absolute top-0.5 size-4 rounded-full bg-white" style={{ left: followOnly ? 16 : 2 }} /></span>
            </button>
          ) : null}
          <div role="radiogroup" aria-label={t("Deadline")}>
            <p className={kicker}>{t("Deadline")}</p>
            {WINDOWS.map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={win === k} onClick={() => setWin(k)} className="flex min-h-[30px] w-full items-center gap-2.5 border-0 bg-transparent p-0 text-left text-[14px] text-[#121826]">
                <span aria-hidden className="box-border size-[18px] flex-none rounded-full bg-white" style={{ border: win === k ? "5px solid #0E1B3D" : "1.5px solid #B7BDC9" }} />{t(label)}
              </button>
            ))}
          </div>
          {kindList.length ? (
            <div role="group" aria-label={t("Venue type")}><p className={kicker}>{t("Venue type")}</p>
              {kindList.map((k) => <Check key={k} on={kinds.includes(k)} label={t(KIND_LABEL[k])} n={count((v) => v.kind === k)} onClick={() => setKinds((a) => toggleIn(a, k))} />)}
            </div>
          ) : null}
          {societies.length ? (
            <div role="group" aria-label={t("Society")}><p className={kicker}>{t("Society")}</p>
              {societies.map((s) => <Check key={s} on={socs.includes(s)} label={s} n={count((v) => v.society === s)} onClick={() => setSocs((a) => toggleIn(a, s))} />)}
            </div>
          ) : null}
          <div role="group" aria-label={t("Format")}><p className={kicker}>{t("Format")}</p>
            {(["in_person", "hybrid", "online"] as const).map((f) => <Check key={f} on={formats.includes(f)} label={t(FORMAT_LABEL[f])} n={count((v) => v.format === f)} onClick={() => setFormats((a) => toggleIn(a, f))} />)}
          </div>
          {indexList.length ? (
            <div role="group" aria-label={t("Indexed in")}><p className={kicker}>{t("Proceedings indexed in")}</p>
              {indexList.map((x) => <Check key={x} on={indexes.includes(x)} label={x} n={count((v) => v.indexedIn.includes(x))} onClick={() => setIndexes((a) => toggleIn(a, x))} />)}
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="v-region" className={`${kicker} mb-0`}>{t("Region")}</label>
            <select id="v-region" value={region} onChange={(e) => setRegion(e.target.value)} className="h-10 rounded-[4px] border border-[#B7BDC9] bg-white px-2 text-[14px]">
              <option value="">{t("Anywhere")}</option>
              {REGIONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
            </select>
          </div>
          {follows.loaded && !follows.signedIn ? (
            <div className="rounded-[8px] border border-[#F1D29A] bg-[#FFF6E6] px-4 py-3.5 text-[14px] text-[#3B2A07]">
              <div className="font-semibold">{t("Get deadline alerts")}</div>
              <div className="mt-0.5">{t("Follow venues for reminders 14, 7 and 1 day before they close — and when a deadline moves.")}</div>
              <Link href="/sign-in?next=/venues" className="mt-1.5 inline-block font-semibold text-[#7A4508]">{t("Sign in to follow →")}</Link>
            </div>
          ) : null}
        </aside>

        <section aria-label={t("Results")} className="w-full min-w-0 flex-auto">
          {!ready ? (
            <p role="status" className="mb-3 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-2.5 text-[14px] text-[#3B2A07]">{t("Deadlines, filters and the map appear once the venue directory database update is installed.")}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="m-0 text-[14px] text-[#4A5263]"><strong className="text-[#121826]">{countLine[0]}</strong> {countLine[1]}</p>
            {view === "list" ? (
              <div className="flex items-center gap-2 text-[14px]">
                <label htmlFor="v-sort" className="text-[#4A5263]">{t("Sort by")}</label>
                <select id="v-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-2 text-[14px]">
                  <option value="close">{t("Closing soonest")}</option><option value="event">{t("Event date")}</option><option value="name">{t("Acronym A–Z")}</option>
                </select>
              </div>
            ) : null}
          </div>
          {chips.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {chips.map((c) => (
                <button key={c.label} type="button" onClick={c.remove} aria-label={t("Remove {x}", { x: c.label })} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#B7BDC9] bg-white py-0 pl-2.5 pr-1.5 text-[13px] text-[#121826]">
                  {c.label} <span aria-hidden className="text-[14px] text-[#4A5263]">×</span>
                </button>
              ))}
              <button type="button" onClick={clearAll} className="ml-1 border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline">{t("Clear all")}</button>
            </div>
          ) : null}

          <ViewTransition key={view} enter={VT.panelIn} exit={VT.panelOut} default="none">
          {view === "list" ? (
            <div className="mt-3.5 flex flex-col gap-3">
              {list.slice(0, shown).map((v) => (
                <ViewTransition key={v.id} enter={VT.cardIn} exit={VT.cardOut} update={VT.cardMove} default="none">
                  <VenueCard v={v} following={follows.followed.includes(v.id)} onFollow={() => follows.toggle(v.id, "/venues")} />
                </ViewTransition>
              ))}
              {list.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-9 text-center text-[#4A5263]">
                  {current.length ? <>{t("No venues match.")} <button type="button" onClick={clearAll} className="border-0 bg-transparent p-0 text-[14px] text-[#2F5FD0] underline">{t("Clear filters")}</button></> : t("No open calls yet — new venues appear here as soon as they publish.")}
                </div>
              ) : null}
              {list.length > shown ? (
                <button type="button" onClick={() => setShown((n) => n + 20)} className="mt-1 h-11 self-center rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[15px] font-medium text-[#121826]">{t("Show 20 more")}</button>
              ) : null}
            </div>
          ) : view === "calendar" ? (
            <CalendarView rows={list} now={now} tz={tz} />
          ) : view === "map" ? (
            <MapView rows={list} now={now} tz={tz} />
          ) : (
            <PastView rows={pastRows} />
          )}
          </ViewTransition>
        </section>
      </div>
      <PublicFooter />
    </div>
  );
}

function VenueCard({ v, following, onFollow }: { v: Row; following: boolean; onFollow: () => void }) {
  const t = useT();
  const [fbg, fink] = v.field ? FIELD_COLOR[v.field] : ["#EEF0EC", "#4A5263"];
  const soon = v.st.state === "soon";
  const tags = [v.format ? t(FORMAT_LABEL[v.format]) : null, v.reviewMode ? t(v.reviewMode) : null, v.pageLimit, v.indexedIn.length ? v.indexedIn.join(" · ") : null].filter(Boolean) as string[];
  const where = v.kind === "journal" ? t("Online") : [v.city, v.country].filter(Boolean).join(", ") || v.location || "";
  const href = `/venues/${v.slug}`;
  return (
    <article className="flex flex-col gap-[18px] rounded-[8px] border border-[#DADDE3] bg-white px-5 py-[18px] sm:flex-row sm:items-start">
      <span aria-hidden className="flex size-14 flex-none items-center justify-center rounded-[8px] px-1 text-center font-mono text-[11px] font-semibold leading-[1.1]" style={{ background: fbg, color: fink }}>{v.society ?? v.acr.slice(0, 6)}</span>
      <div className="min-w-0 flex-auto">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
          <h2 className="m-0 text-[22px] font-semibold leading-[1.2]"><Link href={href} className="text-[#121826] no-underline hover:underline">{v.acr}</Link></h2>
          <span className="text-[14px] text-[#4A5263]">{v.name}</span>
        </div>
        <div className="mt-1 text-[14px] text-[#4A5263]">{[fmtRange(v.startsOn, v.endsOn, t.intl, t), where, v.society ? t("by {society}", { society: v.society }) : null].filter(Boolean).join(" · ")}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {v.field ? <span className="rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em]" style={{ background: fbg, color: fink }}>{t(v.field === "ocean" ? "Ocean" : FIELD_LABEL[v.field])}</span> : null}
          {tags.map((tag) => <span key={tag} className="rounded-[2px] bg-[#EEF0EC] px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[#4A5263]">{tag}</span>)}
        </div>
        {v.accepting ? <div className="mt-2 text-[13px] text-[#4A5263]">{t("Accepting:")} {t(v.accepting)}</div> : null}
      </div>
      <div className="flex-none text-left sm:w-[200px] sm:text-right">
        <div className="flex items-center gap-1.5 sm:justify-end">
          {v.st.extended ? <span className="rounded-[2px] bg-[#E6EDFC] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em] text-[#1F47A8]">{t("EXTENDED")}</span> : null}
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: soon ? "#A8600F" : "#4A5263" }}>{soon ? t("Closes soon · {what}", { what: t(v.st.label).toLowerCase() }) : t(v.st.label)}</span>
        </div>
        <div className="mt-0.5 font-mono text-[22px] font-medium" style={{ color: soon ? "#A8600F" : v.st.state === "now" ? "#14603F" : "#121826" }}>{v.st.closes}</div>
        <div className="text-[12px] text-[#4A5263]">{v.st.aoe}</div>
        <div className="text-[12px] font-medium text-[#121826]">{v.st.local}</div>
        <div className="mt-2.5 flex gap-1.5 sm:justify-end">
          <button type="button" onClick={onFollow} aria-pressed={following} aria-label={following ? t("Unfollow {venue}", { venue: v.acr }) : t("Follow {venue}", { venue: v.acr })} className="h-[34px] rounded-[4px] px-2.5 text-[13px] font-semibold"
            style={{ color: following ? "#7A4508" : "#121826", background: following ? "#FFF6E6" : "#FFFFFF", border: `1px solid ${following ? "#F1D29A" : "#B7BDC9"}` }}>
            {following ? t("★ Following") : t("☆ Follow")}
          </button>
          <Link href={href} className="inline-flex h-[34px] items-center rounded-[4px] bg-[#0E1B3D] px-3 text-[13px] font-semibold text-white no-underline hover:bg-[#17285A]">{t("View call")}</Link>
        </div>
      </div>
    </article>
  );
}
