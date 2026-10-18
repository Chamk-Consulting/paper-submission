import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame } from "@/components/account/settings-frame";
import { SecurityPanel } from "@/components/account/security-panel";
import { deviceName } from "@/lib/account/ua";
import { SettingsSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getSecurity } from "@/lib/account/data";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sign-in & security") };
}

async function Inner() {
  const [ctx, sec, h] = await Promise.all([getWorkspaceCtx(), getSecurity(), headers()]);
  if (!ctx || !sec) redirect("/sign-in?next=/settings/security");
  return (
    <WorkspaceShell ctx={ctx} active="m:settings">
      <SettingsFrame active="security">
        <SecurityPanel email={sec.email} device={deviceName(h.get("user-agent"))} providers={sec.providers} events={sec.events} />
      </SettingsFrame>
    </WorkspaceShell>
  );
}

/** Canvas ST02-Security. */
export default function Page() {
  return (
    <Reveal fallback={<SettingsSkeleton active="security" />}>
      <Inner />
    </Reveal>
  );
}
