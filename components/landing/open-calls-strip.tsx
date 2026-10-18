import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { getT } from "@/lib/i18n/server";
import { KIND_LABEL } from "@/lib/venues/types";

type Call = { slug: string; name: string; short_name: string | null; location: string | null; starts_on: string | null; kind: string };

async function getOpenCalls(): Promise<Call[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("venues");
  // RLS: the anon role only sees published venues.
  const { data } = await createPublicClient()
    .from("venues")
    .select("slug, name, short_name, location, starts_on, kind")
    .eq("is_published", true)
    .order("starts_on", { ascending: true })
    .limit(5);
  return (data as Call[] | null) ?? [];
}

const month = (d: string | null, intl = "en-GB") => (d ? new Date(`${d}T00:00:00Z`).toLocaleString(intl, { month: "short", year: "numeric", timeZone: "UTC" }) : null);

/** Canvas PR01 "Open calls now" table, filled with real published venues. */
export async function OpenCallsStrip() {
  const [calls, t] = await Promise.all([getOpenCalls(), getT()]);
  return (
    <div className="min-w-0 flex-[2_1_560px] overflow-hidden rounded-[8px] border border-[#DADDE3]">
      {calls.length ? (
        calls.map((v, i) => (
          <div key={v.slug} className={`grid grid-cols-12 gap-3 px-5 py-3 ${i < calls.length - 1 ? "border-b border-[#EEF0EC]" : ""}`}>
            <div className="col-span-12 sm:col-span-6">
              <Link href={`/venues/${v.slug}`} className="font-semibold text-[#121826] no-underline hover:underline">{v.name}</Link>
              <div className="text-[13px] text-[#4A5263]">
                <span className="mr-1.5 rounded-[2px] bg-[#E6EDFC] px-1.5 py-px font-mono text-[11px] uppercase text-[#1F47A8]">{v.short_name ?? v.kind}</span>
                <span>{t(KIND_LABEL[v.kind as keyof typeof KIND_LABEL] ?? v.kind)}</span>
              </div>
            </div>
            <div className="col-span-6 self-center text-[13px] text-[#4A5263] sm:col-span-3">{[v.location, month(v.starts_on, t.intl)].filter(Boolean).join(" · ") || "—"}</div>
            {/* TODO(data): countdown to the submission deadline; amber when < 7 days. */}
            <div className="col-span-6 self-center text-right font-mono text-[14px] font-medium text-[#4A5263] sm:col-span-3">{t("Open")}</div>
          </div>
        ))
      ) : (
        <div className="px-5 py-6 text-[14px] text-[#4A5263]">{t("No open calls yet — new venues appear here as soon as they publish.")}</div>
      )}
      <div className="flex justify-between border-t border-[#DADDE3] bg-[#F5F6F3] px-5 py-2.5 text-[13px]">
        <span className="font-mono text-[#4A5263]">{calls.length ? t("Live listings") : t("Listings")}</span>
        <Link href="/venues" className="font-semibold text-[#2F5FD0]">{t("Browse all venues →")}</Link>
      </div>
    </div>
  );
}
