import { getVenue } from "@/lib/venues/data";
import { absoluteUrl } from "@/lib/config/site";

// "Add deadlines to calendar": one VEVENT per venue date (RFC 5545).
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateOnly = (iso: string) => iso.slice(0, 10).replace(/-/g, "");

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getVenue(slug);
  if (!data) return new Response("Not found", { status: 404 });
  const { venue } = data;
  const now = stamp(new Date().toISOString());
  const url = absoluteUrl(`/venues/${venue.slug}`);
  const events = venue.dates.map((d) => {
    const lines = [`BEGIN:VEVENT`, `UID:${d.id}@plenary`, `DTSTAMP:${now}`, `SUMMARY:${esc(`${venue.acr} · ${d.label}`)}`, `URL:${url}`, `DESCRIPTION:${esc(`${venue.name}\n${url}`)}`];
    if (d.kind === "conference") {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(d.startsAt)}`);
      if (d.endsAt) lines.push(`DTEND;VALUE=DATE:${dateOnly(d.endsAt)}`);
      if (venue.location) lines.push(`LOCATION:${esc(venue.location)}`);
    } else {
      lines.push(`DTSTART:${stamp(d.startsAt)}`, `DTEND:${stamp(d.startsAt)}`, "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(d.label)}`, "TRIGGER:-P1D", "END:VALARM");
    }
    lines.push("END:VEVENT");
    return lines.join("\r\n");
  });
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plenary//Venue deadlines//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(venue.acr)}`, ...events, "END:VCALENDAR", ""].join("\r\n");
  return new Response(body, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${venue.slug}.ics"` },
  });
}
