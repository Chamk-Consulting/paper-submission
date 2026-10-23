import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame } from "@/components/account/settings-frame";
import { CalendarFeed } from "@/components/account/calendar-feed";
import { CalendarSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getCalendar } from "@/lib/account/data";
import { getT } from "@/lib/i18n/server";
import { isSoon } from "@/lib/site/coming-soon";
import { ComingSoonPage } from "@/components/account/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Calendar") };
}

async function Inner() {
  const [ctx, cal, t] = await Promise.all([getWorkspaceCtx(), getCalendar(), getT()]);
  if (!ctx || !cal) redirect("/sign-in?next=/workspace/settings/calendar");
  return (
    <WorkspaceShell ctx={ctx} active="m:settings">
      <SettingsFrame active="calendar">
        <p className="m-0 text-[14px] text-[#4A5263]">{t("One live feed: it updates when an event moves a deadline or you get a new review.")}</p>
        <CalendarFeed hasFeed={!!cal.feed} since={cal.feed?.created_at ?? null} initialFlags={cal.flags} items={cal.items} timezone={cal.timezone} />
      </SettingsFrame>
    </WorkspaceShell>
  );
}

/** Canvas CL01-Calendar. */
export default function Page() {
  // Switched off for now (lib/site/coming-soon.ts); the page below is kept as is.
  if (isSoon("calendar")) return <Reveal fallback={<CalendarSkeleton />}><ComingSoonPage active="calendar" next="/workspace/settings/calendar" /></Reveal>;
  return (
    <Reveal fallback={<CalendarSkeleton />}>
      <Inner />
    </Reveal>
  );
}
