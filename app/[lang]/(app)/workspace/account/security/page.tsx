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
import { getSecurityPlus } from "@/lib/account/security-data";
import { getT } from "@/lib/i18n/server";
import { isSoon } from "@/lib/site/coming-soon";
import { ComingSoonPage } from "@/components/account/coming-soon";
import { pendingEmailChange } from "@/lib/account/security-actions";
import { PendingEmailBanner } from "@/components/account/pending-email-banner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sign-in & security") };
}

async function Inner() {
  const [ctx, sec, h, plus, pendingEmail] = await Promise.all([getWorkspaceCtx(), getSecurity(), headers(), getSecurityPlus(), pendingEmailChange()]);
  if (!ctx || !sec || !plus) redirect("/sign-in?next=/workspace/account/security");
  return (
    <WorkspaceShell ctx={ctx} active="m:settings">
      <SettingsFrame active="security">
        {pendingEmail ? <PendingEmailBanner email={pendingEmail} /> : null}
        <SecurityPanel email={sec.email} device={deviceName(h.get("user-agent"))} providers={sec.providers} events={sec.events} plus={plus} />
      </SettingsFrame>
    </WorkspaceShell>
  );
}

/** Canvas ST02-Security. */
export default function Page() {
  // Switched off for now (lib/site/coming-soon.ts); the page below is kept as is.
  if (isSoon("security")) return <Reveal fallback={<SettingsSkeleton active="security" />}><ComingSoonPage active="security" next="/workspace/account/security" /></Reveal>;
  return (
    <Reveal fallback={<SettingsSkeleton active="security" />}>
      <Inner />
    </Reveal>
  );
}
