import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { HelpFrame } from "@/components/help/help-frame";
import { GuideSkeleton } from "@/components/skeletons/authpolish";
import { REVIEWER_GUIDES } from "@/lib/help/reviewer-guides";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Reviewer guides"), description: t("How reviewing works on Plenary: invitations, blind rules, AI tools, extensions and conflicts.") };
}

async function Inner() {
  const t = await getT();
  return (
    <HelpFrame>
      <nav aria-label={t("Breadcrumb")} className="text-[14px] text-[#4A5263]"><Link href="/help" className="text-[#121826] underline">{t("Help & guides")}</Link> / {t("Reviewers")}</nav>
      <h1 className="mt-2 font-serif text-[36px] font-normal leading-[1.1] tracking-[-0.01em] sm:text-[40px]">{t("Reviewer guides")}</h1>
      <p className="mt-1.5 max-w-[62ch] text-[#4A5263]">{t("How reviewing works on Plenary — the same rules the review screens follow.")}</p>
      <ol className="m-0 mt-6 grid list-none gap-3 p-0 sm:grid-cols-2">
        {REVIEWER_GUIDES.map((g, i) => (
          <li key={g.slug}>
            <Link href={`/help/reviewers/${g.slug}`} className="flex h-full flex-col rounded-[8px] border border-[#DADDE3] bg-white p-5 text-[#121826] no-underline hover:border-[#B7BDC9] hover:bg-[#FBFCFF]">
              <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Guide {n}", { n: i + 1 })} · {t("{n} min read", { n: g.minutes })}</span>
              <span className="mt-1.5 font-serif text-[22px] leading-[1.2]">{t(g.title)}</span>
              <span className="mt-1.5 text-[14px] text-[#4A5263]">{t(g.lead)}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[14px] text-[#4A5263]">{t("A question about a specific paper? Ask the editor from the review page — chairs decide on the paper, Plenary support can't.")}</p>
    </HelpFrame>
  );
}

export default function Page() {
  return <Reveal fallback={<GuideSkeleton />}><Inner /></Reveal>;
}
