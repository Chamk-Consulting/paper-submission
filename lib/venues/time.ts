import type { DirectoryVenue, VenueDate } from "@/lib/venues/types";
import type { T } from "@/lib/i18n/translate";

const identity: T = (k, vars) => { let s = k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.split(`{${a}}`).join(String(b)); return s; };

export const DAY = 864e5;
const DEADLINE_KINDS = new Set(["submission", "proposal", "final", "registration"]);

/** Approximate home coordinates from the browser time zone (no geolocation prompt). */
const TZ_HOME: Record<string, [number, number, string]> = {
  "Africa/Lagos": [3.38, 6.52, "Lagos"], "Africa/Cairo": [31.24, 30.04, "Cairo"], "Africa/Johannesburg": [28.05, -26.2, "Johannesburg"],
  "Africa/Nairobi": [36.82, -1.29, "Nairobi"], "Africa/Casablanca": [-7.59, 33.57, "Casablanca"], "Africa/Algiers": [3.06, 36.75, "Algiers"],
  "Africa/Tunis": [10.18, 36.8, "Tunis"], "Africa/Accra": [-0.19, 5.6, "Accra"], "Europe/London": [-0.13, 51.5, "London"],
  "Europe/Paris": [2.35, 48.86, "Paris"], "Europe/Berlin": [13.4, 52.52, "Berlin"], "Europe/Madrid": [-3.7, 40.42, "Madrid"],
  "Europe/Rome": [12.5, 41.9, "Rome"], "Europe/Amsterdam": [4.9, 52.37, "Amsterdam"], "Europe/Brussels": [4.35, 50.85, "Brussels"],
  "Europe/Istanbul": [28.98, 41.01, "Istanbul"], "Asia/Dubai": [55.27, 25.2, "Dubai"], "Asia/Riyadh": [46.68, 24.71, "Riyadh"],
  "Asia/Kolkata": [77.2, 28.6, "Delhi"], "Asia/Shanghai": [121.47, 31.23, "Shanghai"], "Asia/Tokyo": [139.69, 35.69, "Tokyo"],
  "Asia/Singapore": [103.82, 1.35, "Singapore"], "Asia/Seoul": [126.98, 37.57, "Seoul"], "Australia/Sydney": [151.21, -33.87, "Sydney"],
  "America/New_York": [-74.0, 40.71, "New York"], "America/Chicago": [-87.63, 41.88, "Chicago"], "America/Los_Angeles": [-118.24, 34.05, "Los Angeles"],
  "America/Toronto": [-79.38, 43.65, "Toronto"], "America/Mexico_City": [-99.13, 19.43, "Mexico City"], "America/Sao_Paulo": [-46.63, -23.55, "São Paulo"],
};
export const homeFor = (tz: string) => TZ_HOME[tz] ?? null;

export function nextDeadline(v: DirectoryVenue, now: number): VenueDate | null {
  return v.dates.find((d) => DEADLINE_KINDS.has(d.kind) && Date.parse(d.startsAt) > now) ?? null;
}

export type Status = { label: string; closes: string; aoe: string; local: string; days: number; extended: boolean; state: "soon" | "open" | "later" | "now" | "done" | "rolling" };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Weekday + date, built from parts. Node's ICU and browsers disagree on the en-GB comma
 * ("Fri 1 Jan" vs "Fri, 1 Jan"), which breaks hydration (React #418). The parts format identically.
 */
export function weekdayDate(d: Date, intl = "en-GB", o: { timeZone?: string; weekday?: "short" | "long"; month?: "short" | "long"; year?: "numeric" } = {}) {
  const wd = d.toLocaleDateString(intl, { timeZone: o.timeZone, weekday: o.weekday ?? "short" });
  const dm = d.toLocaleDateString(intl, { timeZone: o.timeZone, day: "numeric", month: o.month ?? "short", year: o.year });
  return `${wd}${/^(fr|it)/.test(intl) ? " " : ", "}${dm}`;
}

export function fmtLocal(iso: string, tz: string, withWeekday = true, intl = "en-GB") {
  const d = new Date(iso);
  const day = withWeekday ? weekdayDate(d, intl, { timeZone: tz }) : d.toLocaleDateString(intl, { timeZone: tz, day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(intl, { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day}, ${time}`;
}
/** Anywhere on Earth = UTC−12. */
export function fmtAoE(iso: string, intl = "en-GB") {
  const d = new Date(Date.parse(iso) - 12 * 3600e3);
  return `${d.getUTCDate()} ${d.toLocaleString(intl, { month: "short", timeZone: "UTC" })}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} AoE`;
}
export const cityOf = (tz: string) => homeFor(tz)?.[2] ?? tz.split("/").pop()?.replace(/_/g, " ") ?? tz;

export function countdown(ms: number) {
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600e3);
  return d >= 30 ? `${d}d` : `${d}d ${pad(h)}h`;
}

export function statusOf(v: DirectoryVenue, now: number, tz: string, t: T = identity, intl = "en-GB"): Status {
  const nd = nextDeadline(v, now);
  if (nd) {
    const ms = Date.parse(nd.startsAt) - now;
    const days = Math.floor(ms / DAY);
    return { label: nd.label, closes: countdown(ms), aoe: fmtAoE(nd.startsAt, intl), local: `${fmtLocal(nd.startsAt, tz, true, intl)} ${cityOf(tz)}`, days, extended: nd.isExtended, state: days <= 7 ? "soon" : days > 60 ? "later" : "open" };
  }
  const conf = v.dates.find((d) => d.kind === "conference" && Date.parse(d.startsAt) <= now && Date.parse(d.endsAt ?? d.startsAt) >= now);
  if (conf) return { label: t("Happening"), closes: t("Now"), aoe: v.startsOn ? fmtRange(v.startsOn, v.endsOn, intl, t) : "", local: t("Program online"), days: 999, extended: false, state: "now" };
  if (v.kind === "journal") return { label: t("Status"), closes: t("Open"), aoe: t("No deadline"), local: t("Submit any time"), days: 999, extended: false, state: "rolling" };
  if (v.endsOn && Date.parse(`${v.endsOn}T23:59:59Z`) < now) return { label: t("Status"), closes: t("Done"), aoe: t("Held {when}", { when: fmtMonth(v.startsOn, intl) }), local: "", days: 999, extended: false, state: "done" };
  return { label: t("Status"), closes: "—", aoe: t("Dates to be announced"), local: "", days: 999, extended: false, state: "later" };
}

export function fmtMonth(d: string | null, intl = "en-GB") {
  return d ? new Date(`${d}T00:00:00Z`).toLocaleString(intl, { month: "short", year: "numeric", timeZone: "UTC" }) : "";
}
export function fmtRange(a: string | null, b: string | null, intl = "en-GB", t: T = identity, rolling = false) {
  if (!a) return rolling ? t("Rolling") : t("Dates to be announced");
  const s = new Date(`${a}T00:00:00Z`), e = new Date(`${b ?? a}T00:00:00Z`);
  const mon = (x: Date) => x.toLocaleString(intl, { month: "short", timeZone: "UTC" });
  if (s.getUTCFullYear() !== e.getUTCFullYear()) return `${s.getUTCDate()} ${mon(s)} ${s.getUTCFullYear()} – ${e.getUTCDate()} ${mon(e)} ${e.getUTCFullYear()}`;
  if (s.getUTCMonth() !== e.getUTCMonth()) return `${s.getUTCDate()} ${mon(s)}–${e.getUTCDate()} ${mon(e)} ${s.getUTCFullYear()}`;
  if (s.getUTCDate() === e.getUTCDate()) return `${s.getUTCDate()} ${mon(s)} ${s.getUTCFullYear()}`;
  return `${s.getUTCDate()}–${e.getUTCDate()} ${mon(s)} ${s.getUTCFullYear()}`;
}

/** YYYY-MM-DD of an instant in the given time zone. */
export function dayKey(ms: number, tz: string) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: tz });
}

export function km(a: [number, number], b: [number, number]) {
  const R = 6371, r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return Math.round((2 * R * Math.asin(Math.sqrt(h))) / 10) * 10;
}
