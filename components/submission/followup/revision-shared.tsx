import Link from "@/components/site/link";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/components/submission/frame";
import { asideCard } from "@/components/submission/shell";
import type { Flow } from "@/components/submission/followup/flow-frame";
import { DECISION_LABEL, commentsOf, loadDecision, loadPaperReviews, loadRevision } from "@/lib/submission/followup-data";

/* Shared loading, rail and aside of the revision flow (SB14–SB14d). */

export async function loadRevisionFlow(id: string, opts: { allowSubmitted?: boolean } = {}) {
  const ctx = await requireCtx(id, "status");
  if (ctx.sub.stage !== "revise") redirect(`/submissions/${id}`);
  const [decision, reviews, revision] = await Promise.all([loadDecision(id), loadPaperReviews(id), loadRevision(id)]);
  const submitted = !!revision && revision.status !== "draft";
  if (submitted && !opts.allowSubmitted) redirect(`/submissions/${id}/revision/done`);
  let comments = commentsOf(reviews).map((c) => ({ ...c, assignmentId: c.assignmentId as string | null }));
  if (!comments.length) comments = [{ key: "general:1", assignmentId: null, label: "", ordinal: "", no: 1, quote: "" }];
  const saved = new Map((revision?.responses ?? []).map((r) => [`${r.assignmentId ?? "general"}:${r.commentNo}`, r]));
  const items = comments.map((c) => ({ ...c, response: saved.get(c.key)?.response ?? "", changedIn: saved.get(c.key)?.changedIn ?? "" }));
  const answered = items.filter((i) => i.response.trim().length > 5).length;
  const files = {
    revision: ctx.files.find((f) => f.role === "revision" && f.current),
    highlighted: ctx.files.find((f) => f.role === "highlighted" && f.current),
    supplementary: ctx.files.find((f) => f.role === "supplementary" && f.current),
  };
  const done = { responses: answered === items.length && answered > 0, files: !!files.revision && files.revision.check.status !== "failed", submitted };
  return { ctx, decision, reviews, revision, items, answered, files, done, due: decision?.revisionDueAt ?? null };
}

type RF = Awaited<ReturnType<typeof loadRevisionFlow>>;

export async function revisionFlow(f: RF, current: number): Promise<Flow> {
  const t = await getT();
  const base = `/submissions/${f.ctx.sub.id}`;
  const defs: [string, string, boolean][] = [
    [t("Decision & reviews"), `${base}/revision`, true],
    [t("Respond to reviewers"), `${base}/revision/respond`, f.done.responses],
    [t("Revised files"), `${base}/revision/files`, f.done.files],
    [t("Review & submit"), `${base}/revision/review`, f.done.submitted],
  ];
  return {
    name: t("Revision"), mark: 50 + current,
    steps: defs.map(([label, href, ok], i) => ({ label, href: f.done.submitted ? undefined : href, state: i === current ? "current" : ok || (i === 0 && current > 0) ? "done" : "todo" })),
    note: current === 3 ? t("This is the last step.") : t("Your work is saved each time you continue."),
  };
}

export async function RevisionAside({ f }: { f: RF }) {
  const t = await getT();
  const base = `/submissions/${f.ctx.sub.id}`;
  return (
    <>
      <section className={asideCard}>
        <h3 className="m-0 text-[17px] font-semibold">{t("Decision")}</h3>
        <p className="mt-2"><span className="rounded-[3px] bg-[#FBEFDD] px-2 py-0.5 font-mono text-[12px] uppercase tracking-[0.06em] text-[#7A4508]">{t(f.decision ? DECISION_LABEL[f.decision.decision] : "Conditionally accepted")}</span></p>
        {f.decision?.editorSummary ? <p className="mt-2 line-clamp-4 text-[14px] text-[#4A5263]">{f.decision.editorSummary}</p> : null}
        <Link href={`${base}/decision`} className="mt-2 inline-block text-[15px] text-[#2F5FD0]">{t("Read the full reviews")}</Link>
      </section>
      <section className={asideCard}>
        <h3 className="m-0 text-[17px] font-semibold">{t("Your responses")}</h3>
        <p className="mt-1.5 text-[15px]">{f.done.responses ? "✓ " : ""}{t("{n} of {total} comments answered", { n: f.answered, total: f.items.length })}</p>
      </section>
    </>
  );
}
