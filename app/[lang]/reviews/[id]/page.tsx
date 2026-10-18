import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { ReviewSkeleton } from "@/components/skeletons/review";
import { ReviewForm } from "@/components/review/review-form";
import { Crumbs, Head, NotYours } from "@/components/review/parts";
import { loadReview } from "@/lib/review/page";
import { getT } from "@/lib/i18n/server";
import { nowMs } from "@/lib/review/format";
import { ui } from "@/components/manage/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Review") };
}

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id, ctx, form, t, no, ae } = await loadReview(params);
  if (!form) return <WorkspaceShell ctx={ctx} active="reviews"><NotYours t={t} /></WorkspaceShell>;
  const a = form.assignment;
  if (a.status === "invited" || a.status === "expired" || a.status === "declined") redirect(`/reviews/invitations/${id}`);
  if (a.round > 1 && a.status === "accepted") redirect(`/reviews/${id}/round-2`);

  const withdrawn = form.paper.stage === "withdrawn";
  const mode = withdrawn || a.locked_at || !["accepted", "submitted"].includes(a.status) ? "readonly" : a.status === "submitted" ? "submitted" : "edit";
  const readonlyReason = withdrawn ? "withdrawn" : a.locked_at ? "locked" : mode === "readonly" ? "closed" : null;
  const r = form.review;

  return (
    <WorkspaceShell ctx={ctx} active="reviews">
      <Crumbs items={[[t("Reviews"), "/reviews"], [no, null]]} />
      <Head
        title={t("Review {no}", { no })}
        sub={`${form.paper.title} · ${form.venue.short}${a.ordinal ? ` · ${t("reviewer {n} of {m}", { n: a.ordinal, m: Math.max(a.total, a.ordinal) })}` : ""}`}
        right={form.paper.pdf_path ? <Link href={`/reviews/${id}/paper`} className={ui.ghost}>{t("Open paper")}</Link> : null}
      />
      <ReviewForm
        id={id} no={no} criteria={form.settings.criteria}
        initial={{ scores: r?.scores ?? {}, recommendation: r?.recommendation ?? null, confidence: r?.confidence ?? null, to_authors: r?.to_authors ?? "", to_editor: r?.to_editor ?? "" }}
        updatedAt={r?.updated_at && (r.to_authors || Object.keys(r.scores ?? {}).length) ? r.updated_at : null}
        mode={mode} readonlyReason={readonlyReason}
        dueAt={a.due_at} serverNow={nowMs()} ae={ae} aiPolicy={form.settings.ai_policy} blind={form.settings.blind_type}
        submittedAt={a.submitted_at} withdrawnAt={form.paper.withdrawn_at} notesInReview={Number(form.notes_in_review ?? 0)}
      />
    </WorkspaceShell>
  );
}

/** Canvas RV03-ReviewForm. */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Reveal fallback={<ReviewSkeleton variant="form" />}>
      <Inner params={params} />
    </Reveal>
  );
}
