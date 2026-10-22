import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SiteHeader } from "@/components/site/site-header";
import { PricingPlans } from "@/components/site/pricing-plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Pricing"), description: t("Authors and reviewers never pay. You pay per accepted paper, only after submissions open.") };
}

/** PO02 — Pricing. */
export default async function Pricing() {
  const t = await getT();
  const faq: [string, string][] = [
    [t("Do authors or reviewers pay?"), t("Never. Registration fees are set by your event and paid on your registration site.")],
    [t("When are we charged?"), t("Only when submissions open, then per accepted paper after decisions.")],
    [t("Can we try it first?"), t("Yes — set up the whole event and run test submissions for free.")],
    [t("Where is data stored?"), t("In [REGION] by default. Society plans can choose a region.")],
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <SiteHeader />
      <main className="mx-auto box-border w-full max-w-[1280px] flex-auto px-5 pb-16 pt-12 sm:px-8">
        <h1 className="m-0 font-serif text-[40px] font-[350] leading-[1.05] tracking-[-0.015em] sm:text-[52px]">{t("Simple pricing per event")}</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] text-[#4A5263]">{t("Authors and reviewers never pay. You pay per accepted paper, only after submissions open.")}</p>
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
