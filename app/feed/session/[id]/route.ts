import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/config/site";

// PG02 / CH01 "Add to calendar": one session as an .ics event (RFC 5545). /feed/* is served without a locale prefix.
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: s } = await supabase.from("sessions")
    .select("id, code, title, starts_at, ends_at, rooms(name), venues(slug, name, short_name, location)")
    .eq("id", id).maybeSingle();
  if (!s) return new Response("Not found", { status: 404 });
  const one = <X,>(x: X | X[] | null): X | null => (Array.isArray(x) ? x[0] ?? null : x);
  const v = one(s.venues as unknown as { slug: string; name: string; short_name: string | null; location: string | null } | null);
  const room = one(s.rooms as unknown as { name: string } | null);
  const url = absoluteUrl(`/program/${v?.slug ?? ""}/sessions/${encodeURIComponent(s.code as string)}`);
  const where = [room?.name, v?.location].filter(Boolean).join(", ");
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plenary//Program//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:session-${s.id}@plenary`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(s.starts_at as string)}`, `DTEND:${stamp(s.ends_at as string)}`,
    `SUMMARY:${esc(`${s.code} · ${s.title}${v ? ` (${v.short_name ?? v.name})` : ""}`)}`,
    ...(where ? [`LOCATION:${esc(where)}`] : []), `URL:${url}`, `DESCRIPTION:${esc(url)}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(s.code as string)}`, "TRIGGER:-PT15M", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
  return new Response(body, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${String(s.code).replace(/[^\w-]/g, "")}.ics"` },
  });
}
