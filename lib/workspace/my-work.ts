import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadMyChairedSessions, loadProgram, type Session } from "@/lib/program/data";
import type { EventRow } from "@/lib/workspace/events-pages";

/* My work: what the side menu counts (things waiting for you) and the cross-event lists behind Talks & sessions and
   Agenda. Everything runs as the signed-in person. */

const DAY = 86_400_000;
export const NEEDS_STAGES = new Set(["draft", "revise", "final"]);
const ACCEPTED = new Set(["decision", "final", "done"]);

export type WorkCounts = { papers: number; papersSoon: boolean; reviews: number; reviewsSoon: boolean; hasReviews: boolean; hasTalks: boolean };

/** Next date of an event after `now` (its deadlines, then its start). */
export function nextDateOf(r: EventRow | undefined, now: number): number | null {
  const d = r?.v.dates.find((x) => Date.parse(x.startsAt) > now);
  return d ? Date.parse(d.startsAt) : null;
}

/** Side-menu counts. Papers: drafts, revisions, final versions and co-author requests. Reviews: invitations + reviews due.
 *  "Soon" (amber) when one of them is due within 7 days. */
export async function getWorkCounts(personId: string | undefined, rows: EventRow[], now: number, roles: string[]): Promise<WorkCounts> {
  const empty: WorkCounts = { papers: 0, papersSoon: false, reviews: 0, reviewsSoon: false, hasReviews: false, hasTalks: roles.includes("session_chair") };
  if (!personId) return empty;
  const supabase = await createClient();
  const [{ data: auth }, { data: revs }] = await Promise.all([
    supabase.from("submission_authors").select("confirmation, submissions(stage, venue_id)").eq("person_id", personId),
    supabase.rpc("my_reviews"),
  ]);
  const byVenue = new Map(rows.map((r) => [r.v.id, r]));
  const soon = (venueId: string) => { const n = nextDateOf(byVenue.get(venueId), now); return n != null && n - now <= 7 * DAY; };
  let papers = 0; let papersSoon = false; let accepted = false;
  for (const a of (auth ?? []) as unknown as { confirmation: string | null; submissions: { stage: string; venue_id: string } | null }[]) {
    const s = a.submissions;
    if (!s || s.stage === "withdrawn" || s.stage === "rejected") continue;
    if (ACCEPTED.has(s.stage) && !byVenue.get(s.venue_id)?.past) accepted = true;
    if (a.confirmation === "pending" || NEEDS_STAGES.has(s.stage)) { papers++; if (soon(s.venue_id)) papersSoon = true; }
  }
  const list = (revs ?? []) as { status: string; reply_by: string; due_at: string }[];
  const open = list.filter((r) => r.status === "invited" || r.status === "accepted");
  const reviewsSoon = open.some((r) => Date.parse(r.status === "invited" ? r.reply_by : r.due_at) - now <= 7 * DAY);
  const reviewerRole = roles.some((x) => x === "reviewer" || x === "associate_editor");
  return { papers, papersSoon, reviews: open.length, reviewsSoon, hasReviews: list.length > 0 || reviewerRole, hasTalks: empty.hasTalks || accepted };
}

/* ---------------------------------------------------------------- Talks & sessions */
export type TalkItem = {
  id: string; kind: "present" | "chair"; venueShort: string; venueSlug: string; timezone: string; code: string; sessionTitle: string; sessionId: string;
  title: string; number: number | null; submissionId: string | null; startsAt: string; endsAt: string; room: string | null; ready?: number; total?: number;
};

async function programsOf(slugs: string[]) {
  const out = await Promise.all(slugs.slice(0, 12).map((s) => loadProgram(s)));
  return out.filter((x): x is NonNullable<typeof x> => !!x);
}

/** Talks I give (from each event's program) and sessions I chair, in time order. */
export async function loadTalksAndSessions(personId: string | undefined, rows: EventRow[]): Promise<TalkItem[]> {
  const myPaperIds = new Set(rows.flatMap((r) => (r.mine?.papers ?? []).map((p) => p.id)));
  const slugs = rows.filter((r) => (r.mine?.papers ?? []).some((p) => ACCEPTED.has(p.stage))).map((r) => r.v.slug);
  const [chaired, programs] = await Promise.all([loadMyChairedSessions(), programsOf(slugs)]);
  const items: TalkItem[] = chaired.map((c) => ({
    id: `c:${c.id}`, kind: "chair", venueShort: c.venueShort, venueSlug: c.venueSlug, timezone: c.timezone, code: c.code, sessionTitle: c.title, sessionId: c.id,
    title: c.title, number: null, submissionId: null, startsAt: c.startsAt, endsAt: c.endsAt, room: c.room, ready: c.ready, total: c.total,
  }));
  for (const { venue, sessions } of programs) {
    for (const s of sessions) {
      if (!s.iPresent) continue;
      for (const k of s.talks) {
        const mine = k.presenterId ? k.presenterId === personId : !!k.submissionId && myPaperIds.has(k.submissionId);
        if (!mine) continue;
        const start = k.startsAt ?? s.startsAt;
        items.push({
          id: `t:${k.id}`, kind: "present", venueShort: venue.shortName ?? venue.name, venueSlug: venue.slug, timezone: venue.timezone, code: s.code,
          sessionTitle: s.title, sessionId: s.id, title: k.title, number: k.number, submissionId: k.submissionId, startsAt: start,
          endsAt: new Date(Date.parse(start) + (k.talkMin + k.qaMin) * 60_000).toISOString(), room: s.room,
        });
      }
    }
  }
  return items.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/* ---------------------------------------------------------------- Agenda */
export type AgendaItem = {
  id: string; type: "talk" | "chair" | "saved" | "deadline"; venueShort: string; venueSlug: string; timezone: string;
  title: string; code: string | null; startsAt: string; endsAt: string | null; room: string | null; href: string; hard?: boolean;
};

const kindOf = (s: Session): AgendaItem["type"] => (s.iPresent ? "talk" : s.iChair ? "chair" : "saved");

/** Everything on your timetable from now on: sessions you present, chair or saved, plus the deadlines of events you're part of. */
export async function loadAgenda(rows: EventRow[], now: number): Promise<AgendaItem[]> {
  const live = rows.filter((r) => !r.past);
  const programs = await programsOf(live.map((r) => r.v.slug));
  const items: AgendaItem[] = [];
  for (const { venue, sessions } of programs) {
    for (const s of sessions) {
      if (!(s.saved || s.iChair || s.iPresent) || Date.parse(s.endsAt) < now) continue;
      items.push({
        id: `s:${s.id}`, type: kindOf(s), venueShort: venue.shortName ?? venue.name, venueSlug: venue.slug, timezone: venue.timezone, title: s.title, code: s.code,
        startsAt: s.startsAt, endsAt: s.endsAt, room: s.room, href: s.iChair ? `/chair/${s.id}` : `/workspace/events/${venue.slug}/program`,
      });
    }
  }
  const tzOf = new Map(programs.map((x) => [x.venue.slug, x.venue.timezone]));
  for (const r of live) {
    if (!r.mine) continue; // deadlines only for events you take part in (followed ones are on Following)
    const tz = tzOf.get(r.v.slug) ?? "UTC";
    for (const d of r.v.dates) {
      if (Date.parse(d.startsAt) < now) continue;
      items.push({ id: `d:${d.id}`, type: "deadline", venueShort: r.v.acr, venueSlug: r.v.slug, timezone: tz, title: d.label, code: null, startsAt: d.startsAt, endsAt: null, room: null, href: `/workspace/events/${r.v.slug}`, hard: d.isHard });
    }
  }
  return items.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
