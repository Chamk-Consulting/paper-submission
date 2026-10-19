import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMe, type Me } from "@/lib/auth/me";
import type { VenueDate, VenueDetails } from "@/lib/venues/types";

import { STEPS, type StepKey } from "@/lib/submission/steps";
export { STEPS, type StepKey };

export type WizardVenue = {
  id: string; slug: string; acr: string; name: string; kind: string; society: string | null; field: string | null;
  location: string | null; startsOn: string | null; reviewMode: string | null; pageLimit: string | null; doubleBlind: boolean;
  details: VenueDetails & { tracks?: string[]; keyword_groups?: { group: string; keywords: string[] }[] };
  dates: VenueDate[]; deadline: string | null;
};

export type Author = { personId: string; position: number; corresponding: boolean; name: string; email: string | null; institution: string | null; plenaryId: string | null; isYou: boolean; hasAccount: boolean };
export type SubFile = { id: string; role: "paper" | "appendix" | "source" | "data" | "video" | "revision" | "highlighted" | "final" | "slides" | "supplementary"; path: string; name: string; size: number; mime: string; pages: number | null; check: { status?: string; items?: { key: string; label: string; value: string; detail: string; level: "ok" | "warn" | "fail" }[] }; version: number; current: boolean; createdAt: string };
export type Conflict = { id: string; personId: string | null; institution: string | null; reason: string };

export type Submission = {
  id: string; venueId: string; number: number | null; title: string; abstract: string | null; shortTitle: string | null; paperType: string; track: string | null;
  stage: string; stageDetail: string | null; draftStep: number; declarations: { original?: boolean; preprint?: boolean; student_award?: boolean };
  keywords: string[]; ownKeywords: string[]; conflictsOkAt: string | null; submittedAt: string | null; updatedAt: string; withdrawnAt: string | null;
  pdfCheck: string; copyrightCheck: string; registrationCheck: string;
  /** EM13 test paper: organizer only, never numbered or counted. */
  isTest: boolean; testSubmittedAt: string | null;
};

export type Ctx = {
  me: Me; sub: Submission; venue: WizardVenue; authors: Author[]; files: SubFile[]; conflicts: Conflict[];
  drafts: { id: string; title: string }[]; editable: boolean; done: Record<StepKey, boolean>;
};

const words = (s: string | null) => (s?.trim() ? s.trim().split(/\s+/).length : 0);

export function stepDone(sub: Submission, authors: Author[], files: SubFile[]): Record<StepKey, boolean> {
  const paper = files.find((f) => f.role === "paper" && f.current);
  return {
    type: !!sub.paperType && !!sub.track,
    details: !!sub.title && sub.title !== "Untitled paper" && words(sub.abstract) > 0 && words(sub.abstract) <= 250 && !!sub.declarations.original,
    authors: authors.length > 0 && authors.filter((a) => a.corresponding).length === 1,
    keywords: sub.keywords.length >= 3,
    files: !!paper && paper.check.status !== "failed",
    conflicts: !!sub.conflictsOkAt,
    review: sub.stage !== "draft" || !!sub.testSubmittedAt,
  };
}

export async function loadVenueById(venueId: string): Promise<WizardVenue | null> {
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("venues")
    .select("id, slug, short_name, name, kind, society, field, location, starts_on, review_mode, page_limit, double_blind, details, venue_dates(id, kind, label, starts_at, ends_at, is_hard, is_extended, extended_from)")
    .eq("id", venueId)
    .maybeSingle();
  return v ? mapVenue(v as Record<string, unknown>) : null;
}

export async function loadVenueBySlug(slug: string): Promise<WizardVenue | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) return null;
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("venues")
    .select("id, slug, short_name, name, kind, society, field, location, starts_on, review_mode, page_limit, double_blind, details, venue_dates(id, kind, label, starts_at, ends_at, is_hard, is_extended, extended_from)")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return v ? mapVenue(v as Record<string, unknown>) : null;
}

function mapVenue(v: Record<string, unknown>): WizardVenue {
  const dates = ((v.venue_dates as Record<string, unknown>[]) ?? [])
    .map((d) => ({ id: d.id as string, kind: d.kind as VenueDate["kind"], label: d.label as string, startsAt: d.starts_at as string, endsAt: (d.ends_at as string) ?? null, isHard: !!d.is_hard, isExtended: !!d.is_extended, extendedFrom: (d.extended_from as string) ?? null }))
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  const now = Date.now();
  return {
    id: v.id as string, slug: v.slug as string, acr: (v.short_name as string) || (v.name as string), name: v.name as string, kind: v.kind as string,
    society: (v.society as string) ?? null, field: (v.field as string) ?? null, location: (v.location as string) ?? null, startsOn: (v.starts_on as string) ?? null,
    reviewMode: (v.review_mode as string) ?? null, pageLimit: (v.page_limit as string) ?? null, doubleBlind: !!v.double_blind,
    details: (v.details as WizardVenue["details"]) ?? {}, dates,
    deadline: dates.find((d) => d.kind === "submission" && Date.parse(d.startsAt) > now)?.startsAt ?? null,
  };
}

/** Everything a wizard step needs. null = not found or not yours (RLS). */
export async function loadSubmission(id: string): Promise<Ctx | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const me = await getMe();
  if (!me?.person) return null;
  const supabase = await createClient();
  const { data: s } = await supabase.from("submissions").select("*").eq("id", id).maybeSingle();
  if (!s) return null;
  const [venue, { data: authorRows }, { data: fileRows }, { data: conflictRows }, { data: draftRows }] = await Promise.all([
    loadVenueById(s.venue_id as string),
    supabase.rpc("submission_author_list", { p_submission: id }),
    supabase.from("submission_files").select("*").eq("submission_id", id).order("created_at", { ascending: false }),
    supabase.from("submission_conflicts").select("*").eq("submission_id", id).order("created_at"),
    supabase.from("submissions").select("id, title, submission_authors!inner(person_id)").eq("venue_id", s.venue_id).eq("stage", "draft").eq("submission_authors.person_id", me.person.id).order("created_at"),
  ]);
  if (!venue) return null;

  const sub: Submission = {
    id: s.id, venueId: s.venue_id, number: s.number, title: s.title, abstract: s.abstract, shortTitle: s.short_title, paperType: s.paper_type, track: s.track,
    stage: s.stage, stageDetail: s.stage_detail, draftStep: s.draft_step ?? 1, declarations: s.declarations ?? {}, keywords: s.keywords ?? [], ownKeywords: s.own_keywords ?? [],
    conflictsOkAt: s.conflicts_ok_at, submittedAt: s.submitted_at, updatedAt: s.updated_at, withdrawnAt: s.withdrawn_at,
    pdfCheck: s.pdf_check, copyrightCheck: s.copyright_check, registrationCheck: s.registration_check,
    isTest: !!s.is_test, testSubmittedAt: (s.test_submitted_at as string) ?? null,
  };
  const authors: Author[] = ((authorRows ?? []) as Record<string, unknown>[]).map((a) => ({
    personId: a.person_id as string, position: a.author_position as number, corresponding: !!a.is_corresponding, name: (a.display_name as string) || (a.email as string) || "Unnamed",
    email: (a.email as string) ?? null, institution: (a.institution as string) ?? null, plenaryId: (a.plenary_id as string) ?? null, isYou: !!a.is_you, hasAccount: !!a.has_account,
  }));
  const files: SubFile[] = ((fileRows ?? []) as Record<string, unknown>[]).map((f) => ({
    id: f.id as string, role: f.role as SubFile["role"], path: f.storage_path as string, name: f.file_name as string, size: Number(f.size_bytes), mime: f.mime_type as string,
    pages: (f.pages as number) ?? null, check: (f.check_result as SubFile["check"]) ?? {}, version: f.version as number, current: !!f.is_current, createdAt: f.created_at as string,
  }));
  const conflicts: Conflict[] = ((conflictRows ?? []) as Record<string, unknown>[]).map((c) => ({ id: c.id as string, personId: (c.person_id as string) ?? null, institution: (c.institution as string) ?? null, reason: c.reason as string }));
  const open = !!venue.deadline || venue.kind === "journal";
  return {
    me, sub, venue, authors, files, conflicts,
    drafts: ((draftRows ?? []) as { id: string; title: string }[]).map((d) => ({ id: d.id, title: d.title })),
    // a test paper can be filled in before submissions open (the database checks the organizer role)
    editable: (open || sub.isTest) && (sub.stage === "draft" || sub.stage === "submitted"),
    done: stepDone(sub, authors, files),
  };
}

export { DEFAULT_TRACKS, DEFAULT_KEYWORDS } from "@/lib/submission/steps";
