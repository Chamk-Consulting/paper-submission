/* Pure helpers shared by ops1 server code and client components (no server-only imports). */

export const DECISIONS = ["accept_oral", "accept_poster", "conditional", "reject"] as const;
export type Decision = (typeof DECISIONS)[number] | "desk_reject";

export const DECISION_LABEL: Record<string, string> = {
  accept_oral: "Accept · oral", accept_poster: "Accept · poster", conditional: "Conditional accept", reject: "Reject", desk_reject: "Desk rejected",
};
export const DECISION_SHORT: Record<string, string> = { accept_oral: "Oral", accept_poster: "Poster", conditional: "Conditional", reject: "Reject" };
export const DECISION_COLOR: Record<string, string> = { accept_oral: "#18744F", accept_poster: "#18744F", conditional: "#A8600F", reject: "#B3261E", desk_reject: "#B3261E" };

/** Which email template a decision uses. */
export const templateFor = (d: string) => (d.startsWith("accept") ? "decision_accept" : d === "conditional" ? "decision_conditional" : "decision_reject");

export const AE_REC_LABEL: Record<string, string> = { accept_oral: "ACCEPT · ORAL", accept_poster: "ACCEPT · POSTER", conditional: "CONDITIONAL", reject: "REJECT" };
export const REVIEW_REC_LABEL: Record<string, string> = {
  accept: "ACCEPT", weak_accept: "WEAK ACCEPT", borderline: "BORDERLINE", weak_reject: "WEAK REJECT", reject: "REJECT",
  major_revision: "MAJOR REVISION", accept_minor: "MINOR REVISION", another_revision: "ANOTHER REVISION",
};

/** Tag colours for a recommendation (canvas EM24/EM26). */
export function recTone(rec: string | null): [string, string] {
  if (!rec) return ["#EEF0EC", "#4A5263"];
  if (rec === "accept" || rec.startsWith("accept_")) return ["#E1F3EA", "#14603F"];
  if (rec.includes("reject")) return ["#FDECEA", "#B3261E"];
  return ["#FBEFDD", "#7A4508"];
}

export function scoreTone(v: number): [string, string] {
  return v >= 4 ? ["#E1F3EA", "#14603F"] : v >= 3 ? ["#EEF0EC", "#4A5263"] : ["#FDECEA", "#B3261E"];
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
const STOP = new Set(["and", "the", "for", "with", "of", "systems", "system", "control", "based"]);

/** Topic match 0–100 between a paper's topic and a person's topics (exact topic = 100, shared words scale the rest). */
export function topicMatch(paperTopic: string | null, topics: string[]): number {
  if (!paperTopic || !topics.length) return 0;
  const p = norm(paperTopic).trim();
  if (topics.some((t) => norm(t).trim() === p)) return 100;
  const pw = new Set(words(paperTopic));
  if (!pw.size) return 0;
  let best = 0;
  for (const t of topics) {
    const tw = words(t);
    if (!tw.length) continue;
    const hit = tw.filter((w) => pw.has(w)).length;
    best = Math.max(best, Math.round((hit / Math.max(pw.size, tw.length)) * 90));
  }
  return best;
}

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** CSV text from rows (RFC 4180 quoting). */
export function toCsv(head: string[], rows: (string | number | null)[][]): string {
  const q = (v: string | number | null) => { const s = v == null ? "" : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [head, ...rows].map((r) => r.map(q).join(",")).join("\r\n");
}

export const paperId = (n: number | null) => (n == null ? "—" : `#${String(n).padStart(4, "0")}`);
