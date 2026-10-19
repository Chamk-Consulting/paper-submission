import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { HelpFrame } from "@/components/help/help-frame";
import { GuideSkeleton } from "@/components/skeletons/authpolish";
import { REVIEWER_GUIDES, guideBySlug } from "@/lib/help/reviewer-guides";

type P = { params: Promise<{ guide: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { guide } = await params;
  const g = guideBySlug(guide);
  const t = await getT();
  return g ? { title: t(g.title), description: t(g.lead) } : { title: t("Reviewer guides") };
}

async function Inner({ params }: P) {
  const { guide } = await params;
  const g = guideBySlug(guide);
  if (!g) notFound();
  const t = await getT();
  const others = REVIEWER_GUIDES.filter((x) => x.slug !== g.slug);
  return (
    <HelpFrame>
      <nav aria-label={t("Breadcrumb")} className="text-[14px] text-[#4A5263]">
        <Link href="/help" className="text-[#121826] underline">{t("Help & guides")}</Link> / <Link href="/help/reviewers" className="text-[#121826] underline">{t("Reviewers")}</Link>
      </nav>
      <article className="mt-2">
        <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Reviewer guide")} · {t("{n} min read", { n: g.minutes })}</p>
        <h1 className="mt-1.5 font-serif text-[36px] font-normal leading-[1.1] tracking-[-0.01em] sm:text-[40px]">{t(g.title)}</h1>
        <p className="mt-2 max-w-[62ch] text-[17px] leading-[1.55] text-[#4A5263]">{t(g.lead)}</p>
        <div className="mt-6 flex flex-col gap-4">
          {g.sections.map((s) => (
            <section key={s.h} className="rounded-[8px] border border-[#DADDE3] bg-white px-6 py-5">
              <h2 className="m-0 text-[18px] font-semibold">{t(s.h)}</h2>
              {s.p?.map((x) => <p key={x} className="mb-0 mt-2.5 max-w-[68ch] text-[15px] leading-[1.65]">{t(x)}</p>)}
              {s.list ? (
                <ul className="mb-0 mt-2.5 flex max-w-[68ch] flex-col gap-1.5 pl-5 text-[15px] leading-[1.6]">
                  {s.list.map((x) => <li key={x}>{t(x)}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </article>
      {g.next ? (
        <Link href={g.next.href} className="mt-6 inline-flex h-11 items-center rounded-[4px] bg-[#F2A93B] px-4 text-[15px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{t(g.next.label)} →</Link>
      ) : null}
      <aside className="mt-8 border-t border-[#DADDE3] pt-5">
        <h2 className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("More reviewer guides")}</h2>
        <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[15px]">
          {others.map((x) => <li key={x.slug}><Link href={`/help/reviewers/${x.slug}`} className="text-[#2F5FD0]">{t(x.title)}</Link></li>)}
        </ul>
      </aside>
    </HelpFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<GuideSkeleton />}><Inner {...props} /></Reveal>;
}
