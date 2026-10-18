import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { KeywordsForm } from "@/components/submission/keywords-form";
import { asideCard } from "@/components/submission/shell";
import { DEFAULT_KEYWORDS } from "@/lib/submission/data";
import { Reveal } from "@/components/motion/reveal";
import { WizardSkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Keywords") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "keywords");
  const t = await getT();
  const groups = ctx.venue.details.keyword_groups?.length ? ctx.venue.details.keyword_groups : DEFAULT_KEYWORDS;
  return (
    <SubmissionFrame ctx={ctx} step="keywords" aside={
      <section className={asideCard}>
        <h3 className="m-0 text-[17px] font-semibold">{t("Choosing well")}</h3>
        <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
          <li>{t("Main keyword = the field your contribution belongs to, not the application.")}</li>
          <li>{t("Use ★ to make any keyword the main one.")}</li>
          <li>{t("Too broad (e.g. \"Control\") makes reviewer matching weaker.")}</li>
        </ul>
        {/* TODO(review): reviewer-pool size per keyword once reviewers record their expertise. */}
      </section>
    }>
      <KeywordsForm id={id} venueName={ctx.venue.acr} groups={groups} initial={ctx.sub.keywords} own={ctx.sub.ownKeywords} />
    </SubmissionFrame>
  );
}

/** Canvas SB04-Keywords. */
export default function Page(props: P) {
  return <Reveal fallback={<WizardSkeleton step="keywords" />}><Inner {...props} /></Reveal>;
}
