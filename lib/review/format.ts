import { DAY_MS } from "@/lib/review/shared";

/** "in 3 days" / "today" / "2 days ago" in the reader's language. */
export function relDay(iso: string, now: number, intl: string) {
  const d = Math.round((new Date(iso).getTime() - now) / DAY_MS);
  return new Intl.RelativeTimeFormat(intl, { numeric: "auto" }).format(d, "day");
}

/** Request time for server components (kept out of render bodies for the purity lint). */
export const nowMs = () => Date.now();
