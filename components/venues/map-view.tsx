"use client";

import Link from "@/components/site/link";
import { useMemo, useState } from "react";
import type { Row } from "@/components/venues/directory";
import { LAND } from "@/lib/venues/land";
import { FORMAT_LABEL } from "@/lib/venues/types";
import { fmtRange, homeFor, km } from "@/lib/venues/time";
import { useT } from "@/lib/i18n/client";

type MapKey = "world" | "europe" | "africa" | "asia" | "americas";
const VIEWS: Record<MapKey, { label: string; lo: [number, number]; la: [number, number]; k?: number; region?: string }> = {
  world: { label: "World", lo: [-180, 180], la: [80, -60], k: 1 },
  europe: { label: "Europe", lo: [-15, 45], la: [64, 34], region: "Europe" },
  africa: { label: "Africa & Middle East", lo: [-25, 65], la: [38, -36], region: "Africa & Middle East" },
  asia: { label: "Asia–Pacific", lo: [60, 180], la: [56, -48], region: "Asia–Pacific" },
  americas: { label: "Americas", lo: [-170, -30], la: [74, -56], region: "Americas" },
};
const REGION_KEY: Record<string, MapKey> = { Europe: "europe", "Africa & Middle East": "africa", "Asia–Pacific": "asia", Americas: "americas" };
const OCEANS: [string, number, number][] = [["Atlantic Ocean", -35, 25], ["Pacific Ocean", -140, 10], ["Pacific Ocean", 165, 20], ["Indian Ocean", 78, -20], ["Arctic Ocean", 20, 78], ["Mediterranean Sea", 18, 34.5], ["Southern Ocean", 60, -55]];
const MW = 1080;

const BOXES = LAND.map((p) => {
  let x0 = 999, x1 = -999, y0 = 999, y1 = -999;
  for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return [x0, x1, y0, y1];
});
function inside(x: number, y: number, poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function geometry(key: MapKey) {
  const V = VIEWS[key];
  const lonSpan = V.lo[1] - V.lo[0], latSpan = V.la[0] - V.la[1];
  const cosk = V.k ?? Math.cos((((V.la[0] + V.la[1]) / 2) * Math.PI) / 180);
  const MH = Math.round((MW * latSpan) / (lonSpan * cosk));
  const PX = (lon: number) => ((lon - V.lo[0]) / lonSpan) * MW;
  const PY = (lat: number) => ((V.la[0] - lat) / latSpan) * MH;
  const spacing = key === "world" ? 6.2 : 8, stepLon = (spacing * lonSpan) / MW, stepLat = (spacing * latSpan) / MH;
  let dots = "";
  for (let la = V.la[0] - stepLat / 2; la > V.la[1]; la -= stepLat)
    for (let lo = V.lo[0] + stepLon / 2; lo < V.lo[1]; lo += stepLon)
      for (let p = 0; p < LAND.length; p++) {
        const b = BOXES[p];
        if (lo < b[0] || lo > b[1] || la < b[2] || la > b[3]) continue;
        if (inside(lo, la, LAND[p])) { dots += `M${PX(lo).toFixed(1)} ${PY(la).toFixed(1)}h0.01`; break; }
      }
  const g = key === "world" ? 30 : 10;
  let grid = "";
  for (let x = Math.ceil(V.lo[0] / g) * g; x <= V.lo[1]; x += g) grid += `M${PX(x).toFixed(1)} 0V${MH}`;
  for (let y = Math.ceil(V.la[1] / g) * g; y <= V.la[0]; y += g) grid += `M0 ${PY(y).toFixed(1)}H${MW}`;
  const within = (lat: number) => lat <= V.la[0] && lat >= V.la[1];
  const eq = within(0) ? `M0 ${PY(0).toFixed(1)}H${MW}` : "";
  const tropics = (within(23.44) ? `M0 ${PY(23.44).toFixed(1)}H${MW}` : "") + (within(-23.44) ? `M0 ${PY(-23.44).toFixed(1)}H${MW}` : "");
  const lat: { t: string; y: string }[] = [];
  for (let y = Math.ceil(V.la[1] / g) * g; y <= V.la[0]; y += g) lat.push({ t: y === 0 ? "0°" : `${Math.abs(y)}°${y > 0 ? "N" : "S"}`, y: ((PY(y) / MH) * 100).toFixed(2) });
  const oceans = OCEANS.filter(([, lo, la]) => lo > V.lo[0] && lo < V.lo[1] && within(la)).map(([t, lo, la]) => ({ t, x: ((PX(lo) / MW) * 100).toFixed(2), y: ((PY(la) / MH) * 100).toFixed(2) }));
  const visible = (lng: number, la: number) => lng >= V.lo[0] && lng <= V.lo[1] && within(la);
  return { MH, PX, PY, dots, grid, eq, tropics, lat, oceans, visible };
}

/** Canvas PV01 "Map" tab: dot-matrix world map with deadline-coloured pins. */
export function MapView({ rows, tz }: { rows: Row[]; now: number; tz: string }) {
  const t = useT();
  const [key, setKey] = useState<MapKey>("world");
  const [pin, setPin] = useState("");
  const geo = useMemo(() => geometry(key), [key]);
  // "Distance from you": a guess from the time zone, or the browser's location after the person asks (never stored or sent).
  const [geoHome, setGeoHome] = useState<[number, number, string] | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied" | "on">("idle");
  const [unit, setUnit] = useState<"km" | "mi">("km");
  const [within, setWithin] = useState<0 | 1000 | 3000>(0);
  const home = geoHome ?? homeFor(tz);
  const askLocation = () => {
    if (!navigator.geolocation) { setGeoState("denied"); return; }
    setGeoState("asking");
    if (/-(US|GB|LR|MM)$/i.test(navigator.language)) setUnit("mi");
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeoHome([Math.round(p.coords.longitude * 100) / 100, Math.round(p.coords.latitude * 100) / 100, t("your location")]); setGeoState("on"); },
      () => setGeoState("denied"),
      { maximumAge: 600_000, timeout: 10_000, enableHighAccuracy: false },
    );
  };
  const fmtDist = (k: number) => {
    const n = unit === "mi" ? Math.round((k * 0.621371) / 10) * 10 : k;
    return `${n > 0 ? n.toLocaleString(t.intl) : "<10"} ${unit}`;
  };
  const distOf = (v: Row) => (home && v.lat != null && v.lng != null ? km([home[0], home[1]], [v.lng, v.lat]) : null);
  const placedAll = rows.filter((v) => v.lat != null && v.lng != null);
  const placed = within && home ? placedAll.filter((v) => (distOf(v) ?? Infinity) <= within) : placedAll;
  const nearest = home ? [...placedAll].sort((a, b) => (distOf(a) ?? 0) - (distOf(b) ?? 0)).slice(0, 5) : [];
  const onMap = placed.filter((v) => geo.visible(v.lng!, v.lat!));
  const sel = placed.find((v) => v.id === pin) ?? onMap[0] ?? placed[0];
  const homeVisible = home ? geo.visible(home[0], home[1]) : false;

  const color = (v: Row) => (v.st.state === "now" ? "#18744F" : v.st.state === "soon" ? "#F2A93B" : v.st.state === "later" ? "#8A93A6" : "#0E1B3D");
  const short = (v: Row) => (v.st.state === "now" ? t("now") : v.st.days < 999 ? `${v.st.days}d` : "");

  let route = "";
  if (sel && home && homeVisible && geo.visible(sel.lng!, sel.lat!)) {
    const hx = geo.PX(home[0]), hy = geo.PY(home[1]), tx = geo.PX(sel.lng!), ty = geo.PY(sel.lat!);
    route = `M${hx.toFixed(1)} ${hy.toFixed(1)} Q ${((hx + tx) / 2).toFixed(1)} ${(Math.min(hy, ty) - Math.abs(tx - hx) * 0.18 - 20).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
  }
  const online = rows.length - placed.length, hidden = placed.length - onMap.length;
  const dist = sel && home && sel.lat != null ? km([home[0], home[1]], [sel.lng!, sel.lat]) : null;

  return (
    <div className="mt-3.5 flex flex-col items-start gap-4 xl:flex-row">
      <div className="w-full min-w-0 flex-auto overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
        <div role="tablist" aria-label={t("Map region")} className="flex flex-wrap gap-1.5 border-b border-[#EEF0EC] px-3 py-2.5">
          {(Object.keys(VIEWS) as MapKey[]).map((k) => {
            const on = key === k;
            const n = placed.filter((v) => k === "world" || v.region === VIEWS[k].region).length;
            return (
              <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setKey(k)} className="h-7 rounded-full px-2.5 text-[12px] font-semibold"
                style={{ background: on ? "#0E1B3D" : "#FFFFFF", color: on ? "#F5F6F3" : "#4A5263", border: on ? "1px solid #0E1B3D" : "1px solid #DADDE3" }}>{t(VIEWS[k].label)} · {n}</button>
            );
          })}
        </div>
        <div className="relative bg-[#EEF3FA]">
          <svg viewBox={`0 0 ${MW} ${geo.MH}`} width="100%" role="img" aria-label={t("Map of venues")} className="block">
            <path d={geo.grid} fill="none" stroke="#D5DEEC" strokeWidth="1" />
            <path d={geo.tropics} fill="none" stroke="#C3CFE3" strokeWidth="1" strokeDasharray="2 5" />
            <path d={geo.eq} fill="none" stroke="#AFC0DB" strokeWidth="1.2" strokeDasharray="6 4" />
            <path d={geo.dots} fill="none" stroke="#9AA3B5" strokeWidth={key === "world" ? 3.6 : 4.6} strokeLinecap="round" />
            {route ? <path d={route} fill="none" stroke="#2F5FD0" strokeWidth="2" strokeDasharray="5 5" /> : null}
          </svg>
          {geo.lat.map((g) => <span key={g.t} aria-hidden className="absolute left-1 font-mono text-[9px] text-[#7D8AA3]" style={{ top: `${g.y}%`, transform: "translateY(-110%)" }}>{g.t}</span>)}
          {geo.oceans.map((o) => <span key={`${o.t}${o.x}`} aria-hidden className="absolute hidden whitespace-nowrap font-serif text-[13px] italic tracking-[0.08em] text-[#8C9BB6] sm:block" style={{ left: `${o.x}%`, top: `${o.y}%`, transform: "translate(-50%,-50%)" }}>{t(o.t)}</span>)}
          {home && homeVisible ? (
            <>
              <span aria-hidden className="absolute size-3 rounded-full bg-[#2F5FD0] shadow-[0_0_0_5px_rgba(47,95,208,.22)]" style={{ left: `${((geo.PX(home[0]) / MW) * 100).toFixed(2)}%`, top: `${((geo.PY(home[1]) / geo.MH) * 100).toFixed(2)}%`, transform: "translate(-50%,-50%)" }} />
              <span className="absolute rounded-[2px] border border-[#BFD0F5] bg-white px-[5px] py-px font-mono text-[10px] font-semibold uppercase text-[#1F47A8]" style={{ left: `${((geo.PX(home[0]) / MW) * 100).toFixed(2)}%`, top: `${((geo.PY(home[1]) / geo.MH) * 100).toFixed(2)}%`, transform: "translate(10px,4px)" }}>{t("You")} · {home[2]}</span>
            </>
          ) : null}
          {onMap.map((v) => {
            const on = sel?.id === v.id, c = color(v);
            return (
              <button key={v.id} type="button" onClick={() => setPin(v.id)} aria-label={`${v.acr}, ${v.placeHint ?? v.city ?? ""}`} aria-pressed={on}
                className="absolute flex flex-col items-center border-0 bg-transparent p-0"
                style={{ zIndex: on ? 3 : 2, left: `${((geo.PX(v.lng!) / MW) * 100).toFixed(2)}%`, top: `${((geo.PY(v.lat!) / geo.MH) * 100).toFixed(2)}%`, transform: "translate(-50%,-100%)" }}>
                <span className="whitespace-nowrap rounded-[3px] px-1.5 py-0.5 font-mono text-[11px] font-semibold shadow-[0_1px_3px_rgba(18,24,38,.2)]"
                  style={{ color: on ? (v.st.state === "soon" ? "#0E1B3D" : "#FFFFFF") : "#121826", background: on ? c : "#FFFFFF", border: `1.5px solid ${c}` }}>
                  {v.acr}{short(v) ? ` · ${short(v)}` : ""}
                </span>
                <span className="h-2 w-0.5" style={{ background: c }} />
                <span className="-mt-0.5 size-[9px] rounded-full border-2 border-white" style={{ background: c }} />
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap justify-between gap-2.5 border-t border-[#EEF0EC] px-3.5 py-2.5 text-[12px] text-[#4A5263]">
          <span className="flex flex-wrap items-center gap-3.5">
            {[["#F2A93B", "Closes within 7 days"], ["#0E1B3D", "Open"], ["#8A93A6", "Later (60+ days)"], ["#18744F", "Happening now"]].map(([c, lbl]) => (
              <span key={lbl}><span aria-hidden className="inline-block size-2.5 rounded-[2px] align-[-1px]" style={{ background: c }} /> {t(lbl)}</span>
            ))}
          </span>
          <span>{online ? (online === 1 ? t("1 online venue not on the map") : t("{n} online venues not on the map", { n: online })) : t("All venues placed")}{hidden ? ` · ${t("{n} outside this view", { n: hidden })}` : ""}</span>
        </div>
      </div>

      <aside aria-label={t("Selected venue")} className="flex w-full flex-col gap-3 xl:w-[300px] xl:flex-none">
        {sel ? (
          <section className="rounded-[8px] border border-[#DADDE3] bg-white p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: sel.st.state === "now" ? "#14603F" : sel.st.state === "soon" ? "#A8600F" : "#4A5263" }}>
                {sel.st.state === "now" ? t("Happening now") : sel.st.state === "soon" ? t("Closes soon") : t("Open for submissions")}
              </span>
              <span className="font-mono text-[12px] text-[#4A5263]">{sel.region ? t(sel.region) : null}</span>
            </div>
            <div className="mt-1 text-[20px] font-semibold">{sel.acr}</div>
            <div className="text-[13px] text-[#4A5263]">{sel.name}</div>
            <dl className="m-0 mt-2.5 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
              <dt className="text-[#4A5263]">{t("When")}</dt><dd className="m-0">{fmtRange(sel.startsOn, sel.endsOn, t.intl, t, sel.kind === "journal")}</dd>
              <dt className="text-[#4A5263]">{t("Where")}</dt><dd className="m-0">{[sel.city, sel.country].filter(Boolean).join(", ")}{sel.placeHint ? ` (${sel.placeHint})` : ""}</dd>
              <dt className="text-[#4A5263]">{t("Deadline")}</dt><dd className="m-0">{sel.st.closes}{sel.st.local ? ` · ${sel.st.local}` : ""}</dd>
              {dist != null && home ? <><dt className="text-[#4A5263]">{t("From you")}</dt><dd className="m-0">{t("{dist} from {city} · about {h} h flying", { dist: fmtDist(dist), city: home[2], h: Math.max(1, Math.round(dist / 750)) })}</dd></> : null}
              {sel.format ? <><dt className="text-[#4A5263]">{t("Format")}</dt><dd className="m-0">{t(FORMAT_LABEL[sel.format])}</dd></> : null}
            </dl>
            {sel.format !== "online" ? (
              <p className="mt-2.5 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-2.5 py-2 text-[12px] text-[#3B2A07]">{t("Travelling? Check visa rules early — accepted authors can request an invitation letter from their paper page.")}</p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <Link href={`/venues/${sel.slug}`} className="inline-flex h-9 flex-auto items-center justify-center rounded-[4px] bg-[#0E1B3D] text-[13px] font-semibold text-white no-underline">{t("View call")}</Link>
              {sel.region && REGION_KEY[sel.region] ? (
                <button type="button" onClick={() => setKey(REGION_KEY[sel.region!])} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-medium text-[#121826]">{t("Zoom to region")}</button>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-4 text-[14px] text-[#4A5263]">{t("No venues with a location match your filters.")}</section>
        )}
        <section aria-labelledby="near-h" className="rounded-[8px] border border-[#DADDE3] bg-white px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="near-h" className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("Distance from you")}</h3>
            <span role="group" aria-label={t("Units")} className="flex gap-1">
              {(["km", "mi"] as const).map((u) => (
                <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className="h-6 rounded-[3px] px-1.5 font-mono text-[11px]"
                  style={{ background: unit === u ? "#0E1B3D" : "#FFFFFF", color: unit === u ? "#F5F6F3" : "#4A5263", border: "1px solid #DADDE3" }}>{u}</button>
              ))}
            </span>
          </div>
          <p className="m-0 mt-1 text-[12px] text-[#4A5263]">
            {geoState === "on" ? t("From your current location. It stays in this browser — we don't save it.") : home ? t("Estimated from your time zone ({city}).", { city: home[2] }) : t("We can't guess where you are from your time zone.")}
          </p>
          {geoState !== "on" ? (
            <button type="button" onClick={askLocation} disabled={geoState === "asking"} className="mt-2 h-8 w-full rounded-[4px] border border-[#B7BDC9] bg-white text-[13px] font-medium text-[#121826] disabled:opacity-60">
              {geoState === "asking" ? t("Finding you…") : t("Use my precise location")}
            </button>
          ) : null}
          {geoState === "denied" ? <p role="status" className="m-0 mt-1.5 text-[12px] text-[#A8600F]">{t("Location is off for this site. Distances stay estimated from your time zone.")}</p> : null}
          {home ? (
            <>
              <div role="group" aria-label={t("Show venues within")} className="mt-2.5 flex flex-wrap gap-1">
                {([[0, t("Any distance")], [1000, `≤ ${fmtDist(1000)}`], [3000, `≤ ${fmtDist(3000)}`]] as [0 | 1000 | 3000, string][]).map(([w, lbl]) => (
                  <button key={w} type="button" aria-pressed={within === w} onClick={() => setWithin(w)} className="h-7 rounded-full px-2.5 text-[12px] font-semibold"
                    style={{ background: within === w ? "#0E1B3D" : "#FFFFFF", color: within === w ? "#F5F6F3" : "#4A5263", border: within === w ? "1px solid #0E1B3D" : "1px solid #DADDE3" }}>{lbl}</button>
                ))}
              </div>
              <p className="m-0 mt-2.5 text-[12px] font-semibold text-[#121826]">{t("Nearest venues")}</p>
              <ol className="m-0 mt-1 list-none p-0">
                {nearest.map((v) => (
                  <li key={v.id} className="border-b border-[#EEF0EC] last:border-b-0">
                    <button type="button" onClick={() => setPin(v.id)} className="flex w-full justify-between gap-2 border-0 bg-transparent px-0 py-1.5 text-left text-[13px] text-[#121826]">
                      <span className="truncate">{v.acr}</span><span className="flex-none font-mono text-[#4A5263]">{fmtDist(distOf(v) ?? 0)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </section>
        <section className="rounded-[8px] border border-[#DADDE3] bg-white px-3.5 py-3">
          <p className="m-0 mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("By region")}</p>
          {["Europe", "Asia–Pacific", "Americas", "Africa & Middle East", "Online"].map((r) => (
            <button key={r} type="button" onClick={() => REGION_KEY[r] && setKey(REGION_KEY[r])} className="flex w-full justify-between border-0 border-b border-solid border-[#EEF0EC] bg-transparent px-0 py-1.5 text-left text-[13px] text-[#121826]">
              <span>{t(r)}</span><span className="font-mono text-[#4A5263]">{rows.filter((v) => v.region === r).length} →</span>
            </button>
          ))}
        </section>
      </aside>
    </div>
  );
}
