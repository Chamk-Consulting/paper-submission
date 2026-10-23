import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/*
 * "Can I submit here, and until when?" — the same rule the database applies when a draft is started
 * (public.venue_submission_window → private.type_open_for). Every screen that offers "Submit" reads this,
 * so a closed event or type shows "Closed" before anyone clicks.
 */

export type WindowType = {
  name: string; note: string | null; pages: number | null; extraPages: number | null; blind: string | null;
  open: boolean; deadline: string | null; closedAt: string | null;
};
export type SubmissionWindow = { open: boolean; papersOpen: boolean; deadline: string | null; closedAt: string | null; types: WindowType[] };

export async function getSubmissionWindow(venueId: string): Promise<SubmissionWindow | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("venues", `window:${venueId}`);
  if (!/^[0-9a-f-]{36}$/i.test(venueId)) return null;
  const { data, error } = await createPublicClient().rpc("venue_submission_window", { p_venue: venueId });
  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  const types = (Array.isArray(d.types) ? d.types : []) as Record<string, unknown>[];
  return {
    open: !!d.open, papersOpen: !!d.papers_open, deadline: (d.deadline as string) ?? null, closedAt: (d.closed_at as string) ?? null,
    types: types.map((x) => ({
      name: String(x.name), note: (x.note as string) ?? null, pages: x.pages == null ? null : Number(x.pages), extraPages: x.extra_pages == null ? null : Number(x.extra_pages),
      blind: (x.blind as string) ?? null, open: !!x.open, deadline: (x.deadline as string) ?? null, closedAt: (x.closed_at as string) ?? null,
    })),
  };
}

/** The window for one type; types the organizers didn't list follow the paper deadline. */
export function typeWindow(w: SubmissionWindow | null, name: string): { open: boolean; deadline: string | null; closedAt: string | null } {
  const ty = w?.types.find((x) => x.name === name);
  if (ty) return ty;
  return { open: w?.papersOpen ?? false, deadline: w?.deadline ?? null, closedAt: w?.closedAt ?? null };
}

/** "2 Feb 2027" in the reader's language. Deadlines are stored as instants; the calendar day is read in UTC. */
export function fmtDay(iso: string | null, intl: string): string | null {
  if (!iso) return null;
  try { return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso)); } catch { return iso.slice(0, 10); }
}

export const blindLabel = (b: string | null) => (b === "double" ? "Double-blind" : b === "single" ? "Single-blind" : b === "open" ? "Open review" : null);

/**
 * Page limit for a paper type, as text the PDF check understands ("6 + 2 pages"): the organizers' type in the database
 * first, then the old seeded list, then the venue's general limit.
 */
export async function pageLimitFor(venue: { id: string; pageLimit: string | null; details: { types?: { name: string; length?: string }[] } }, paperType: string): Promise<string | null> {
  const w = await getSubmissionWindow(venue.id);
  const ty = w?.types.find((x) => x.name === paperType);
  if (ty?.pages) return `${ty.pages}${ty.extraPages ? ` + ${ty.extraPages}` : ""} pages`;
  return venue.details.types?.find((x) => x.name === paperType)?.length ?? venue.pageLimit;
}
