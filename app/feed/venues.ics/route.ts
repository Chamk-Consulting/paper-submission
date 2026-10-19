import { getDirectory } from "@/lib/venues/data";
import { buildIcs, type IcsItem } from "@/lib/account/ics";
import { site } from "@/lib/config/site";

/* PV01c "Subscribe (.ics)": public, subscribable feed of venue dates for the directory's current filter.
   /feed/venues.ics?v=slug1,slug2&types=sub,prop,notif,conf  — no v = every published venue. Calendar apps poll it. */

const TYPE_OF: Record<string, string> = { proposal: "prop", notification: "notif", conference: "conf" };
const SLUG = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const slugs = (q.get("v") ?? "").split(",").map((s) => s.trim()).filter((s) => SLUG.test(s)).slice(0, 200);
  const types = new Set((q.get("types") ?? "sub,prop,notif,conf").split(",").filter((t) => ["sub", "prop", "notif", "conf"].includes(t)));
  const { venues } = await getDirectory();
  const pick = slugs.length ? venues.filter((v) => slugs.includes(v.slug)) : venues;
  const items: IcsItem[] = pick.flatMap((v) =>
    v.dates
      .filter((d) => types.has(TYPE_OF[d.kind] ?? "sub") && d.kind !== "other")
      .map((d) => ({
        uid: `venue-date-${d.id}`,
        title: `${v.acr} · ${d.label}`,
        starts_at: d.startsAt,
        ends_at: d.kind === "conference" ? d.endsAt : null,
        location: d.kind === "conference" ? v.location : null,
        description: v.name,
        url: `/venues/${v.slug}`,
      })),
  );
  const name = slugs.length === 1 ? `${pick[0]?.acr ?? "Plenary"} deadlines` : "Plenary venue deadlines";
  const body = buildIcs(items, { name, origin: site.url, host: new URL(site.url).host });
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="plenary-venues.ics"',
      "cache-control": "public, max-age=900, s-maxage=900",
    },
  });
}
