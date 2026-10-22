import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import Link from "@/components/site/link";
import { getT } from "@/lib/i18n/server";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { Reveal } from "@/components/motion/reveal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("My schedule") };
}

/** My schedule across events: one card per event you take part in, opening that event's schedule and program. */
async function Inner() {
  const [ctx, t] = await Promise.all([getWorkspaceCtx(), getT()]);
  const venues = ctx?.venues ?? [];
  return (
    <div>
      <h1 className="m-0 font-serif text-[36px] font-normal leading-[1.1] tracking-[-0.01em]">{t("My schedule")}</h1>
      <p className="mb-0 mt-1.5 max-w-[64ch] text-[#4A5263]">{t("Sessions you saved, plus everything you present or chair — those are added automatically.")}</p>
      {venues.length ? (
        <ul className="m-0 mt-6 grid list-none gap-3 p-0 md:grid-cols-2">
          {venues.map((v) => (
            <li key={v.slug}>
              <Link href={`/workspace/events/${v.slug}/program/my-schedule`} className="flex h-full items-center justify-between gap-4 rounded-[8px] border border-[#DADDE3] bg-white p-5 text-[#121826] no-underline hover:border-[#B7BDC9] hover:bg-[#FBFCFF]">
                <span className="min-w-0">
                  <span className="block font-mono text-[12px] uppercase tracking-[0.06em] text-[#4A5263]">{v.shortName ?? v.slug}</span>
                  <span className="mt-1 block font-serif text-[20px] leading-[1.25]">{v.name}</span>
                </span>
                <CalendarClock size={18} aria-hidden className="flex-none text-[#4A5263]" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-[8px] border border-[#DADDE3] bg-white p-6 text-[#4A5263]">
          {t("No events yet.")} <Link href="/workspace/events" className="text-[#2F5FD0]">{t("Find events")}</Link>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <Reveal fallback={null}><Inner /></Reveal>;
}
