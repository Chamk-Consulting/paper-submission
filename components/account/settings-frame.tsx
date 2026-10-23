import Link from "@/components/site/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";

/* Shared head of the settings pages (canvas ST01–ST04), plus a sub-nav on phones only. Also used by their skeletons. */

export type SettingsKey = "profile" | "reviewing" | "security" | "privacy" | "notifications" | "calendar" | "preferences";
export const SETTINGS_NAV: [SettingsKey, string, string][] = [
  ["profile", "Profile", "/workspace/account/profile"],
  ["reviewing", "Reviewer profile", "/workspace/account/reviewer"],
  ["security", "Security", "/workspace/account/security"],
  ["privacy", "Privacy", "/workspace/account/privacy"],
  ["notifications", "Notifications", "/workspace/settings/notifications"],
  ["calendar", "Calendar", "/workspace/settings/calendar"],
  ["preferences", "Preferences", "/workspace/settings/preferences"],
];
const SETTINGS_HEAD: Record<SettingsKey, [string, string]> = {
  profile: ["Your profile", "Name, affiliations, research IDs, review topics and conflicts."],
  reviewing: ["Reviewer profile", "Topics you can review, languages, how busy you are, and conflicts of interest."],
  security: ["Sign-in & security", "Email addresses, password, passkey, two-step sign-in and devices."],
  notifications: ["Notifications", "Which emails you get, and when."],
  calendar: ["Calendar", "Your deadlines, reviews and sessions in Google, Outlook or Apple Calendar."],
  preferences: ["Preferences", "Language, time, and how Plenary looks for you."],
  privacy: ["Privacy & data", "Who sees your profile, your consents, and downloading or deleting your data."],
};
/** The sidebar group each page sits in, shown above its title. */
const GROUP: Record<SettingsKey, string> = { profile: "Account", reviewing: "Account", security: "Account", privacy: "Account", notifications: "Settings", calendar: "Settings", preferences: "Settings" };
export const settingsTitle = (k: SettingsKey) => SETTINGS_HEAD[k][0];

export async function SettingsFrame({ active, children }: { active: SettingsKey; children: ReactNode }) {
  const t = await getT();
  const [title, subtitle] = SETTINGS_HEAD[active];
  return (
    <div className="w-full">
      <div>
        <p className="m-0 text-[13px] text-[#4A5263]">{t(GROUP[active])}</p>
        <h1 className="mb-0 mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t(title)}</h1>
        <p className="mb-0 mt-1.5 text-[#4A5263]">{t(subtitle)}</p>
      </div>
      <div className="mt-6 flex flex-col items-stretch gap-7">
        {/* Phones only: from 768 px the side menu holds these pages (Settings group), so no second menu here. */}
        <nav aria-label={t("Account and settings")} className="flex flex-none gap-0.5 overflow-x-auto md:hidden">
          {SETTINGS_NAV.map(([k, label, href]) => (
            <Link key={k} href={href} aria-current={active === k ? "page" : undefined}
              className={`whitespace-nowrap rounded-[6px] border px-3 py-[9px] text-[14px] no-underline ${active === k ? "border-[#DADDE3] bg-white font-semibold text-[#121826]" : "border-transparent text-[#4A5263] hover:bg-white/60"}`}>
              {t(label)}
            </Link>
          ))}
        </nav>
        <div className="flex w-full min-w-0 flex-auto flex-col gap-[18px]">{children}</div>
      </div>
    </div>
  );
}
