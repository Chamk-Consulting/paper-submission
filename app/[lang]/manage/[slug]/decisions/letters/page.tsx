import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { ManagePage } from "@/components/manage/chrome";
import { Rules } from "@/components/manage/ops1/kit";
import { LettersRelease, type LetterGroup } from "@/components/manage/ops1/letters-release";
import { Reveal } from "@/components/motion/reveal";
import { OpsSplitSkeleton } from "@/components/skeletons/ops1";
import { loadBatches, loadLetterReviews, loadMilestones, loadPaperAuthors, loadPapers, loadTemplates } from "@/lib/manage/ops1-data";
import { buildLetter } from "@/lib/manage/ops1-letters";
import { emailConfigured } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";
import { DECISIONS, paperId, templateFor } from "@/lib/manage/ops1-shared";

/* EM27 — decision letters & release. */

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Decision letters & release") };
}

const PREVIEWS = 20;
const TPL_NAME: Record<string, string> = { decision_accept: "Decision — accept", decision_conditional: "Decision — conditional accept", decision_reject: "Decision — reject" };

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug, "chair");
  const t = await getT();
  const v = ctx.venue;
  const [papers, authors, reviews, tpls, ms, batches] = await Promise.all([
    loadPapers(v.id), loadPaperAuthors(v.id), loadLetterReviews(v.id), loadTemplates(v.id, ["decision_accept", "decision_conditional", "decision_reject"]), loadMilestones(v.id), loadBatches(v.id),
  ]);
  const pending = papers.filter((p) => p.decision && p.decision !== "desk_reject" && !p.released);
  const supabase = await createClient();
  const ids = pending.map((p) => p.id).slice(0, 2000);
  const [{ data: d }, { data: recs }] = await Promise.all([
    ids.length ? supabase.from("decisions").select("submission_id, letter").in("submission_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("ae_recommendations").select("submission_id, summary").not("sent_at", "is", null).in("submission_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const letters = new Map(((d ?? []) as { submission_id: string; letter: string | null }[]).map((x) => [x.submission_id, x.letter]));
  const sums = new Map(((recs ?? []) as { submission_id: string; summary: string }[]).map((x) => [x.submission_id, x.summary]));
  const firstAuthor = new Map<string, { name: string; email: string | null }>();
  for (const a of authors) if (!firstAuthor.has(a.submissionId) || a.corresponding) firstAuthor.set(a.submissionId, { name: a.givenName || a.name, email: a.email });
  const finals = ms.find((m) => m.key === "finals")?.at ?? null;
  const venue = { short: ctx.label, name: v.name };

  const groups: LetterGroup[] = DECISIONS.map((dec) => {
    const list = pending.filter((p) => p.decision === dec);
    const byType: Record<string, number> = {};
    for (const p of list) byType[p.paperType] = (byType[p.paperType] ?? 0) + 1;
    return {
      decision: dec, template: t(TPL_NAME[templateFor(dec)]), count: list.length, byType,
      previews: list.slice(0, PREVIEWS).map((p) => {
        const fa = firstAuthor.get(p.id);
        const l = buildLetter({ submissionId: p.id, number: p.number, title: p.title, decision: dec, letter: letters.get(p.id) ?? null, summary: sums.get(p.id) ?? null, revisionDue: null }, fa?.name ?? "", venue, tpls, reviews, finals);
        return { paper: `${paperId(p.number)} · ${p.title}`, to: fa?.email ?? t("authors"), subject: l.subject, text: l.text, missing: l.missing.filter((m) => m !== "deadline") };
      }),
    };
  }).filter((g) => g.count > 0);

  const open = papers.filter((p) => ["submitted", "review", "decision"].includes(p.stage) && !p.decision);
  const undByType: Record<string, number> = {};
  for (const p of open) undByType[p.paperType] = (undByType[p.paperType] ?? 0) + 1;
  const types = [...new Set(pending.map((p) => p.paperType))];
  const last = batches[0] ?? null;

  return (
    <ManagePage ctx={ctx} active="decisions" crumb={<>{t("Organizer")} · {ctx.label} · {t("Decisions")}</>} title={t("Decision letters & release")} sub={t("Check one letter per decision, then release them all at once.")}>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_280px]">
        <LettersRelease slug={slug} groups={groups} undecided={open.length} undecidedByType={undByType} types={types} emailOn={emailConfigured()}
          batch={last ? { id: last.id, releasedAt: last.releasedAt, recipients: last.recipients, delivered: last.delivered, bounced: last.bounced, paperType: last.paperType } : null} />
        <Rules title={t("Rules on this page")} items={[
          ["F4", t("Drafts until release; release for all or by type.")],
          ["F5", t("After release, changes need owner approval + new letter.")],
          ["F6", t("Confidential comments never in letters.")],
          ["I3", t("Over 500 recipients: confirm twice.")],
          ["I4", t("Decision emails can’t be unsubscribed.")],
        ]} />
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<OpsSplitSkeleton active="decisions" />}><Inner {...props} /></Reveal>;
}
