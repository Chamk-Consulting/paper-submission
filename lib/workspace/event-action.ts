/* Shared by server pages and client cards: what someone has at an event, and the one action that matters most. */
export type Stage = "draft" | "submitted" | "review" | "decision" | "revise" | "final" | "done" | "rejected" | "withdrawn";
export type MyEventPaper = { id: string; href: string; title: string; number: number | null; stage: Stage; detail: string };
export type MyEvent = { roles: string[]; papers: MyEventPaper[]; following: boolean };
export type MyEvents = Record<string, MyEvent>;

/** Draft → continue it; a paper in progress after the call closed → open it; call open → submit; else view the event. */
export function primaryAction(slug: string, mine: MyEvent | undefined, open: boolean, submitUrl?: string | null): { label: string; href: string; external?: boolean } {
  const draft = mine?.papers.find((p) => p.stage === "draft");
  if (draft) return { label: "Continue draft", href: draft.href };
  const live = mine?.papers.find((p) => !["withdrawn", "rejected", "done"].includes(p.stage));
  if (live && !open) return { label: "Open my paper", href: live.href };
  if (open) return submitAction(slug, submitUrl);
  return { label: "View event", href: `/workspace/events/${slug}` };
}

/** Role names as shown on chips (owner → Owner…), most senior first, no duplicates. */
const ROLE_ORDER = ["owner", "program_chair", "chair", "deputy_chair", "ceb_chair", "publication_chair", "registration_chair", "staff", "associate_editor", "session_chair", "reviewer"];
const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", program_chair: "Program chair", chair: "Chair", deputy_chair: "Deputy chair", ceb_chair: "CEB chair",
  publication_chair: "Publication chair", registration_chair: "Registration chair", staff: "Staff", associate_editor: "Associate editor",
  session_chair: "Session chair", reviewer: "Reviewer",
};
export function roleChips(roles: string[]): string[] {
  return [...new Set(roles)].filter((r) => ROLE_LABEL[r]).sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)).map((r) => ROLE_LABEL[r]);
}
export const STAGE_LABEL: Record<Stage, string> = {
  draft: "Draft", submitted: "Submitted", review: "In review", decision: "Decision", revise: "Revise", final: "Final version", done: "Published", rejected: "Not accepted", withdrawn: "Withdrawn",
};
export const STAGE_TONE: Record<Stage, [string, string]> = {
  draft: ["#FFF6E6", "#7A4508"], submitted: ["#E6EDFC", "#1F47A8"], review: ["#E6EDFC", "#1F47A8"], decision: ["#E6EDFC", "#1F47A8"],
  revise: ["#FFF6E6", "#7A4508"], final: ["#E5F3EC", "#14603F"], done: ["#E5F3EC", "#14603F"], rejected: ["#EEF0EC", "#4A5263"], withdrawn: ["#EEF0EC", "#4A5263"],
};

/** Submit: here, or on the outside site the organizers set (Setup › Basics › "Submissions on another site"). */
export function submitAction(slug: string, submitUrl?: string | null): { label: string; href: string; external?: boolean } {
  return submitUrl && /^https:\/\//.test(submitUrl) ? { label: "Submit a paper", href: submitUrl, external: true } : { label: "Submit a paper", href: `/submit/${slug}` };
}
