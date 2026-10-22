import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame } from "@/components/account/settings-frame";
import { ProfileTabs } from "@/components/account/profile-tabs";
import { BusyCard, Conflicts, ReviewingForm } from "@/components/account/reviewing-form";
import { SettingsSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getProfile, getTopicSuggestions } from "@/lib/account/data";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t("Reviewing")} · ${t("Your profile")}` };
}

async function Inner() {
  const [ctx, profile, suggestions] = await Promise.all([getWorkspaceCtx(), getProfile(), getTopicSuggestions()]);
  if (!ctx || !profile) redirect("/sign-in?next=/settings/profile/reviewing");
  return (
    <WorkspaceShell ctx={ctx} active="m:settings">
      <SettingsFrame active="profile">
        <ProfileTabs active="reviewing" />
        <ReviewingForm p={profile} suggestions={suggestions} />
        <BusyCard initial={{ availability: profile.availability, available_from: profile.available_from }} />
        <Conflicts items={profile.conflicts} />
      </SettingsFrame>
    </WorkspaceShell>
  );
}

/** Account › Profile › Reviewing: topics, languages, how busy you are, conflicts of interest. */
export default function Page() {
  return (
    <Reveal fallback={<SettingsSkeleton active="profile" />}>
      <Inner />
    </Reveal>
  );
}
