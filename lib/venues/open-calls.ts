import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { VenueCover } from "@/lib/venues/types";

/** One upcoming call for papers: the next submission (or proposal) deadline of a published venue. */
export type OpenCall = {
  slug: string; name: string; shortName: string | null; kind: string; location: string | null; startsOn: string | null;
  deadline: string; label: string; extended: boolean; field: string | null; cover: VenueCover | null;
};
export type OpenCallsResult = { status: "ok"; calls: OpenCall[]; generatedAt: string } | { status: "error"; generatedAt: string };

type Row = {
  starts_at: string; label: string; is_extended: boolean;
  venues: { slug: string; name: string; short_name: string | null; kind: string; location: string | null; starts_on: string | null; field: string | null; cover: VenueCover | null } | null;
};

/**
 * Real open calls, soonest deadline first, one row per venue. Cached for a few minutes; the client hides any
 * deadline that passes while the cached list is on screen. Errors are returned, not thrown, so the panel
 * can say so instead of breaking the sign-in page.
 */
export async function getOpenCalls(limit: number): Promise<OpenCallsResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag("venues");
  const generatedAt = new Date().toISOString();
  const { data, error } = await createPublicClient()
    .from("venue_dates")
    .select("starts_at, label, is_extended, venues!inner(slug, name, short_name, kind, location, starts_on, field, is_published, cover:details->cover)")
    .in("kind", ["submission", "proposal"])
    .gt("starts_at", generatedAt)
    .eq("venues.is_published", true)
    .order("starts_at", { ascending: true })
    .limit(60);
  if (error) return { status: "error", generatedAt };
  const seen = new Set<string>();
  const calls: OpenCall[] = [];
  for (const r of (data ?? []) as unknown as Row[]) {
    const v = r.venues;
    if (!v || seen.has(v.slug)) continue;
    seen.add(v.slug);
    calls.push({ slug: v.slug, name: v.name, shortName: v.short_name, kind: v.kind, location: v.location, startsOn: v.starts_on, deadline: r.starts_at, label: r.label, extended: r.is_extended, field: v.field ?? null, cover: v.cover ?? null });
    if (calls.length >= limit) break;
  }
  return { status: "ok", calls, generatedAt };
}
