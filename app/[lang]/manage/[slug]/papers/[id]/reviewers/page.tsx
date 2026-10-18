import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { ManagePage } from "@/components/manage/chrome";
import { ui } from "@/components/manage/ui";
import { Rules, SideStat } from "@/components/manage/ops1/kit";
import { ReviewerFinder } from "@/components/manage/ops1/reviewer-finder";
import { Reveal } from "@/components/motion/reveal";
import { OpsSplitSkeleton } from "@/components/skeletons/ops1";
import { loadAuthorSummary, loadInvitations, loadSuggestions, myAePapers, requirePaper } from "@/lib/manage/ops1-data";
import { paperId } from "@/lib/manage/ops1-shared";

/* EM23 — find reviewers for one paper (handling AE or a chair without a conflict). */

type P = { params: Promise<{ slug: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Find reviewers") };
}

async function Inner({ params }: P) {
  const { slug, id } = await params;
  const ctx = await requireEvent(slug, "ae");
  const paper = await requirePaper(ctx, id);
  const t = await getT();
  const min = Number(ctx.settings?.min_reviews ?? 3), max = Number(ctx.settings?.max_reviewers ?? 4), days = Number(ctx.settings?.invite_days ?? 3);
  const me = ctx.ws.me.person!.id;
  const [inv, sug, authors, mine] = await Promise.all([loadInvitations(id), loadSuggestions(id), loadAuthorSummary(id), myAePapers(ctx.venue.id, me, min)]);
  const isAE = paper.handlingAe === me;
  const enough = inv.filter((i) => i.round === 1 && ["accepted", "submitted"].includes(i.status)).length >= min;
  return (
    <ManagePage ctx={ctx} active="papers" crumb={<>{isAE ? t("Associate editor") : t("Organizer")} · {ctx.label} / {paperId(paper.number)}</>}
      title={t("Find reviewers for {id}", { id: paperId(paper.number) })}
      sub={t("As associate editor: invite until {n} accept. Conflicts and full reviewers are marked.", { n: min })}>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <section className={ui.card}>
            <p className="m-0 flex flex-wrap gap-2 font-mono text-[12px] text-[#4A5263]"><span className="font-semibold text-[#121826]">{paperId(paper.number)}</span>{[paper.topic, ...paper.keywords.slice(0, 2)].filter(Boolean).join(" · ").toUpperCase()}</p>
            <h2 className="m-0 mt-1.5 font-serif text-[24px] font-normal leading-[1.25]">{paper.title}</h2>
            <p className="m-0 mt-2 text-[13px] text-[#4A5263]">
              {t("Authors: {n} (hidden from reviewers, shown to you as AE)", { n: authors.count })}
              {authors.institutions.length ? ` · ${authors.institutions.slice(0, 3).join(", ")}` : ""}{authors.countries.length ? `, ${authors.countries.join(", ")}` : ""}
            </p>
            {enough ? (
              <p className={`${ui.ok} mt-3`}>{t("Enough reviewers accepted.")} <Link href={`/manage/${slug}/papers/${id}/recommendation`}>{t("Go to the recommendation")} →</Link></p>
            ) : null}
          </section>
          <ReviewerFinder slug={slug} submission={id} invitations={inv} suggestions={sug} min={min} max={max} inviteDays={days} />
        </div>
        <div className="flex flex-col gap-4">
          {mine.total ? <SideStat kicker={t("Your papers as AE")} value={String(mine.total)} sub={t("{a} need reviewers · {b} fully covered", { a: mine.needReviewers, b: mine.covered })} /> : null}
          <Rules title={t("Rules on this page")} items={[
            ["E3", t("{a} reviews needed, max {b}.", { a: min, b: max })],
            ["E4", t("Reviewer load = their limit or venue limit, lower one.")],
            ["E5", t("Invitations expire after {n} days.", { n: days })],
            ["B5", t("Conflict overrides: reason + second approver.")],
            ["B6", t("Conflict = co-author 3 yrs, institution 2 yrs, supervisor, declared.")],
          ]} />
        </div>
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<OpsSplitSkeleton active="papers" />}><Inner {...props} /></Reveal>;
}
