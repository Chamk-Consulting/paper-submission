import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame } from "@/components/account/settings-frame";
import { PreferencesForm } from "@/components/account/preferences-form";
import { SettingsSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getPreferences } from "@/lib/account/data";
import { getT } from "@/lib/i18n/server";
import { isSoon } from "@/lib/site/coming-soon";
import { ComingSoonPage } from "@/components/account/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Preferences") };
}

async function Inner() {
  const [ctx, p] = await Promise.all([getWorkspaceCtx(), getPreferences()]);
  if (!ctx || !p) redirect("/sign-in?next=/workspace/settings/preferences");
  return (
    <WorkspaceShell ctx={ctx} active="m:settings">
      <SettingsFrame active="preferences">
        <PreferencesForm locale={p.locale} timezone={p.timezone} ui={p.ui} />
      </SettingsFrame>
    </WorkspaceShell>
  );
}

/** Settings › Preferences: language, time, display, workspace. */
export default function Page() {
  // Switched off for now (lib/site/coming-soon.ts); the page below is kept as is.
  if (isSoon("preferences")) return <Reveal fallback={<SettingsSkeleton active="preferences" />}><ComingSoonPage active="preferences" next="/workspace/settings/preferences" /></Reveal>;
  return (
    <Reveal fallback={<SettingsSkeleton active="preferences" />}>
      <Inner />
    </Reveal>
  );
}
