/* Reviewer constants and helpers usable from server and client components. */

export type Criterion = { key: string; name: string; help?: string };
export type Rec = "accept" | "weak_accept" | "borderline" | "weak_reject" | "reject" | "major_revision" | "accept_minor" | "another_revision";

/** Round-1 recommendation scale (RV03, RV07). */
export const RECS: [Rec, string][] = [
  ["accept", "Accept"],
  ["weak_accept", "Weak accept"],
  ["borderline", "Borderline"],
  ["weak_reject", "Weak reject"],
  ["reject", "Reject"],
  ["major_revision", "Major revision"],
];
/** Round-2 scale (RV09). */
export const RECS_R2: [Rec, string][] = [
  ["accept", "Accept"],
  ["accept_minor", "Accept with minor changes"],
  ["another_revision", "Another revision"],
  ["reject", "Reject"],
];
export const REC_LABEL: Record<string, string> = {
  accept: "Accept", weak_accept: "Weak accept", borderline: "Borderline", weak_reject: "Weak reject", reject: "Reject",
  major_revision: "Major revision", accept_minor: "Accept with minor changes", another_revision: "Another revision",
};
export const CONFS: ["low" | "medium" | "high", string][] = [
  ["low", "Low — outside my area"],
  ["medium", "Medium"],
  ["high", "High — expert"],
];
export const CONF_LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };

export const DECISION_LABEL: Record<string, string> = {
  accept_oral: "Accepted · oral", accept_poster: "Accepted · poster", conditional: "Conditional accept", reject: "Rejected", desk_reject: "Desk rejected",
};

/** Tag colours of the canvas: a = in progress, b = invitation/discussion, g = done, n = neutral, r = bad. */
export const TAG = {
  a: "bg-[#FBEFDD] text-[#7A4508]",
  b: "bg-[#E6EDFC] text-[#1F47A8]",
  g: "bg-[#E1F3EA] text-[#14603F]",
  n: "bg-[#EEF0EC] text-[#4A5263]",
  r: "bg-[#FDECEA] text-[#B3261E]",
} as const;
export const recTone = (rec: string | null | undefined): keyof typeof TAG =>
  !rec ? "n" : /reject/.test(rec) ? "r" : /weak|border|minor|revision/.test(rec) ? "a" : "g";
export const scoreTone = (v: number) => (v >= 4 ? TAG.g : v === 3 ? TAG.n : TAG.r);

export const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
export const MIN_WORDS = 100;

export const DAY_MS = 864e5;
export const daysUntil = (iso: string, now: number) => Math.ceil((new Date(iso).getTime() - now) / DAY_MS);

export function fmtDay(iso: string | null | undefined, intl: string, tz?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone: tz }).format(new Date(iso));
}
export function fmtDayYear(iso: string | null | undefined, intl: string, tz?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(new Date(iso));
}
export function fmtDateTime(iso: string | null | undefined, intl: string, tz?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}
/** "2d 04h" / "5h 12m" countdown, or null when past. */
export function countdown(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const d = Math.floor(ms / DAY_MS), h = Math.floor((ms % DAY_MS) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return d ? `${d}d ${String(h).padStart(2, "0")}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}
export const paperNo = (n: number | null | undefined) => `#${String(n ?? 0).padStart(4, "0")}`;

/** Labels produced by the discussion / paper_reviews RPCs, translated with the number as {n}. */
export const PARTY_LABELS = ["Reviewer {n}", "Reviewer {n} (you)", "Associate editor", "Associate editor (you)", "Program committee", "Program committee (you)"];
/** "Reviewer 2 (you)" → t("Reviewer {n} (you)", { n: 2 }). */
export const partyLabel = (t: (k: string, v?: Record<string, string | number>) => string, label: string) =>
  t(label.replace(/ \d+/, " {n}"), { n: label.match(/\d+/)?.[0] ?? "" });
