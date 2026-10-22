import Link from "@/components/site/link";
import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { OpenCallsList } from "@/components/open-calls/list";
import { OpenCallsSkeleton } from "@/components/open-calls/rows";

/** Canvas PR01 "Open calls now" table: real upcoming submission deadlines with live countdowns. */
export async function OpenCallsStrip() {
  const t = await getT();
  return (
    <div className="min-w-0 flex-[2_1_560px] overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
      <Suspense fallback={<OpenCallsSkeleton tone="light" rows={5} />}>
        <OpenCallsList tone="light" limit={5} />
      </Suspense>
      <div className="flex justify-between border-t border-[#DADDE3] bg-[#F5F6F3] px-5 py-2.5 text-[13px]">
        <span className="font-mono text-[#4A5263]">{t("Closes in · your time zone")}</span>
        <Link href="/venues" className="font-semibold text-[#2F5FD0]">{t("Browse all venues →")}</Link>
      </div>
    </div>
  );
}
