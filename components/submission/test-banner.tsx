import Link from "@/components/site/link";
import { getT } from "@/lib/i18n/server";

/** EM13 — shown on every screen of a test paper so nobody mistakes it for a real submission. */
export async function TestBanner({ venueSlug, passed }: { venueSlug: string; passed: boolean }) {
  const t = await getT();
  return (
    <div role="note" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[6px] border border-[#F1D3A6] bg-[#FBEFDD] px-4 py-2.5 text-[14px] text-[#3B2A07]">
      <span className="rounded-[3px] bg-[#0E1B3D] px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-[0.06em] text-[#F2A93B]">{t("TEST")}</span>
      <span className="min-w-0 flex-auto">
        {passed ? t("Test submission passed. It is not counted, numbered or sent to anyone.") : t("Test submission — go through every step as an author would. It is never counted, numbered or sent to reviewers.")}
      </span>
      <Link href={`/manage/${venueSlug}/setup/go-live`} className="font-medium text-[#3B2A07]">{t("Back to go-live review")}</Link>
    </div>
  );
}
