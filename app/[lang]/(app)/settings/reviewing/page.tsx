import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame } from "@/components/account/settings-frame";
import { ReviewingForm } from "@/components/account/reviewing-form";
import { SettingsSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getProfile, getTopicSuggestions } from "@/lib/account/data";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Reviewing") };
}

async function Inner() {
  const [ctx, profile, suggestions] = await Promise.all([getWorkspaceCtx(), getProfile(), getTopicSuggestions()]);
  if (!ctx || !profile) redirect("/sign-in?next=/settings/reviewing");
  return (
    <WorkspaceShell ctx={ctx} active="m:settings">
      <SettingsFrame active="reviewing">
        <ReviewingForm p={profile} suggestions={suggestions} />
      </SettingsFrame>
    </WorkspaceShell>
  );
}

/** Account › Reviewing: topics, languages, how busy you are, conflicts of interest. */
export default function Page() {
  return (
    <Reveal fallback={<SettingsSkeleton active="reviewing" />}>
      <Inner />
    </Reveal>
  );
}
