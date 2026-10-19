import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { DirectoryVenue, VenueDate, VenueDetails } from "@/lib/venues/types";
import type { ArchiveAward, ArchiveSession, Fee, VenueArchive, VenuePublic, VenuePublicInfo } from "@/lib/venues/polish-types";

const COLS =
  "id, slug, short_name, name, kind, society, field, format, review_mode, page_limit, indexed_in, accepting, city, country, location, region, latitude, longitude, place_hint, starts_on, ends_on, papers_count, acceptance_rate, best_paper, imported_from, venue_dates(id, kind, label, starts_at, ends_at, is_hard, is_extended, extended_from)";

type Row = Record<string, unknown> & { venue_dates?: Record<string, unknown>[] };

function mapDates(rows: Record<string, unknown>[] | undefined): VenueDate[] {
  return (rows ?? [])
    .map((d) => ({
      id: d.id as string, kind: d.kind as VenueDate["kind"], label: d.label as string,
      startsAt: d.starts_at as string, endsAt: (d.ends_at as string) ?? null,
      isHard: !!d.is_hard, isExtended: !!d.is_extended, extendedFrom: (d.extended_from as string) ?? null,
    }))
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
}

function mapVenue(r: Row): DirectoryVenue {
  return {
    id: r.id as string, slug: r.slug as string, acr: (r.short_name as string) || (r.name as string), name: r.name as string,
    kind: r.kind as DirectoryVenue["kind"], society: (r.society as string) ?? null, field: (r.field as DirectoryVenue["field"]) ?? null,
    format: (r.format as DirectoryVenue["format"]) ?? null, reviewMode: (r.review_mode as string) ?? null, pageLimit: (r.page_limit as string) ?? null,
    indexedIn: (r.indexed_in as string[]) ?? [], accepting: (r.accepting as string) ?? null, city: (r.city as string) ?? null,
    country: (r.country as string) ?? null, location: (r.location as string) ?? null, region: (r.region as string) ?? null,
    lat: (r.latitude as number) ?? null, lng: (r.longitude as number) ?? null, placeHint: (r.place_hint as string) ?? null,
    startsOn: (r.starts_on as string) ?? null, endsOn: (r.ends_on as string) ?? null, papersCount: (r.papers_count as number) ?? null,
    acceptanceRate: r.acceptance_rate == null ? null : Number(r.acceptance_rate), bestPaper: (r.best_paper as string) ?? null,
    importedFrom: (r.imported_from as string) ?? null, dates: mapDates(r.venue_dates),
  };
}

/** All published venues with their dates. `ready: false` = the directory migration isn't applied yet. */
export async function getDirectory(): Promise<{ ready: boolean; venues: DirectoryVenue[]; generatedAt: string }> {
  "use cache";
  cacheLife("minutes");
  cacheTag("venues");
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("venues").select(COLS).eq("is_published", true).limit(500);
  const generatedAt = new Date().toISOString();
  if (error) {
    // Fallback for databases without the directory columns: basic fields only.
    const basic = await supabase.from("venues").select("id, slug, short_name, name, kind, location, starts_on, ends_on").eq("is_published", true).limit(500);
    return { ready: false, venues: ((basic.data ?? []) as Row[]).map(mapVenue), generatedAt };
  }
  return { ready: true, venues: ((data ?? []) as Row[]).map(mapVenue), generatedAt };
}

export async function getVenue(slug: string): Promise<{ venue: DirectoryVenue; details: VenueDetails; doubleBlind: boolean; website: string | null } | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("venues", `venue:${slug}`);
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) return null;
  const { data } = await createPublicClient().from("venues").select(`${COLS}, details, double_blind, website`).eq("slug", slug).eq("is_published", true).maybeSingle();
  if (!data) return null;
  const r = data as Row;
  return { venue: mapVenue(r), details: (r.details as VenueDetails) ?? {}, doubleBlind: !!r.double_blind, website: (r.website as string) ?? null };
}

/** PV02 Attending / Venue & travel / Gallery content and the fee table (null = not published or migration not applied). */
export async function getVenuePublic(slug: string): Promise<VenuePublic | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("venues", `venue:${slug}`);
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) return null;
  const { data, error } = await createPublicClient().rpc("venue_public_info", { p_slug: slug });
  if (error || !data) return null;
  const d = data as { info?: VenuePublicInfo; fees?: Fee[]; currency?: string; papers_per_registration?: number | null; lat?: number | null; lng?: number | null };
  return {
    info: d.info ?? {}, fees: Array.isArray(d.fees) ? d.fees.filter((f) => f && typeof f.name === "string") : [], currency: d.currency ?? "USD",
    papersPerRegistration: d.papers_per_registration ?? null, lat: d.lat ?? null, lng: d.lng ?? null,
  };
}

/** PV01p archive of a past edition: stats, proceedings, program and awards. Null until the event is over. */
export async function getVenueArchive(slug: string): Promise<{ archive: VenueArchive; sessions: ArchiveSession[]; awards: ArchiveAward[] } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("venues", `venue:${slug}`);
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("venue_archive", { p_slug: slug });
  if (error || !data) return null;
  const a = data as Record<string, unknown>;
  const archive: VenueArchive = {
    venueId: a.venue_id as string, slug: a.slug as string, name: a.name as string, acr: a.acr as string,
    startsOn: (a.starts_on as string) ?? null, endsOn: (a.ends_on as string) ?? null, where: (a.where as string) || null,
    importedFrom: (a.imported_from as string) ?? null, bestPaper: (a.best_paper as string) ?? null,
    submitted: a.submitted == null ? null : Number(a.submitted), accepted: a.accepted == null ? null : Number(a.accepted),
    acceptanceRate: a.acceptance_rate == null ? null : Number(a.acceptance_rate), countries: a.countries == null ? null : Number(a.countries),
    papers: Array.isArray(a.papers) ? (a.papers as VenueArchive["papers"]) : [], programPublished: !!a.program_published,
  };
  const prog = archive.programPublished ? await supabase.rpc("program", { p_venue: archive.venueId }) : { data: [] as unknown[] };
  // Awards come from the awards screens (EM34) once that module is installed; until then only the venue's best paper.
  const aw = await supabase.rpc("public_awards", { p_venue: archive.venueId });
  const sessions = (Array.isArray(prog.data) ? prog.data : []) as ArchiveSession[];
  const awards: ArchiveAward[] = !aw.error && Array.isArray(aw.data)
    ? (aw.data as Record<string, unknown>[]).map((r) => ({ award: String(r.award ?? r.award_name ?? ""), title: String(r.title ?? r.paper_title ?? ""), authors: (r.authors as string) ?? null })).filter((r) => r.award && r.title)
    : [];
  if (!awards.length && archive.bestPaper) awards.push({ award: "Best paper", title: archive.bestPaper, authors: null });
  return { archive, sessions, awards };
}
