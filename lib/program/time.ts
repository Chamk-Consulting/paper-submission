/* Program times in the event's time zone (client + server safe). */

export const fmtTime = (iso: string, tz: string, intl = "en-GB") =>
  new Date(iso).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz });

/** YYYY-MM-DD in the event's time zone. */
export const dayKey = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz }).format(new Date(iso));

export const fmtDay = (iso: string, tz: string, intl = "en-GB") =>
  new Date(iso).toLocaleDateString(intl, { weekday: "short", day: "numeric", month: "short", timeZone: tz });

export function tzLabel(tz: string, at = new Date()) {
  try {
    const part = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
    return (part ?? "UTC").replace("GMT", "UTC");
  } catch { return "UTC"; }
}

export const overlaps = (a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }) =>
  Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);

export const KIND_STYLE: Record<string, [string, string, string]> = {
  keynote: ["#0E1B3D", "#F2A93B", "Keynote"], oral: ["#E6EDFC", "#1F47A8", "Oral"], poster: ["#E1F3EA", "#14603F", "Poster"],
  workshop: ["#FBEFDD", "#7A4508", "Workshop"], break: ["#EEF0EC", "#4A5263", "Break"],
};

/** Start of each talk: explicit start, else session start + earlier slots. */
export function talkStart(sessionStart: string, talks: { startsAt: string | null; talkMin: number; qaMin: number }[], i: number) {
  if (talks[i].startsAt) return talks[i].startsAt as string;
  let ms = Date.parse(sessionStart);
  for (let k = 0; k < i; k++) ms += (talks[k].talkMin + talks[k].qaMin) * 60000;
  return new Date(ms).toISOString();
}
