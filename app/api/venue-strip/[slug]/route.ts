import { connection } from "next/server";
import { venueDeadline } from "@/lib/auth/venue-deadline";

/** Venue name and next deadline for the footer strip on venue and program pages (public data, cached 5 minutes). */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) return Response.json(null, { status: 404 });
  const v = await venueDeadline(slug).catch(() => null);
  if (!v) return Response.json(null, { status: 404, headers: { "cache-control": "public, s-maxage=300" } });
  return Response.json({ slug: v.slug, name: v.name, acr: v.acr, label: v.label, iso: v.iso, aoe: v.aoe },
    { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=900" } });
}
