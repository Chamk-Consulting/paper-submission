import type { Metadata } from "next";
import { CalendarClock, CalendarRange } from "lucide-react";
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
  const btn = "inline-flex h-9 items-center gap-2 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px] font-medium text-[#121826] no-underline hover:bg-[#F7F8F6]";
  return (
    <div>
      <h1 className="m-0 font-serif text-[36px] font-normal leading-[1.1] tracking-[-0.01em]">{t("My schedule")}</h1>
      <p className="mb-0 mt-1.5 max-w-[64ch] text-[#4A5263]">{t("Sessions you saved, plus everything you present or chair — those are added automatically.")}</p>
      {venues.length ? (
        <ul className="m-0 mt-6 grid list-none gap-3 p-0 md:grid-cols-2">
          {venues.map((v) => (
            <li key={v.slug} className="flex flex-col gap-3 rounded-[8px] border border-[#DADDE3] bg-white p-5">
              <div>
                <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{v.shortName ?? v.slug}</p>
                <p className="m-0 mt-1 font-serif text-[20px] leading-[1.25]">{v.name}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/workspace/events/${v.slug}/program/my-schedule`} className={btn}><CalendarClock size={15} aria-hidden />{t("My schedule")}</Link>
                <Link href={`/workspace/events/${v.slug}/program`} className={btn}><CalendarRange size={15} aria-hidden />{t("Program")}</Link>
              </div>
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
