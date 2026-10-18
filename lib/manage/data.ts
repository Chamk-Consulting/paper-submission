import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceCtx, type WorkspaceCtx } from "@/lib/workspace/data";

/* Shared loader for organizer screens (canvas EM01–EM44). RLS does the real checks; this decides what to render. */

export const ORGANIZER_ROLES = ["owner", "chair", "program_chair", "deputy_chair", "ceb_chair", "publication_chair", "registration_chair", "staff"] as const;
export const CHAIR_ROLES = ["owner", "chair", "program_chair", "deputy_chair"] as const;
const ROLE_ORDER = ["owner", "program_chair", "chair", "deputy_chair", "ceb_chair", "publication_chair", "registration_chair", "staff", "associate_editor", "session_chair", "reviewer"];
export const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", chair: "General chair", program_chair: "Program chair", deputy_chair: "Deputy chair", ceb_chair: "CEB chair",
  publication_chair: "Publication chair", registration_chair: "Registration chair", staff: "Staff", associate_editor: "Associate editor",
  session_chair: "Session chair", reviewer: "Reviewer", author: "Author",
};

export type SectionKey = "basics" | "dates" | "submission_types" | "submission_form" | "pdf_rules" | "review" | "committee" | "conflicts" | "emails" | "copyright" | "registration" | "program";
export type Section = { key: SectionKey; status: "not_started" | "in_progress" | "ready"; updatedAt: string | null; updatedBy: string | null };
export type EventVenue = Record<string, unknown> & {
  id: string; slug: string; name: string; short_name: string | null; kind: string; status: string; is_published: boolean;
  starts_on: string | null; ends_on: string | null; timezone: string; contact_email: string | null;
};
export type EventSettings = Record<string, unknown> & { venue_id: string; locked_at: string | null };

export type EventCtx = {
  ws: WorkspaceCtx; venue: EventVenue; settings: EventSettings | null; sections: Section[];
  roles: string[]; roleLabel: string; isOwner: boolean; isChair: boolean; isOrganizer: boolean; isAE: boolean; locked: boolean;
  label: string; // "CT 2027"
};

/** Load an event for an organizer screen. `allow` = which roles may open it (default organizers; AEs for paper screens). */
export async function requireEvent(slug: string, allow: "organizer" | "chair" | "owner" | "ae" = "organizer"): Promise<EventCtx> {
  const ws = await getWorkspaceCtx();
  if (!ws) redirect(`/sign-in?next=${encodeURIComponent(`/manage/${slug}`)}`);
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug) || !ws.me.person) notFound();
  const supabase = await createClient();
  const { data: venue } = await supabase.from("venues").select("*").eq("slug", slug).maybeSingle();
  if (!venue) notFound();
  const { data: mem } = await supabase.from("venue_members").select("role").eq("venue_id", venue.id).eq("person_id", ws.me.person.id);
  const roles = ((mem ?? []) as { role: string }[]).map((m) => m.role).sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
  const isOwner = roles.includes("owner");
  const isChair = roles.some((r) => (CHAIR_ROLES as readonly string[]).includes(r));
  const isOrganizer = roles.some((r) => (ORGANIZER_ROLES as readonly string[]).includes(r));
  const isAE = roles.includes("associate_editor");
  const ok = allow === "owner" ? isOwner : allow === "chair" ? isChair : allow === "ae" ? isOrganizer || isAE : isOrganizer;
  if (!ok) redirect(`/no-access?from=${encodeURIComponent(`/manage/${slug}`)}`);
  const [{ data: settings }, { data: secs }] = await Promise.all([
    supabase.from("venue_settings").select("*").eq("venue_id", venue.id).maybeSingle(),
    supabase.from("venue_setup_sections").select("key, status, updated_at, persons:updated_by(given_name, family_name)").eq("venue_id", venue.id),
  ]);
  const sections = ((secs ?? []) as unknown as { key: SectionKey; status: Section["status"]; updated_at: string | null; persons: { given_name: string; family_name: string } | null }[])
    .map((x) => ({ key: x.key, status: x.status, updatedAt: x.updated_at, updatedBy: x.persons ? `${x.persons.given_name} ${x.persons.family_name}`.trim() : null }));
  return {
    ws, venue: venue as EventVenue, settings: (settings as EventSettings) ?? null, sections, roles,
    roleLabel: ROLE_LABEL[roles[0]] ?? "Member", isOwner, isChair, isOrganizer, isAE,
    locked: !!(settings as EventSettings | null)?.locked_at, label: (venue.short_name as string) || (venue.name as string),
  };
}

/** Setup groups as the canvas sub-nav shows them (EM03–EM11): one page may cover several checklist sections. */
export const SETUP_GROUPS: { key: string; label: string; path: string; sections: SectionKey[] }[] = [
  { key: "basics", label: "Basics & branding", path: "basics", sections: ["basics"] },
  { key: "dates", label: "Dates & phases", path: "dates", sections: ["dates"] },
  { key: "submissions", label: "Submission types, form & PDF", path: "submissions", sections: ["submission_types", "submission_form", "pdf_rules"] },
  { key: "review", label: "Review setup", path: "review", sections: ["review"] },
  { key: "committee", label: "Committee & conflicts", path: "committee", sections: ["committee", "conflicts"] },
  { key: "emails", label: "Emails", path: "emails", sections: ["emails"] },
  { key: "publishing", label: "Copyright, registration & fees", path: "publishing", sections: ["copyright", "registration"] },
  { key: "program", label: "Program & rooms", path: "program", sections: ["program"] },
];

export function groupStatus(ctx: EventCtx, keys: SectionKey[]): Section["status"] {
  const st = keys.map((k) => ctx.sections.find((s) => s.key === k)?.status ?? "not_started");
  if (st.every((s) => s === "ready")) return "ready";
  if (st.every((s) => s === "not_started")) return "not_started";
  return "in_progress";
}
export function lastChange(ctx: EventCtx, keys: SectionKey[]): { at: string | null; by: string | null } {
  const s = ctx.sections.filter((x) => keys.includes(x.key) && x.updatedAt).sort((a, b) => (a.updatedAt! < b.updatedAt! ? 1 : -1))[0];
  return { at: s?.updatedAt ?? null, by: s?.updatedBy ?? null };
}
