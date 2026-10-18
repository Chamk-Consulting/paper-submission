/* Time helpers for the program builder and event day: sessions are entered and shown in the event's time zone. */

function parts(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value])) as Record<string, string>;
}

/** Minutes the zone is ahead of UTC at that instant. */
export function tzOffsetMin(date: Date, tz: string): number {
  const p = parts(date, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** "2027-06-13" + "10:30" in Europe/Paris → ISO instant. */
export function zonedToUtc(day: string, time: string, tz: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - tzOffsetMin(new Date(guess), tz) * 60000;
  t = guess - tzOffsetMin(new Date(t), tz) * 60000; // second pass across DST edges
  return new Date(t).toISOString();
}

/** ISO instant → { day: "2027-06-13", time: "10:30" } in the zone. */
export function utcToZoned(iso: string, tz: string): { day: string; time: string } {
  const p = parts(new Date(iso), tz);
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${String(+p.hour % 24).padStart(2, "0")}:${p.minute}` };
}

/** Every day between two dates (inclusive), as "YYYY-MM-DD". */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  for (let t = a; t <= b && out.length < 31; t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export function addMinutes(iso: string, min: number): string {
  return new Date(new Date(iso).getTime() + min * 60000).toISOString();
}

export function fmtDayLabel(day: string, intl: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(intl, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function fmtTime(iso: string, tz: string, intl: string): string {
  return new Date(iso).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit", timeZone: tz });
}

export const paperNo = (n: number | null | undefined) => `#${String(n ?? 0).padStart(4, "0")}`;
