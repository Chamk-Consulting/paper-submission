import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MyPaper } from "@/lib/workspace/data";

/* Reads for WS01 (workspace home) and VN01 (my venue page). Every RPC fails soft: a missing migration shows an empty state. */

export type ReviewRow = { assignment_id: string; submission_id: string; status: string; round: number; reply_by: string | null; due_at: string | null; submitted_at: string | null; paper_number: number | null; title: string; venue_short: string; venue_slug: string };
export type ChairRow = { session_id: string; venue_id: string; venue_short: string; venue_slug: string; code: string | null; title: string; room: string | null; starts_at: string; ends_at: string | null; talks: number | null };
export type CoauthorRow = { submission_id: string; number: number | null; title: string; venue_short: string; submitted_at: string | null };
export type InboxRow = { thread_id: string; subject: string; venue: string | null; last_body: string | null; last_from: string | null; last_at: string; unread: boolean };
export type DateRow = { venue_id: string; kind: string; label: string; starts_at: string };

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, args);
  return error || !Array.isArray(data) ? [] : (data as T[]);
}

export const getMyReviews = () => rpc<ReviewRow>("my_reviews");
export const getMyChairedSessions = () => rpc<ChairRow>("my_chaired_sessions");
export const getMyCoauthorRequests = () => rpc<CoauthorRow>("my_coauthor_requests");
export async function getMyInbox(limit = 4): Promise<InboxRow[]> {
  const rows = await rpc<InboxRow & { archived?: boolean }>("my_inbox");
  return rows.filter((r) => !r.archived).sort((a, b) => (a.last_at < b.last_at ? 1 : -1)).slice(0, limit);
}

export async function getVenueDates(venueIds: string[]): Promise<DateRow[]> {
  if (!venueIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("venue_dates").select("venue_id, kind, label, starts_at").in("venue_id", venueIds).order("starts_at");
  return (data as DateRow[] | null) ?? [];
}

export async function getMyTopics(personId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("person_topics").select("topic").eq("person_id", personId);
  return error ? [] : ((data as { topic: string }[] | null) ?? []).map((r) => r.topic);
}

export type Announcement = { id: string; title: string; body: string; author_role: string | null; published_at: string };
export async function getAnnouncements(venueId: string, limit = 5): Promise<Announcement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements").select("id, title, body, author_role, published_at").eq("venue_id", venueId).order("published_at", { ascending: false }).limit(limit);
  return error ? [] : ((data as Announcement[] | null) ?? []);
}

export type ContactRow = { person_id: string; display_name: string; role: string };
export const getVenueContacts = (venueId: string) => rpc<ContactRow>("venue_contacts", { p_venue: venueId });

/** null = not following (or the column isn't there yet). */
export async function getFollow(venueId: string, personId: string): Promise<{ following: boolean; email: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("venue_follows").select("*").eq("venue_id", venueId).eq("person_id", personId).maybeSingle();
  if (error || !data) return { following: false, email: false };
  const row = data as { email_announcements?: boolean };
  return { following: true, email: row.email_announcements ?? true };
}

/* ---------------------------------------------------------------- due-next items (WS01 / VN01) */

export type DueRole = "author" | "reviewer" | "chair";
export type DueItem = {
  id: string; role: DueRole; tag: string; title: string; venue: string; detail: [string, Record<string, string | number>?];
  at: string | null; action: string; href: string;
};

const nextDate = (dates: DateRow[], venueId: string, kinds: string[], now: number) =>
  dates.filter((d) => d.venue_id === venueId && kinds.includes(d.kind) && Date.parse(d.starts_at) > now).sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1))[0] ?? null;

export function buildDueItems(input: { papers: MyPaper[]; reviews: ReviewRow[]; coauthor: CoauthorRow[]; sessions: ChairRow[]; dates: DateRow[]; now: number }): DueItem[] {
  const { papers, reviews, coauthor, sessions, dates, now } = input;
  const out: DueItem[] = [];
  for (const r of reviews) {
    const venue = r.venue_short;
    const num = r.paper_number ? `#${r.paper_number}` : "";
    if (r.status === "invited") {
      out.push({ id: `inv-${r.assignment_id}`, role: "reviewer", tag: "INVITATION", title: r.title, venue, detail: num ? ["{num} · reply to the invitation", { num }] : ["Reply to the invitation"], at: r.reply_by, action: "Reply", href: "/reviews" });
    } else if (r.status === "accepted") {
      out.push({ id: `rev-${r.assignment_id}`, role: "reviewer", tag: "REVIEW", title: r.title, venue, detail: r.round > 1 ? ["{num} · round {n}", { num, n: r.round }] : [num || "Review"], at: r.due_at, action: "Continue review", href: `/reviews/${r.assignment_id}` });
    }
  }
  for (const c of coauthor) {
    out.push({ id: `co-${c.submission_id}`, role: "author", tag: "CO-AUTHOR", title: c.title, venue: c.venue_short, detail: ["Confirm you are a co-author"], at: null, action: "Confirm", href: `/submissions/${c.submission_id}` });
  }
  for (const p of papers) {
    const venue = p.venue.shortName ?? p.venue.name;
    if (p.stage === "draft") {
      const d = nextDate(dates, p.venue.id, ["submission"], now);
      out.push({ id: `dr-${p.id}`, role: "author", tag: "SUBMISSION", title: p.title || "Untitled draft", venue, detail: [p.detail || "Draft"], at: d?.starts_at ?? null, action: "Continue", href: p.href });
    } else if (p.stage === "revise") {
      const d = nextDate(dates, p.venue.id, ["rebuttal", "final"], now);
      out.push({ id: `rv-${p.id}`, role: "author", tag: "REVISION", title: p.title, venue, detail: [p.detail || "Revise and resubmit"], at: d?.starts_at ?? null, action: "Revise", href: p.href });
    } else if (p.stage === "final") {
      const d = nextDate(dates, p.venue.id, ["final"], now);
      const left = [p.checks.pdf !== "ok" ? "PDF" : "", p.checks.copyright !== "ok" ? "copyright" : "", p.checks.registration !== "ok" ? "registration" : ""].filter(Boolean).join(", ");
      out.push({ id: `fv-${p.id}`, role: "author", tag: "FINAL VERSION", title: p.title, venue, detail: left ? ["Still to do: {list}", { list: left }] : [p.detail || "Final version"], at: d?.starts_at ?? null, action: "Open", href: p.href });
    }
  }
  for (const s of sessions) {
    if (Date.parse(s.ends_at ?? s.starts_at) < now) continue;
    out.push({ id: `se-${s.session_id}`, role: "chair", tag: "SESSION", title: s.title, venue: s.venue_short, detail: s.talks ? ["{where} · {n} talks", { where: [s.code, s.room].filter(Boolean).join(" · ") || "—", n: s.talks }] : [[s.code, s.room].filter(Boolean).join(" · ") || "Session"], at: s.starts_at, action: "Open session", href: `/chair/${s.session_id}` });
  }
  return out.sort((a, b) => (a.at ?? "9999") < (b.at ?? "9999") ? -1 : 1);
}

/** Request time for dynamic pages (after connection(), so it is never baked into a prerender). */
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}
