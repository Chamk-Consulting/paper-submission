import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame } from "@/components/account/settings-frame";
import { PrivacyForm } from "@/components/account/privacy-form";
import { SettingsSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getPrivacy } from "@/lib/account/data";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Privacy & data") };
}

async function Inner() {
  const [ctx, p] = await Promise.all([getWorkspaceCtx(), getPrivacy()]);
  if (!ctx || !p) redirect("/sign-in?next=/workspace/account/privacy");
  return (
    <WorkspaceShell ctx={ctx} active="m:settings">
      <SettingsFrame active="privacy">
        <PrivacyForm visibility={p.visibility} consents={p.consents} lastExport={p.lastExport} lastDelete={p.lastDelete} />
      </SettingsFrame>
    </WorkspaceShell>
  );
}

/** Canvas ST04-Privacy. */
export default function Page() {
  return (
    <Reveal fallback={<SettingsSkeleton active="privacy" />}>
      <Inner />
    </Reveal>
  );
}
