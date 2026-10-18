/* iCalendar (RFC 5545) text for the personal deadline feed (CL01). */

export type IcsItem = { uid: string; title: string; starts_at: string; ends_at: string | null; location: string | null; description: string | null; url: string | null };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Lines longer than 75 octets are folded with CRLF + space. */
function fold(line: string) {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > 74) { out.push(cur); cur = " " + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}

export function buildIcs(items: IcsItem[], opts: { name: string; origin: string; host: string }) {
  const now = stamp(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plenary//Deadlines//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.name)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H",
  ];
  for (const it of items) {
    const end = it.ends_at ?? new Date(new Date(it.starts_at).getTime() + 30 * 60_000).toISOString();
    const url = it.url ? (it.url.startsWith("/") ? opts.origin + it.url : it.url) : null;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${esc(it.uid)}@${opts.host}`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(it.starts_at)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(it.title)}`,
      ...(it.location ? [`LOCATION:${esc(it.location)}`] : []),
      `DESCRIPTION:${esc([it.description, `Due ${new Date(it.starts_at).toISOString().slice(0, 16).replace("T", " ")} UTC`, url].filter(Boolean).join("\n"))}`,
      ...(url ? [`URL:${url}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
