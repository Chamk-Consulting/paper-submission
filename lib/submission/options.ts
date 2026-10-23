import { DEFAULT_TRACKS } from "@/lib/submission/steps";
import type { WizardVenue } from "@/lib/submission/data";
import type { TypeOption } from "@/components/submission/type-form";
import { blindLabel, type SubmissionWindow } from "@/lib/venues/window";

const pad = (n: number) => String(n).padStart(2, "0");
/** English template + vars; translated where it's shown (t(when, whenVars)). */
export function closesIn(deadline: string | null, now = Date.now()): { when: string; whenVars?: Record<string, string | number> } {
  if (!deadline) return { when: "open" };
  const ms = Date.parse(deadline) - now;
  if (ms <= 0) return { when: "closed" };
  return { when: "closes in {d}d {h}h", whenVars: { d: Math.floor(ms / 864e5), h: pad(Math.floor((ms % 864e5) / 3600e3)) } };
}

/**
 * The types offered when starting a paper. With the submission window (lib/venues/window.ts) these are the organizers'
 * types from the database, each open or closed by the same rule the database applies; without it, the seeded list.
 */
export function typeOptions(v: WizardVenue, win: SubmissionWindow | null = null): TypeOption[] {
  if (win?.types.length) {
    return win.types.map((ty) => {
      const length = ty.pages ? `${ty.pages}${ty.extraPages ? ` + ${ty.extraPages}` : ""} pages` : v.pageLimit ?? undefined;
      const { when, whenVars } = !ty.open ? { when: "closed" } : closesIn(ty.deadline);
      return {
        name: ty.name, note: ty.note ?? undefined,
        tags: [length, blindLabel(ty.blind) ?? v.reviewMode?.split("·")[0]?.trim(), /workshop|proposal/i.test(ty.name) ? "Proposal" : "Proceedings"].filter(Boolean) as string[],
        when, whenVars, closed: !ty.open,
      };
    });
  }
  const { when, whenVars } = win && !win.papersOpen ? { when: "closed" } : closesIn(v.deadline);
  const types = v.details.types?.length ? v.details.types : [{ name: "Regular paper", note: "Full research paper.", length: v.pageLimit ?? undefined, review: v.reviewMode ?? undefined }];
  return types.map((t) => ({
    name: t.name,
    note: t.note,
    tags: [t.length, t.review?.split("·")[0]?.trim(), /workshop|proposal/i.test(t.name) ? "Proposal" : "Proceedings"].filter(Boolean) as string[],
    when,
    whenVars,
    closed: when === "closed",
  }));
}

export const tracksOf = (v: WizardVenue) => (v.details.tracks?.length ? v.details.tracks : DEFAULT_TRACKS);
