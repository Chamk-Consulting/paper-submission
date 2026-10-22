import { cache } from "react";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMe, type Me } from "@/lib/auth/me";

export type VenueLink = { id: string; slug: string; name: string; shortName: string | null; roles: string[] };
export type WorkspaceCtx = {
  me: Me;
  initials: string;
  name: string;
  venues: VenueLink[];        // venues I'm a member of
  organizerOf: VenueLink | null; // first venue I own/chair (organizer nav)
  submissionCount: number;
  aeRoles: number;
  unread: number;            // inbox threads with unread messages
};

const COLORS = ["#2F5FD0", "#A8600F", "#18744F", "#6B4FBF", "#B3261E"];
export const venueColor = (i: number) => COLORS[i % COLORS.length];

/** Everything the workspace shell needs. RLS limits every read to the signed-in person. */
/** Header badge: one number. Falls back to counting the inbox on a database without my_unread_count. */
async function unreadCount(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number> {
  const { data, error } = await supabase.rpc("my_unread_count");
  if (!error) return Number(data ?? 0);
  const { data: rows } = await supabase.rpc("my_inbox");
  return Array.isArray(rows) ? (rows as { unread?: boolean; archived?: boolean }[]).filter((r) => r.unread && !r.archived).length : 0;
}

/** Once per request: the shell, the page and its parts all ask for it. */
export const getWorkspaceCtx = cache(async function getWorkspaceCtx(): Promise<WorkspaceCtx | null> {
  const me = await getMe();
  if (!me) return null;
  const supabase = await createClient();
  const pid = me.person?.id;

  const [{ data: members }, subs, inbox] = await Promise.all([
    pid
      ? supabase.from("venue_members").select("role, venues(id, slug, name, short_name)").eq("person_id", pid)
      : Promise.resolve({ data: [] as unknown[] }),
    pid
      ? supabase.from("submission_authors").select("submission_id", { count: "exact", head: true }).eq("person_id", pid)
      : Promise.resolve({ count: 0 }),
    // tolerate a database without the inbox tables yet
    pid ? unreadCount(supabase) : Promise.resolve(0),
  ]);

  const byVenue = new Map<string, VenueLink>();
  for (const m of (members ?? []) as { role: string; venues: { id: string; slug: string; name: string; short_name: string | null } | null }[]) {
    if (!m.venues) continue;
    const v = byVenue.get(m.venues.id) ?? { id: m.venues.id, slug: m.venues.slug, name: m.venues.name, shortName: m.venues.short_name, roles: [] };
    v.roles.push(m.role);
    byVenue.set(v.id, v);
  }
  const venues = [...byVenue.values()];
  const given = me.person?.given_name?.trim() ?? "";
  const family = me.person?.family_name?.trim() ?? "";
  const name = [given, family].filter(Boolean).join(" ") || me.email;
  const initials = ((given[0] ?? "") + (family[0] ?? "")).toUpperCase() || (me.email[0] ?? "?").toUpperCase();

  return {
    me,
    name,
    initials,
    venues,
    organizerOf: venues.find((v) => v.roles.some((r) => ["owner", "chair", "program_chair", "deputy_chair", "ceb_chair", "publication_chair", "registration_chair", "staff"].includes(r))) ?? null,
    submissionCount: ("count" in subs ? subs.count : 0) ?? 0,
    aeRoles: venues.filter((v) => v.roles.includes("associate_editor")).length,
    unread: inbox,
  };
});

export type Stage = "draft" | "submitted" | "review" | "decision" | "revise" | "final" | "done" | "rejected" | "withdrawn";
export type Check = "ok" | "need" | "no";
export type MyPaper = {
  id: string;
  href: string;
  number: number | null;
  title: string;
  paperType: string;
  role: string;
  stage: Stage;
  detail: string;
  checks: { pdf: Check; copyright: Check; registration: Check };
  venue: { id: string; slug: string; name: string; shortName: string | null; kind: string; location: string | null; startsOn: string | null };
  /** A co-author request I still have to confirm. */
  pending: boolean;
  updatedAt: string;
  /** Other authors' names, for search. */
  authors: string[];
};

type Row = {
  is_corresponding: boolean;
  position: number;
  confirmation: string | null;
  submissions: {
    id: string; number: number | null; title: string; paper_type: string; stage: Stage; stage_detail: string | null; draft_step: number | null;
    pdf_check: Check; copyright_check: Check; registration_check: Check; updated_at: string;
    venues: { id: string; slug: string; name: string; short_name: string | null; kind: string; location: string | null; starts_on: string | null } | null;
  } | null;
};

/** WS02: every paper I'm an author on. `ready: false` means the submissions migration isn't applied yet. */
export async function getMyPapers(personId: string | undefined): Promise<{ ready: boolean; papers: MyPaper[] }> {
  if (!personId) return { ready: true, papers: [] };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("submission_authors")
    .select(
      "is_corresponding, position, confirmation, submissions(id, number, title, paper_type, stage, stage_detail, draft_step, pdf_check, copyright_check, registration_check, updated_at, venues(id, slug, name, short_name, kind, location, starts_on))",
    )
    .eq("person_id", personId);
  if (error) return { ready: false, papers: [] };

  const papers = ((data ?? []) as unknown as Row[])
    .filter((r) => r.submissions?.venues)
    .map((r) => {
      const s = r.submissions!;
      const v = s.venues!;
      const role = r.is_corresponding ? "Corresponding author" : r.position === 1 ? "Author" : "Co-author";
      const detail = s.stage === "draft" ? `Step ${Math.min(s.draft_step ?? 1, 7)} of 7` : s.stage_detail ?? "";
      const STEP = ["type", "type", "details", "authors", "keywords", "files", "conflicts", "review"];
      const pending = r.confirmation === "pending";
      const href = pending ? `/submissions/${s.id}/confirm` : s.stage === "draft" ? `/submissions/${s.id}/${STEP[Math.min(s.draft_step ?? 1, 7)]}` : `/submissions/${s.id}`;
      return {
        id: s.id, href, number: s.number, title: s.title, paperType: s.paper_type, role, stage: s.stage, detail,
        checks: { pdf: s.pdf_check, copyright: s.copyright_check, registration: s.registration_check },
        venue: { id: v.id, slug: v.slug, name: v.name, shortName: v.short_name, kind: v.kind, location: v.location, startsOn: v.starts_on },
        pending, updatedAt: s.updated_at, authors: [] as string[],
      };
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  // co-authors' names, so a search for "Rabeh" finds the paper (rows the person can't see are simply missing)
  if (papers.length) {
    const { data: co } = await supabase.from("submission_authors").select("submission_id, persons(display_name, given_name, family_name)")
      .in("submission_id", papers.map((p) => p.id)).neq("person_id", personId);
    const by = new Map<string, string[]>();
    for (const r of (co ?? []) as unknown as { submission_id: string; persons: { display_name: string | null; given_name: string | null; family_name: string | null } | null }[]) {
      const n = r.persons ? r.persons.display_name || [r.persons.given_name, r.persons.family_name].filter(Boolean).join(" ") : "";
      if (n) by.set(r.submission_id, [...(by.get(r.submission_id) ?? []), n]);
    }
    for (const p of papers) p.authors = by.get(p.id) ?? [];
  }
  return { ready: true, papers };
}
