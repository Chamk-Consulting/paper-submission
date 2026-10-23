import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { PageHero, heroBtn } from "@/components/site/page-hero";
import { SiteHeader } from "@/components/site/site-header";
import { PricingPlans } from "@/components/site/pricing-plans";
import { Clock } from "lucide-react";
import { isPublicSoon } from "@/lib/site/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  if (isPublicSoon("pricing")) return { title: t("Pricing"), description: t("Pricing for organizers is coming soon. Authors and reviewers never pay.") };
  return { title: t("Pricing"), description: t("Authors and reviewers never pay. You pay per accepted paper, only after submissions open.") };
}

/** PO02 — Pricing. */
export default async function Pricing() {
  const t = await getT();
  if (isPublicSoon("pricing")) return <PricingSoon t={t} />;
  const faq: [string, string][] = [
    [t("Do authors or reviewers pay?"), t("Never. Registration fees are set by your event and paid on your registration site.")],
    [t("When are we charged?"), t("Only when submissions open, then per accepted paper after decisions.")],
    [t("Can we try it first?"), t("Yes — set up the whole event and run test submissions for free.")],
    [t("Where is data stored?"), t("In [REGION] by default. Society plans can choose a region.")],
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <SiteHeader />
      <PageHero tone="navy" kicker={t("Pricing")}
        title={t("Simple pricing per event")}
        lead={t("Authors and reviewers never pay. You pay per accepted paper, only after submissions open.")}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/manage/new" className={heroBtn.primary}>{t("Create an event")}</Link>
            <Link href="/contact?tab=sales" className={heroBtn.secondaryNavy}>{t("Talk to sales")}</Link>
          </div>
        } />
      <main className="mx-auto box-border w-full max-w-[1280px] flex-auto px-5 pb-16 pt-10 sm:px-8">
        <PricingPlans />
        <section className="mt-12 max-w-[820px]" aria-labelledby="pq">
          <h2 id="pq" className="m-0 font-serif text-[28px] font-normal">{t("Questions")}</h2>
          <div className="mt-3 rounded-[8px] border border-[#DADDE3] bg-white px-5">
            {faq.map(([q, a]) => (
              <details key={q} className="group border-b border-[#EEF0EC] last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 font-semibold [&::-webkit-details-marker]:hidden">{q}<span aria-hidden className="font-normal text-[#4A5263] transition-transform group-open:rotate-45">+</span></summary>
                <p className="mb-4 mt-0 text-[14px] leading-[1.6] text-[#4A5263]">{a}</p>
              </details>
            ))}
          </div>
        </section>
        <p className="mt-6 font-mono text-[12px] text-[#4A5263]">{t("Prices are placeholders for design review.")}</p>
      </main>
    </div>
  );
}

/** Shown while organizer pricing is switched off (lib/site/coming-soon.ts → PUBLIC_SOON). The real page above stays as it is. */
function PricingSoon({ t }: { t: Awaited<ReturnType<typeof getT>> }) {
  const what = [
    t("Plans for single events, recurring conferences and societies"),
    t("A clear price per event, with nothing charged before submissions open"),
    t("Discounts for societies and non-profit events"),
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <SiteHeader />
      <PageHero tone="navy" kicker={t("Pricing")}
        title={t("Pricing for organizers is coming soon")}
        lead={t("Authors and reviewers never pay. We're finishing the plans for organizers; until then, ask us for a quote for your event.")}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/contact?tab=sales" className={heroBtn.primary}>{t("Ask for a quote")}</Link>
            <Link href="/organizers" className={heroBtn.secondaryNavy}>{t("See what organizers get")}</Link>
          </div>
        } />
      <main className="mx-auto box-border w-full max-w-[1280px] flex-auto px-5 pb-16 pt-10 sm:px-8">
        <section className="max-w-[820px] rounded-[8px] border border-[#DADDE3] bg-white px-6 py-8 sm:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6EDFC] px-2.5 py-1 text-[13px] font-semibold text-[#1F47A8]">
            <Clock size={14} strokeWidth={2} aria-hidden /> {t("Coming soon")}
          </span>
          <h2 className="mb-0 mt-4 text-[20px] font-semibold">{t("What this page will show")}</h2>
          <ul className="m-0 mt-2 list-disc ps-5 text-[15px]">
            {what.map((w) => <li key={w} className="py-0.5">{w}</li>)}
          </ul>
          <p className="mb-0 mt-5 max-w-[60ch] text-[15px] text-[#4A5263]">{t("You can already set up your event and run test submissions for free. Nothing is charged until we agree a price with you.")}</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/contact?tab=sales" className="inline-flex h-10 items-center rounded-[4px] bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white no-underline">{t("Talk to sales")}</Link>
            <Link href="/manage/new" className="inline-flex h-10 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[14px] font-semibold text-[#121826] no-underline">{t("Set up an event")}</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
