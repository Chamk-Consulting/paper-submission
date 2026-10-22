import Link from "@/components/site/link";
import { getT } from "@/lib/i18n/server";

/** The tabs of Account › Profile. Each tab has its own address, so emails and Home can link straight to it. */
const TABS = [
  ["about", "About you", "/settings/profile"],
  ["reviewing", "Reviewing", "/settings/profile/reviewing"],
] as const;

export async function ProfileTabs({ active }: { active: (typeof TABS)[number][0] }) {
  const t = await getT();
  return (
    <nav aria-label={t("Profile sections")} className="-mt-2 flex gap-1 overflow-x-auto border-b border-[#DADDE3]">
      {TABS.map(([k, label, href]) => (
        <Link key={k} href={href} aria-current={active === k ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px] no-underline ${active === k ? "border-[#0E1B3D] font-semibold text-[#121826]" : "border-transparent text-[#4A5263] hover:text-[#121826]"}`}>
          {t(label)}
        </Link>
      ))}
    </nav>
  );
}
