import Link from "@/components/site/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { CalendarFeed } from "@/components/account/calendar-feed";
import { CalendarSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getCalendar } from "@/lib/account/data";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Add deadlines to my calendar") };
}

async function Inner() {
  const [ctx, cal, t] = await Promise.all([getWorkspaceCtx(), getCalendar(), getT()]);
  if (!ctx || !cal) redirect("/sign-in?next=/settings/calendar");
  return (
    <WorkspaceShell ctx={ctx} active="m:calendar">
      <p className="m-0 font-mono text-[12px] text-[#4A5263]"><Link href="/workspace" className="text-[#4A5263]">{t("Home")}</Link> / {t("Calendar")}</p>
      <h1 className="mb-0 mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("Add deadlines to my calendar")}</h1>
      <p className="mb-0 mt-1.5 text-[#4A5263]">{t("One live feed: it updates when a venue extends a deadline or you get a new review.")}</p>
      <CalendarFeed hasFeed={!!cal.feed} since={cal.feed?.created_at ?? null} initialFlags={cal.flags} items={cal.items} timezone={cal.timezone} />
    </WorkspaceShell>
  );
}

/** Canvas CL01-Calendar. */
export default function Page() {
  return (
    <Reveal fallback={<CalendarSkeleton />}>
      <Inner />
    </Reveal>
  );
}
