import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireEvent, groupStatus, lastChange } from "@/lib/manage/data";
import { ManagePage, SetupLayout } from "@/components/manage/chrome";
import { ReviewForm, type ReviewSettings } from "@/components/manage/setup1/review-form";
import { Reveal } from "@/components/motion/reveal";
import { Setup1Skeleton } from "@/components/skeletons/setup1";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Review setup") };
}

/** EM07 — review setup. */
async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const s = (ctx.settings ?? {}) as Record<string, unknown>;
  const n = (k: string, d: number) => (typeof s[k] === "number" ? (s[k] as number) : d);
  const b = (k: string, d: boolean) => (typeof s[k] === "boolean" ? (s[k] as boolean) : d);
  const settings: ReviewSettings = {
    blind_type: (s.blind_type as string) ?? "double", min_reviews: n("min_reviews", 3), max_reviewers: n("max_reviewers", 4), ae_cap: n("ae_cap", 15), invite_days: n("invite_days", 3),
    ai_policy: (s.ai_policy as string) ?? "language_only", criteria: (s.criteria as ReviewSettings["criteria"]) ?? [],
    bidding: b("bidding", false), discussion: b("discussion", true), named_discussion: b("named_discussion", false), rebuttal: b("rebuttal", false), round2: b("round2", true),
  };
  return (
    <ManagePage ctx={ctx} active="setup" crumb={<>{t("Setup")} · {ctx.label}</>} title={t("Review setup")} sub={t("How papers are reviewed, by how many people, and on what form.")}>
      <SetupLayout ctx={ctx} current="review">
        <ReviewForm slug={slug} s={settings} status={groupStatus(ctx, ["review"])} last={lastChange(ctx, ["review"])} canEdit={ctx.isChair} locked={ctx.locked} lockedForMe={ctx.locked && !ctx.isOwner} />
      </SetupLayout>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<Setup1Skeleton rows={4} />}><Inner {...props} /></Reveal>;
}
