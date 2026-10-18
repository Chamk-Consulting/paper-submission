import { DEFAULT_TRACKS } from "@/lib/submission/steps";
import type { WizardVenue } from "@/lib/submission/data";
import type { TypeOption } from "@/components/submission/type-form";

const pad = (n: number) => String(n).padStart(2, "0");
export function closesIn(deadline: string | null, now = Date.now()) {
  if (!deadline) return "open";
  const ms = Date.parse(deadline) - now;
  if (ms <= 0) return "closed";
  return `closes in ${Math.floor(ms / 864e5)}d ${pad(Math.floor((ms % 864e5) / 3600e3))}h`;
}

export function typeOptions(v: WizardVenue): TypeOption[] {
  const when = closesIn(v.deadline);
  const types = v.details.types?.length ? v.details.types : [{ name: "Regular paper", note: "Full research paper.", length: v.pageLimit ?? undefined, review: v.reviewMode ?? undefined }];
  return types.map((t) => ({
    name: t.name,
    note: t.note,
    tags: [t.length, t.review?.split("·")[0]?.trim(), /workshop|proposal/i.test(t.name) ? "Proposal" : "Proceedings"].filter(Boolean) as string[],
    when,
    closed: when === "closed",
  }));
}

export const tracksOf = (v: WizardVenue) => (v.details.tracks?.length ? v.details.tracks : DEFAULT_TRACKS);
