/* Shared (client + server) definitions for setup screens EM04, EM05, EM07. */

export type MilestoneKey = "submissions_open" | "paper_deadline" | "ae_assignment" | "reviewer_assignment" | "reviews_due" | "decisions" | "finals" | "registration" | "conference";

/** The nine milestones of EM04, in phase order (C3). `kind` = venue_date_kind used on the public page. */
export const MILESTONES: { key: MilestoneKey; label: string; note: string; kind: string; hard: boolean; startOfDay?: boolean }[] = [
  { key: "submissions_open", label: "Submissions open", note: "Public page shows “Submit”", kind: "other", hard: false, startOfDay: true },
  { key: "paper_deadline", label: "Paper deadline", note: "Regular papers", kind: "submission", hard: true },
  { key: "ae_assignment", label: "AE assignment done", note: "Internal", kind: "internal", hard: false },
  { key: "reviewer_assignment", label: "Reviewer assignment done", note: "Internal", kind: "internal", hard: false },
  { key: "reviews_due", label: "Reviews due", note: "Reviewers see this", kind: "review", hard: false },
  { key: "decisions", label: "Decisions released", note: "Authors see this", kind: "notification", hard: false },
  { key: "finals", label: "Final versions due", note: "PDF + copyright", kind: "final", hard: true },
  { key: "registration", label: "Registration deadline", note: "One per paper", kind: "registration", hard: true },
  { key: "conference", label: "Conference starts", note: "First day of the event", kind: "conference", hard: false, startOfDay: true },
];

/** C6: each pair [a, b] means a must be strictly before b. Final versions and registration may share a date. */
export const ORDER: [MilestoneKey, MilestoneKey][] = [
  ["submissions_open", "paper_deadline"], ["paper_deadline", "ae_assignment"], ["ae_assignment", "reviewer_assignment"],
  ["reviewer_assignment", "reviews_due"], ["reviews_due", "decisions"], ["decisions", "finals"], ["finals", "conference"], ["registration", "conference"],
];

/** A calendar date (YYYY-MM-DD) as the AoE instant: 23:59 AoE (UTC−12), or 00:00 AoE for "starts" milestones (C1). */
export function aoeInstant(date: string, startOfDay = false): string {
  return `${date}T${startOfDay ? "00:00:00" : "23:59:00"}-12:00`;
}
/** The AoE calendar date of a stored instant. */
export function aoeDate(iso: string): string {
  return new Date(new Date(iso).getTime() - 12 * 3600e3).toISOString().slice(0, 10);
}

export type DateProblem = { a: MilestoneKey; b: MilestoneKey };
export function dateProblems(values: Partial<Record<MilestoneKey, string>>): DateProblem[] {
  const out: DateProblem[] = [];
  for (const [a, b] of ORDER) {
    const va = values[a], vb = values[b];
    if (!va || !vb) continue;
    const ia = aoeInstant(va, MILESTONES.find((m) => m.key === a)?.startOfDay);
    const ib = aoeInstant(vb, MILESTONES.find((m) => m.key === b)?.startOfDay);
    if (new Date(ia).getTime() >= new Date(ib).getTime()) out.push({ a, b });
  }
  return out;
}

/** EM05 submission form fields. */
export const FORM_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "title", label: "Title", hint: "Max 200 characters" },
  { key: "abstract", label: "Abstract", hint: "100–250 words" },
  { key: "authors", label: "Authors & affiliations", hint: "With ORCID where known" },
  { key: "keywords", label: "Keywords", hint: "3–5 from the list" },
  { key: "student", label: "Student paper?", hint: "For the best student paper award" },
  { key: "presented", label: "Previously presented?", hint: "Workshops without proceedings are fine" },
  { key: "conflicts", label: "Conflicts of interest", hint: "People and institutions" },
  { key: "funding", label: "Funding statement", hint: "" },
];
export const PDF_RULES: { key: string; label: string; hint?: string }[] = [
  { key: "fonts", label: "Check fonts are embedded" },
  { key: "page_size", label: "Check page size (US Letter)" },
  { key: "blind", label: "Blind check — no author names in PDF or metadata", hint: "Required for double-blind (D4)" },
  { key: "pdf_express", label: "Use IEEE PDF eXpress for final versions" },
  { key: "similarity", label: "Similarity check (iThenticate)", hint: "Flags only, never rejects (D9)" },
];

export type Criterion = { key: string; name: string; help: string };
export type CustomQuestion = { label: string; kind: "text" | "yesno"; required: boolean };
export const slugKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "criterion";
