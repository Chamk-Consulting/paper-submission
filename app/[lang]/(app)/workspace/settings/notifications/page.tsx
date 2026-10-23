import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame } from "@/components/account/settings-frame";
import { NotificationsForm } from "@/components/account/notifications-form";
import { SettingsSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getPrefs } from "@/lib/account/data";
import { getT } from "@/lib/i18n/server";
import { isSoon } from "@/lib/site/coming-soon";
import { ComingSoonPage } from "@/components/account/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Notifications & calendar") };
}

async function Inner() {
  const [ctx, prefs] = await Promise.all([getWorkspaceCtx(), getPrefs()]);
  if (!ctx || !prefs) redirect("/sign-in?next=/workspace/settings/notifications");
  return (
    <WorkspaceShell ctx={ctx} active="m:settings">
      <SettingsFrame active="notifications">
        <NotificationsForm prefs={prefs} />
      </SettingsFrame>
    </WorkspaceShell>
  );
}

/** Canvas ST03-Notifications. */
export default function Page() {
  // Switched off for now (lib/site/coming-soon.ts); the page below is kept as is.
  if (isSoon("notifications")) return <Reveal fallback={<SettingsSkeleton active="notifications" />}><ComingSoonPage active="notifications" next="/workspace/settings/notifications" /></Reveal>;
  return (
    <Reveal fallback={<SettingsSkeleton active="notifications" />}>
      <Inner />
    </Reveal>
  );
}
