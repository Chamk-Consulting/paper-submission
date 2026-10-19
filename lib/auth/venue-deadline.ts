import "server-only";
import { getVenue } from "@/lib/venues/data";
import { fmtAoE, nextDeadline } from "@/lib/venues/time";

export type VenueDeadline = { slug: string; name: string; acr: string; city: string | null; label: string | null; iso: string | null; aoe: string | null; generatedAt: string };

/** The venue a sign-in or welcome page is about: ?venue=slug, or a next= path like /submit/slug or /venues/slug/… */
export function venueSlugFrom(next?: string | null, venue?: string | null): string | null {
  const ok = (s: string | undefined | null) => (s && /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(s) ? s : null);
  if (ok(venue)) return venue!;
  const m = (next ?? "").match(/^\/(?:[a-z]{2}\/)?(?:submit|venues|program)\/([a-z0-9-]+)/);
  return ok(m?.[1]);
}

/** Name and next submission deadline of a published venue (public data, cached per venue). Call after a dynamic API. */
export async function venueDeadline(slug: string | null, intl = "en-GB"): Promise<VenueDeadline | null> {
  if (!slug) return null;
  const v = await getVenue(slug);
  if (!v) return null;
  const now = Date.now();
  const d = nextDeadline(v.venue, now);
  return {
    slug, name: v.venue.name, acr: v.venue.acr, city: v.venue.city, label: d?.label ?? null,
    iso: d?.startsAt ?? null, aoe: d ? fmtAoE(d.startsAt, intl) : null, generatedAt: new Date(now).toISOString(),
  };
}
