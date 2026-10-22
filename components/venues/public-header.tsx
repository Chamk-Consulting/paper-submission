"use client";

import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";
import { CookieSettingsLink } from "@/components/consent/cookie-consent";

/** The public header is now the shared site header (components/chrome/app-chrome.tsx). Kept so pages compile. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PublicHeader(_: { signedIn?: boolean; active?: "venues" | "organizers" | "pricing" | "help" | "contact" | "" }) {
  return null;
}

export function PublicFooter() {
  const t = useT();
  return (
    <footer className="mt-auto flex-none border-t border-[#DADDE3] bg-white">
      <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-3 px-5 py-[18px] text-[13px] text-[#4A5263] sm:px-8">
        <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#18744F]" />{t("All systems normal")}</span>
        <span className="flex flex-wrap gap-4">
          <Link href="/contact" className="text-[#4A5263]">{t("Contact")}</Link>
          <Link href="/help" className="text-[#4A5263]">{t("Help")}</Link>
          <Link href="/legal/privacy" className="text-[#4A5263]">{t("Privacy")}</Link>
          <Link href="/legal/terms" className="text-[#4A5263]">{t("Terms")}</Link>
          <Link href="/legal/accessibility" className="text-[#4A5263]">{t("Accessibility")}</Link>
          <Link href="/legal/security" className="text-[#4A5263]">{t("Security")}</Link>
          <Link href="/legal/cookies" className="text-[#4A5263]">{t("Cookies")}</Link>
          <CookieSettingsLink className="text-[#4A5263]" />
        </span>
      </div>
    </footer>
  );
}
