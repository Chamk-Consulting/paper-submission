import Link from "@/components/site/link";
import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { OpenCallsList } from "@/components/open-calls/list";
import { OpenCallsSkeleton } from "@/components/open-calls/rows";

/** Right-hand navy panel of canvas PR02: real upcoming submission deadlines with live countdowns. */
export async function OpenCallsPanel() {
  const t = await getT();
  return (
    <aside aria-label={t("Open calls for papers")} className="box-border flex min-h-full w-full min-w-0 flex-col justify-center bg-[#0E1B3D] px-6 py-14 text-[#F5F6F3] sm:px-16">
      <p className="m-0 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#F2A93B]">{t("Open calls · shown in your time zone")}</p>
      <h2 className="mt-3.5 max-w-[20ch] font-serif text-[44px] font-[350] leading-[1.08] tracking-[-0.015em]">{t("Every deadline you care about, in one place.")}</h2>
      <div className="mt-8 overflow-hidden rounded-[8px] bg-[#17285A]">
        <div className="grid grid-cols-12 gap-3 border-b border-[#24335C] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[#B9C3DA]">
          <span className="col-span-6">{t("Venue")}</span><span className="col-span-3">{t("Where")}</span><span className="col-span-3 text-right">{t("Closes in")}</span>
        </div>
        <Suspense fallback={<OpenCallsSkeleton tone="dark" />}>
          <OpenCallsList tone="dark" limit={4} />
        </Suspense>
      </div>
      <div className="mt-3.5 flex flex-wrap justify-between gap-3">
        <span className="font-mono text-[12px] text-[#B9C3DA]">{t("Saffron = closes within 7 days.")}</span>
        <Link href="/venues" className="text-[14px] font-medium text-[#F2A93B]">{t("Browse all venues →")}</Link>
      </div>
      <div className="mt-10 grid grid-cols-3 gap-4 border-t border-[#24335C] pt-6">
        <div><div className="text-[14px] font-semibold">{t("One account")}</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">{t("Every venue, every role.")}</div></div>
        <div><div className="text-[14px] font-semibold">{t("Blind review protected")}</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">{t("Identity hidden at the data layer.")}</div></div>
        {/* Supabase project region: eu-central-1 (Frankfurt). */}
        <div><div className="text-[14px] font-semibold">{t("Data in the EU")}</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">{t("GDPR consent, recorded once.")}</div></div>
      </div>
    </aside>
  );
}
