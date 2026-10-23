import Link from "@/components/site/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { ReviewSkeleton } from "@/components/skeletons/review";
import { Round2Form, type R2Item } from "@/components/review/round2-form";
import { Banner, Cols, Crumbs, Head, NotYours, asideLink, box, kick } from "@/components/review/parts";
import { loadReview } from "@/lib/review/page";
import { countdown, fmtDayYear } from "@/lib/review/shared";
import { getT } from "@/lib/i18n/server";
import { nowMs } from "@/lib/review/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Round 2") };
}

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id, ctx, form, t, no } = await loadReview(params, "/round-2");
  if (!form) return <WorkspaceShell ctx={ctx} active="reviews"><NotYours t={t} /></WorkspaceShell>;
  const a = form.assignment;
  if (a.status === "invited") redirect(`/workspace/reviews/invitations/${id}`);
  if (a.round < 2) redirect(`/workspace/reviews/${id}`);

  const items: R2Item[] = form.responses.length
    ? form.responses.map((r, i) => ({ n: r.n ?? i + 1, mine: r.quote ?? "", response: r.response || null, where: r.where }))
    : (form.previous?.to_authors ?? "").split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean).slice(0, 20).map((s, i) => ({ n: i + 1, mine: s, response: null, where: null }));
  const rv = form.review;
  const addressed = Object.fromEntries((rv?.round2 ?? []).filter((x) => x && typeof x.n === "number").map((x) => [x.n, x.addressed])) as Record<number, "yes" | "partly" | "no">;
  const readOnly = a.status !== "accepted" || !!a.locked_at || form.paper.stage === "withdrawn";
  const left = countdown(a.due_at, nowMs());

  return (
    <WorkspaceShell ctx={ctx} active="reviews">
      <Crumbs items={[[t("Reviews"), "/workspace/reviews"], [no, null], [t("Round 2"), null]]} />
      <Head title={t("Round 2 · {no}", { no })} sub={t("The authors revised the paper. Check whether each of your comments was addressed.")} />
      <Cols
        main={
          <>
            {a.status === "submitted" ? <Banner tone="ok">{t("Round-2 review submitted {d}.", { d: fmtDayYear(a.submitted_at, t.intl) })}</Banner> : null}
            {a.locked_at ? <Banner tone="info">{t("Read-only — the decision has started.")}</Banner> : null}
            <Round2Form id={id} items={items} readOnly={readOnly}
              initial={{ addressed, remaining: rv?.remaining_concerns ?? "", recommendation: rv?.recommendation ?? null, scores: rv?.scores ?? {}, confidence: rv?.confidence ?? null, to_authors: rv?.to_authors ?? "", to_editor: rv?.to_editor ?? "" }} />
          </>
        }
        aside={
          <>
            <section className={box}>
              <p className={kick}>{t("Round 2")}</p>
              <div className={`mt-1 font-serif text-[28px] leading-none ${left ? "" : "text-[#B3261E]"}`}>{left ?? t("Overdue")}</div>
              <p className="mb-0 mt-1.5 text-[13px] text-[#4A5263]">{t("Due {d}", { d: fmtDayYear(a.due_at, t.intl) })} · {t("Shorter form — about 30 minutes")}</p>
            </section>
            <section className={box}>
              <p className={kick}>{t("Paper")}</p>
              <Link href={`/workspace/reviews/${id}/paper`} className={asideLink}>{t("Read v2")}</Link>
              {form.previous ? <Link href={`/workspace/reviews/${form.previous.assignment_id}/submitted`} className={asideLink}>{t("My round-1 review")}</Link> : null}
            </section>
          </>
        }
      />
    </WorkspaceShell>
  );
}

/** Canvas RV09-Round2. */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Reveal fallback={<ReviewSkeleton variant="form" />}>
      <Inner params={params} />
    </Reveal>
  );
}
