import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { KeywordsForm } from "@/components/submission/keywords-form";
import { asideCard } from "@/components/submission/shell";
import { DEFAULT_KEYWORDS } from "@/lib/submission/data";
import { Reveal } from "@/components/motion/reveal";
import { WizardSkeleton } from "@/components/skeletons";
import { getKeywordPool } from "@/lib/reviewpolish/data";

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
  const pool = await getKeywordPool(ctx.venue.id, ctx.sub.keywords);
  const main = ctx.sub.keywords[0];
  return (
    <SubmissionFrame ctx={ctx} step="keywords" aside={
      <>
      {pool && main ? (
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{t("Reviewer pool")}</h3>
          <p className="mb-0 mt-1.5 font-serif text-[34px] leading-none">{pool[main] ?? 0}</p>
          <p className="mb-0 mt-1 text-[14px] text-[#4A5263]">{t("reviewers at this venue list your main keyword ({keyword}).", { keyword: t(main) })}</p>
          {ctx.sub.keywords.length > 1 ? (
            <ul className="mb-0 mt-3 flex list-none flex-col gap-1 p-0 text-[14px]">
              {ctx.sub.keywords.slice(1).map((k) => (
                <li key={k} className="flex justify-between gap-3"><span className="min-w-0 truncate">{t(k)}</span><span className="font-mono text-[#4A5263]">{pool[k] ?? 0}</span></li>
              ))}
            </ul>
          ) : null}
          {(pool[main] ?? 0) < 3 ? <p className="mb-0 mt-3 rounded-[6px] bg-[#FBEFDD] px-3 py-2 text-[13px] text-[#7A4508]">{t("Few reviewers list this keyword. A broader main keyword may get your paper reviewed faster.")}</p> : null}
          <p className="mb-0 mt-3 text-[12px] text-[#4A5263]">{t("Counts only — reviewers stay anonymous. Updated when you save.")}</p>
        </section>
      ) : null}
      <section className={asideCard}>
        <h3 className="m-0 text-[17px] font-semibold">{t("Choosing well")}</h3>
        <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
          <li>{t("Main keyword = the field your contribution belongs to, not the application.")}</li>
          <li>{t("Use ★ to make any keyword the main one.")}</li>
          <li>{t("Too broad (e.g. \"Control\") makes reviewer matching weaker.")}</li>
        </ul>
      </section>
      </>
    }>
      <KeywordsForm id={id} venueName={ctx.venue.acr} groups={groups} initial={ctx.sub.keywords} own={ctx.sub.ownKeywords} />
    </SubmissionFrame>
  );
}

/** Canvas SB04-Keywords. */
export default function Page(props: P) {
  return <Reveal fallback={<WizardSkeleton step="keywords" />}><Inner {...props} /></Reveal>;
}
