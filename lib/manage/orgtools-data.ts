import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { CHAIR_ROLES, ORGANIZER_ROLES, ROLE_LABEL, type EventCtx, type EventSettings, type EventVenue } from "@/lib/manage/data";

/* Loaders for EM33 similarity, EM34 awards and BL01 billing. */

export type SimilarityRow = {
  submission_id: string; number: number; title: string; stage: string; score: number | null; score_excl: number | null; top_source: string | null;
  sources: { title: string; pct: number | null; url?: string; allowed?: boolean }[]; report_url: string | null; provider: string | null;
  status: "pending" | "ready"; checked_at: string | null; checked_by: string | null; updated_at: string | null;
};

export async function loadSimilarity(venueId: string): Promise<SimilarityRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("similarity_overview", { p_venue: venueId });
  return ((data ?? []) as SimilarityRow[]).map((r) => ({ ...r, score: r.score === null ? null : Number(r.score), score_excl: r.score_excl === null ? null : Number(r.score_excl) }));
}

export type Nomination = {
  id: string; submission_id: string; number: number; title: string; reason: string | null; shortlisted: boolean; nominated_by: string | null;
  student: boolean; authors: string | null; avg_score: number | null; votes: number | null; conflict: boolean;
};
export type Award = {
  id: string; name: string; max_shortlist: number; winner: string | null; announced_at: string | null;
  committee: { person_id: string; name: string }[]; i_vote: boolean; my_vote: string | null; votes_cast: number | null; nominations: Nomination[];
};
export type AwardsBoard = {
  is_chair: boolean; awards: Award[]; nominable: { submission_id: string; number: number; title: string }[]; members: { person_id: string; name: string }[];
};

export async function loadAwards(venueId: string): Promise<AwardsBoard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("awards_board", { p_venue: venueId });
  if (error || !data) return null;
  const b = data as AwardsBoard;
  b.members = [...new Map(b.members.map((m) => [m.person_id, m])).values()].sort((a, c) => (a.name ?? "").localeCompare(c.name ?? ""));
  return b;
}

export type Invoice = {
  id: string; number: string; issued_on: string; due_on: string; description: string; amount_cents: number | null; currency: string;
  status: "due" | "paid" | "void"; method: "card" | "bank" | null; invoice_sent_at: string | null; paid_at: string | null;
};
export type Billing = {
  billing: null | { plan: "workshop" | "conference" | "society" | null; price_cents: number | null; currency: string; submission_limit: number | null; ai_limit: number | null;
    billing_name: string | null; vat_number: string | null; billing_address: string | null; po_number: string | null; invoice_email: string | null };
  invoices: Invoice[]; submissions: number; ai_uses: number;
};

export async function loadBilling(venueId: string): Promise<Billing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("billing_overview", { p_venue: venueId });
  if (error || !data) return null;
  const b = data as Billing;
  return { ...b, submissions: Number(b.submissions), ai_uses: Number(b.ai_uses) };
}

/**
 * EM34 is also open to award-committee members who hold no organizer role (a reviewer asked to vote).
 * Same context as requireEvent, but the role check is the awards_board RPC itself.
 */
export async function requireAwardsAccess(slug: string): Promise<{ ctx: EventCtx; board: AwardsBoard }> {
  const ws = await getWorkspaceCtx();
  if (!ws) redirect(`/sign-in?next=${encodeURIComponent(`/manage/${slug}/awards`)}`);
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug) || !ws.me.person) notFound();
  const supabase = await createClient();
  const { data: venue } = await supabase.from("venues").select("*").eq("slug", slug).maybeSingle();
  if (!venue) notFound();
  const board = await loadAwards(venue.id as string);
  if (!board) redirect(`/no-access?from=${encodeURIComponent(`/manage/${slug}/awards`)}`);
  const { data: mem } = await supabase.from("venue_members").select("role").eq("venue_id", venue.id).eq("person_id", ws.me.person.id);
  const roles = ((mem ?? []) as { role: string }[]).map((m) => m.role);
  const { data: settings } = await supabase.from("venue_settings").select("*").eq("venue_id", venue.id).maybeSingle();
  const isOwner = roles.includes("owner");
  const ctx: EventCtx = {
    ws, venue: venue as EventVenue, settings: (settings as EventSettings) ?? null, sections: [], roles,
    roleLabel: ROLE_LABEL[roles.find((r) => (ORGANIZER_ROLES as readonly string[]).includes(r)) ?? roles[0]] ?? "Award committee",
    isOwner, isChair: roles.some((r) => (CHAIR_ROLES as readonly string[]).includes(r)),
    isOrganizer: roles.some((r) => (ORGANIZER_ROLES as readonly string[]).includes(r)), isAE: roles.includes("associate_editor"),
    locked: !!(settings as EventSettings | null)?.locked_at, label: (venue.short_name as string) || (venue.name as string),
  };
  return { ctx, board };
}

