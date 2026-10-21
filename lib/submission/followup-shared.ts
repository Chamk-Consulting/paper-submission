// Plain helpers shared by server pages and client forms (no "use client": server components may call them).
import type { SubFile } from "@/lib/submission/data";

export const WITHDRAW_REASONS: [string, string][] = [
  ["error", "Found an error in the results"],
  ["other_venue", "Submitted to another venue"],
  ["not_ready", "Not ready — will submit later"],
  ["disagreement", "Author disagreement"],
  ["other", "Other"],
];

/** Number of failed and warning checks on an uploaded PDF. */
export function checkSummary(file: SubFile | undefined) {
  const items = (file?.check.items ?? []) as { level?: string }[];
  return { fails: items.filter((i) => i.level === "fail").length, warns: items.filter((i) => i.level === "warn").length };
}
