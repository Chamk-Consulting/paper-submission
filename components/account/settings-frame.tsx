import Link from "@/components/site/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";

/* Shared head of the settings pages (canvas ST01–ST04), plus a sub-nav on phones only. Also used by their skeletons. */

export type SettingsKey = "profile" | "security" | "notifications" | "privacy";
export const SETTINGS_NAV: [SettingsKey, string, string][] = [
  ["profile", "Profile & expertise", "/settings/profile"],
  ["security", "Sign-in & security", "/settings/security"],
  ["notifications", "Notifications & calendar", "/settings/notifications"],
  ["privacy", "Privacy & data", "/settings/privacy"],
];
const SETTINGS_HEAD: Record<SettingsKey, [string, string]> = {
  profile: ["Profile & expertise", "How co-authors, chairs and editors find and match you."],
  security: ["Sign-in & security", "How you sign in, and where you are signed in."],
  notifications: ["Notifications & calendar", "Choose what reaches your inbox, and how deadlines reach your calendar."],
  privacy: ["Privacy & data", "What we keep, who can see it, and how to take it with you."],
};
export const settingsTitle = (k: SettingsKey) => SETTINGS_HEAD[k][0];

export async function SettingsFrame({ active, children }: { active: SettingsKey; children: ReactNode }) {
  const t = await getT();
  const [title, subtitle] = SETTINGS_HEAD[active];
  return (
    <>
      <div>
        <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Settings")}</p>
        <h1 className="mb-0 mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t(title)}</h1>
        <p className="mb-0 mt-1.5 text-[#4A5263]">{t(subtitle)}</p>
      </div>
      <div className="mt-6 flex flex-col items-stretch gap-7">
        {/* Phones only: from 768 px the side menu holds these pages (Settings group), so no second menu here. */}
        <nav aria-label={t("Settings")} className="flex flex-none gap-0.5 overflow-x-auto md:hidden">
          {SETTINGS_NAV.map(([k, label, href]) => (
            <Link key={k} href={href} aria-current={active === k ? "page" : undefined}
              className={`whitespace-nowrap rounded-[6px] border px-3 py-[9px] text-[14px] no-underline ${active === k ? "border-[#DADDE3] bg-white font-semibold text-[#121826]" : "border-transparent text-[#4A5263] hover:bg-white/60"}`}>
              {t(label)}
            </Link>
          ))}
        </nav>
        <div className="flex w-full min-w-0 max-w-[900px] flex-auto flex-col gap-[18px]">{children}</div>
      </div>
    </>
  );
}
