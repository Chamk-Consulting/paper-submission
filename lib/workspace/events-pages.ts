import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getDirectory } from "@/lib/venues/data";
import { getMyEvents } from "@/lib/workspace/events";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import type { DirectoryVenue } from "@/lib/venues/types";
import type { MyEvent } from "@/lib/workspace/event-action";

/* Events › My events / Following / Past events: one list of the events a person has a part in or follows. */

export type MyRegistration = { id: string; number: string; status: string; paid: boolean; invoice: string | null; badges: number };
export type EventRow = { v: DirectoryVenue; mine: MyEvent | null; following: boolean; past: boolean; reg: MyRegistration | null };

const DAY = 86_400_000;
/** Over the day after it ends (or after it starts when no end date). Events with no dates are never past. */
export function isPast(v: DirectoryVenue, now = Date.now()): boolean {
  const end = v.endsOn ?? v.startsOn;
  return !!end && Date.parse(`${end}T23:59:59Z`) + DAY < now;
}

export async function getEventRows(): Promise<{ rows: EventRow[]; generatedAt: string; signedIn: boolean }> {
  const [ctx, { venues, generatedAt }, mine] = await Promise.all([getWorkspaceCtx(), getDirectory(), getMyEvents()]);
  if (!ctx) return { rows: [], generatedAt, signedIn: false };
  const supabase = await createClient();
  const pid = ctx.me.person?.id;
  const { data: regs } = pid
    ? await supabase.from("registrations").select("id, venue_id, number, status, paid_at, invoice_number, badges").eq("person_id", pid).neq("status", "cancelled")
    : { data: [] };
  const regBy = new Map(((regs ?? []) as { id: string; venue_id: string; number: string; status: string; paid_at: string | null; invoice_number: string | null; badges: number }[])
    .map((r) => [r.venue_id, { id: r.id, number: r.number, status: r.status, paid: !!r.paid_at || r.status === "confirmed", invoice: r.invoice_number, badges: r.badges }]));
  const now = Date.parse(generatedAt);
  const rows: EventRow[] = [];
  for (const v of venues) {
    const m = mine[v.slug];
    const reg = regBy.get(v.id) ?? null;
    if (!m && !reg) continue;
    rows.push({ v, mine: m && (m.roles.length || m.papers.length) ? m : null, following: !!m?.following, past: isPast(v, now), reg });
  }
  return { rows, generatedAt, signedIn: true };
}

/** Earliest relevant date first (the next deadline, else the start date); events without dates last. */
export function byNext(now: number) {
  const key = (v: DirectoryVenue) => {
    const next = v.dates.find((d) => Date.parse(d.startsAt) > now);
    return next ? Date.parse(next.startsAt) : v.startsOn ? Date.parse(v.startsOn) : Number.MAX_SAFE_INTEGER;
  };
  return (a: EventRow, b: EventRow) => key(a.v) - key(b.v);
}
