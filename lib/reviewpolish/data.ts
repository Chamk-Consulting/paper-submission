import "server-only";
import { createClient } from "@/lib/supabase/server";

/* Reads for the review-polish screens (WS02 aside, SB04, SB08, RV03, RV10, EM23). All fail soft: a database
   without migration 20261019002700 shows the empty state instead of an error. */

export type FollowedDeadline = { venueId: string; slug: string; short: string; label: string; at: string };

/** Next upcoming deadline of each venue the person follows, soonest first. */
export async function getFollowedDeadlines(personId: string | undefined, limit = 4): Promise<FollowedDeadline[]> {
  if (!personId) return [];
  const supabase = await createClient();
  const { data: follows } = await supabase.from("venue_follows").select("venue_id, venues(slug, name, short_name)").eq("person_id", personId);
  const rows = (follows ?? []) as unknown as { venue_id: string; venues: { slug: string; name: string; short_name: string | null } | null }[];
  if (!rows.length) return [];
  const { data: dates } = await supabase.from("venue_dates").select("venue_id, label, starts_at")
    .in("venue_id", rows.map((r) => r.venue_id)).gte("starts_at", new Date().toISOString()).order("starts_at");
  const next = new Map<string, { label: string; starts_at: string }>();
  for (const d of (dates ?? []) as { venue_id: string; label: string; starts_at: string }[]) if (!next.has(d.venue_id)) next.set(d.venue_id, d);
  return rows.flatMap((r) => {
    const d = next.get(r.venue_id);
    return d && r.venues ? [{ venueId: r.venue_id, slug: r.venues.slug, short: r.venues.short_name || r.venues.name, label: d.label, at: d.starts_at }] : [];
  }).sort((a, b) => (a.at < b.at ? -1 : 1)).slice(0, limit);
}

/** SB04: how many people in the venue's reviewer pool list each keyword as a topic (counts only). */
export async function getKeywordPool(venueId: string, keywords: string[]): Promise<Record<string, number> | null> {
  if (!keywords.length) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("keyword_pool_counts", { p_venue: venueId, p_keywords: keywords.slice(0, 30) });
  if (error || !Array.isArray(data)) return null;
  return Object.fromEntries((data as { keyword: string; reviewers: number }[]).map((r) => [r.keyword, Number(r.reviewers)]));
}

export type MyVolunteering = { topics: string[]; note: string | null; maxPapers: number; at: string } | null;
/** SB08: my active volunteering for a venue (undefined = feature not installed). */
export async function getMyVolunteering(venueId: string, personId: string | undefined): Promise<MyVolunteering | undefined> {
  if (!personId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("venue_review_volunteers").select("topics, note, max_papers, created_at, withdrawn_at")
    .eq("venue_id", venueId).eq("person_id", personId).maybeSingle();
  if (error) return undefined;
  if (!data || data.withdrawn_at) return null;
  return { topics: (data.topics as string[]) ?? [], note: (data.note as string) ?? null, maxPapers: Number(data.max_papers ?? 3), at: data.created_at as string };
}

export type Volunteer = { personId: string; name: string; institution: string | null; topics: string[]; note: string | null; maxPapers: number; at: string; role: string | null };
/** EM08/EM23: active volunteers (organizers only; others get an empty list). */
export async function getVenueVolunteers(venueId: string): Promise<Volunteer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("venue_volunteers", { p_venue: venueId });
  if (error || !Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((r) => ({ personId: r.person_id as string, name: (r.display_name as string) || "—", institution: (r.institution as string) ?? null,
    topics: (r.topics as string[]) ?? [], note: (r.note as string) ?? null, maxPapers: Number(r.max_papers ?? 3), at: r.created_at as string, role: (r.member_role as string) ?? null }));
}

export type BidMatch = { score: number; matched: string[] };
/** RV10: topic overlap per paper, plus whether I have any topics at all. */
export async function getBiddingMatches(venueId: string, personId: string | undefined): Promise<{ matches: Record<string, BidMatch>; hasTopics: boolean }> {
  const supabase = await createClient();
  const [{ data, error }, { count }] = await Promise.all([
    supabase.rpc("bidding_matches", { p_venue: venueId }),
    personId ? supabase.from("person_topics").select("topic", { count: "exact", head: true }).eq("person_id", personId) : Promise.resolve({ count: 0 }),
  ]);
  const matches = error || !Array.isArray(data) ? {} : Object.fromEntries((data as { submission_id: string; score: number; matched: string[] }[])
    .map((r) => [r.submission_id, { score: Number(r.score), matched: r.matched ?? [] }]));
  return { matches, hasTopics: (count ?? 0) > 0 };
}

/** RV03: my annotated PDF on an assignment. */
export async function getMyAnnotation(assignmentId: string): Promise<{ path: string; name: string; url: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reviews").select("annotated_path").eq("assignment_id", assignmentId).maybeSingle();
  const path = !error ? ((data?.annotated_path as string) ?? null) : null;
  if (!path) return null;
  const { data: signed } = await supabase.storage.from("papers").createSignedUrl(path, 600);
  return { path, name: path.split("/").pop() ?? "annotated.pdf", url: signed?.signedUrl ?? null };
}

export type Annotation = { assignmentId: string; n: number | null; reviewer: string | null; url: string | null };
/** EM24: reviewers' annotated PDFs for a paper (RLS lets only the handling AE and non-author chairs read them). */
export async function getAnnotations(submissionId: string): Promise<Annotation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("review_assignments")
    .select("id, ordinal, persons:reviewer_id(display_name), reviews(annotated_path)").eq("submission_id", submissionId);
  if (error || !data) return [];
  const rows = (data as unknown as { id: string; ordinal: number | null; persons: { display_name: string } | null; reviews: { annotated_path: string | null } | { annotated_path: string | null }[] | null }[])
    .map((r) => ({ r, path: (Array.isArray(r.reviews) ? r.reviews[0]?.annotated_path : r.reviews?.annotated_path) ?? null }))
    .filter((x) => !!x.path);
  return Promise.all(rows.map(async ({ r, path }) => {
    const { data: signed } = await supabase.storage.from("papers").createSignedUrl(path!, 600);
    return { assignmentId: r.id, n: r.ordinal, reviewer: r.persons?.display_name ?? null, url: signed?.signedUrl ?? null };
  }));
}

/** Venues where I have completed at least one review (for certificate links). */
export function certificateVenues(rows: { status: string; venue_slug: string; venue_short: string }[]): { slug: string; short: string; n: number }[] {
  const m = new Map<string, { slug: string; short: string; n: number }>();
  for (const r of rows) if (r.status === "submitted") { const x = m.get(r.venue_slug) ?? { slug: r.venue_slug, short: r.venue_short, n: 0 }; x.n++; m.set(r.venue_slug, x); }
  return [...m.values()];
}
