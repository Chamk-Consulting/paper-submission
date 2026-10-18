import "server-only";
import { absUrl, renderTemplate } from "@/lib/email/send";
import { templateFor, paperId, REVIEW_REC_LABEL } from "@/lib/manage/ops1-shared";
import type { LetterReview, Template } from "@/lib/manage/ops1-data";

/* Decision letters (EM27, F6): template + editor summary + comments to authors. Confidential comments are never loaded here. */

export type LetterInput = {
  submissionId: string; number: number | null; title: string; decision: string; letter: string | null; summary: string | null; revisionDue: string | null;
};
export type Letter = { subject: string; text: string; missing: string[] };

const fallbackTemplates: Record<string, Template> = {
  decision_accept: { key: "decision_accept", subject: "Decision on [paper.id] — accepted", body: "Dear [author.first],\n\n“[paper.title]” has been accepted to [venue.short].\n\n[link]" },
  decision_conditional: { key: "decision_conditional", subject: "Decision on [paper.id] — conditional accept", body: "Dear [author.first],\n\n“[paper.title]” is conditionally accepted.\n\n[link]" },
  decision_reject: { key: "decision_reject", subject: "Decision on [paper.id]", body: "Dear [author.first],\n\nThank you for submitting “[paper.title]” to [venue.short]. We are sorry to tell you it was not accepted.\n\n[link]" },
};

export function buildLetter(p: LetterInput, firstName: string, venue: { short: string; name: string }, tpls: Record<string, Template>, reviews: LetterReview[], finalsDue: string | null): Letter {
  const key = templateFor(p.decision);
  const tpl = tpls[key] ?? fallbackTemplates[key];
  const deadline = p.decision === "conditional" ? p.revisionDue : finalsDue;
  const vars = {
    "author.first": firstName || "author", "paper.id": paperId(p.number), "paper.title": p.title, "venue.short": venue.short, "venue.name": venue.name,
    deadline: deadline ? new Date(deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "the date shown in Plenary",
    link: absUrl(`/submissions/${p.submissionId}`),
  };
  const subj = renderTemplate(tpl.subject, vars);
  const body = renderTemplate(tpl.body, vars);
  const parts = [body.text];
  if (p.decision === "accept_oral") parts.push("Presentation format: oral.");
  if (p.decision === "accept_poster") parts.push("Presentation format: poster.");
  if (p.letter?.trim()) parts.push(p.letter.trim());
  if (p.summary?.trim()) parts.push(`Summary from the associate editor\n\n${p.summary.trim()}`);
  const mine = reviews.filter((r) => r.submissionId === p.submissionId && r.toAuthors.trim());
  mine.forEach((r, i) => {
    const sc = Object.values(r.scores);
    const avg = sc.length ? ` · average score ${(sc.reduce((a, b) => a + Number(b), 0) / sc.length).toFixed(1)}` : "";
    parts.push(`Reviewer ${r.ordinal ?? i + 1}${r.recommendation ? ` · ${REVIEW_REC_LABEL[r.recommendation] ?? r.recommendation}` : ""}${avg}\n\n${r.toAuthors.trim()}`);
  });
  return { subject: subj.text, text: parts.join("\n\n"), missing: [...new Set([...subj.missing, ...body.missing])] };
}
