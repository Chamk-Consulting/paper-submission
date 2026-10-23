import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import Link from "@/components/site/link";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame } from "@/components/account/settings-frame";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getT } from "@/lib/i18n/server";
import type { SoonKey } from "@/lib/site/coming-soon";

/* Shown instead of a settings page that is switched off for now (see lib/site/coming-soon.ts). */

const WHAT: Record<SoonKey, string[]> = {
  security: ["Change your email and password", "Passkeys and two-step sign-in", "Devices signed in to your account"],
  privacy: ["Who can see your profile", "Your consents", "Download or delete your data"],
  notifications: ["Choose which emails you get", "Daily or weekly digests", "Quiet hours"],
  calendar: ["Your deadlines, reviews and talks in one live feed", "Google, Outlook and Apple Calendar"],
  preferences: ["Language and time zone", "Date and time format", "Appearance"],
};

async function SoonInner({ active, next }: { active: SoonKey; next: string }) {
  const [ctx, t] = await Promise.all([getWorkspaceCtx(), getT()]);
  if (!ctx) redirect(`/sign-in?next=${next}`);
  return (
    <WorkspaceShell ctx={ctx} active="m:settings">
      <SettingsFrame active={active}>
        <section className="rounded-[8px] border border-[#DADDE3] bg-white px-6 py-8 sm:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6EDFC] px-2.5 py-1 text-[13px] font-semibold text-[#1F47A8]">
            <Clock size={14} strokeWidth={2} aria-hidden /> {t("Coming soon")}
          </span>
          <h2 className="mb-0 mt-4 text-[20px] font-semibold">{t("This page isn't available yet")}</h2>
          <p className="mb-0 mt-1.5 max-w-[60ch] text-[15px] text-[#4A5263]">{t("We're finishing it. Until then your account keeps its current settings, and nothing here changes how you sign in or the emails you get.")}</p>
          <p className="mb-0 mt-5 text-[13px] font-semibold text-[#4A5263]">{t("What you'll be able to do here")}</p>
          <ul className="m-0 mt-2 list-disc ps-5 text-[15px] text-[#121826]">
            {WHAT[active].map((w) => <li key={w} className="py-0.5">{t(w)}</li>)}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/workspace/account/profile" className="inline-flex h-10 items-center rounded-[4px] bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white no-underline">{t("Go to your profile")}</Link>
            <Link href="/workspace/support" className="inline-flex h-10 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[14px] font-semibold text-[#121826] no-underline">{t("Contact support")}</Link>
          </div>
        </section>
      </SettingsFrame>
    </WorkspaceShell>
  );
}

export function ComingSoonPage({ active, next }: { active: SoonKey; next: string }) {
  return <SoonInner active={active} next={next} />;
}
