import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame } from "@/components/account/settings-frame";
import { ProfileForm } from "@/components/account/profile-form";
import { SettingsSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getProfile } from "@/lib/account/data";
import { getT } from "@/lib/i18n/server";
import { getMe } from "@/lib/auth/me";
import { PlenaryIdCard } from "@/components/auth/plenary-id-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Profile & expertise") };
}

async function Inner() {
  const [ctx, profile, me] = await Promise.all([getWorkspaceCtx(), getProfile(), getMe()]);
  const person = me?.person;
  const name = (person?.paper_name || person?.display_name || me?.email || "").trim();
  if (!ctx || !profile) redirect("/sign-in?next=/settings/profile");
  return (
    <WorkspaceShell ctx={ctx} active="m:settings">
      <SettingsFrame active="profile">
        {me ? <PlenaryIdCard className="mb-5" name={name} affiliation={me.affiliation?.institution ?? null} id={person?.plenary_id ?? null} orcid={person?.orcid ?? null} /> : null}
        <ProfileForm p={profile} />
      </SettingsFrame>
    </WorkspaceShell>
  );
}

/** Canvas ST01-Profile. */
export default function Page() {
  return (
    <Reveal fallback={<SettingsSkeleton active="profile" />}>
      <Inner />
    </Reveal>
  );
}
