"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { CookieSettingsLink } from "@/components/consent/cookie-consent";

/** Navy footer of the canvas marketing and system pages (PO01, PO02, ER01). */
export function SiteFooter() {
  const t = useT();
  const l = "text-[#B9C3DA] hover:text-white";
  return (
    <footer className="mt-auto flex-none bg-[#0E1B3D] text-[#B9C3DA]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-5 px-5 py-7 text-[13px] sm:px-8">
        <span><span className="font-serif text-[20px] text-[#F5F6F3]">Plenary</span> · {t("conference submission & review")}</span>
        <span className="flex flex-wrap gap-x-[18px] gap-y-2">
          <Link href="/help" className={l}>{t("Help")}</Link>
          <Link href="/contact" className={l}>{t("Contact")}</Link>
          <Link href="/legal/privacy" className={l}>{t("Privacy")}</Link>
          <Link href="/legal/terms" className={l}>{t("Terms")}</Link>
          <Link href="/legal/accessibility" className={l}>{t("Accessibility")}</Link>
          <Link href="/legal/cookies" className={l}>{t("Cookies")}</Link>
          <CookieSettingsLink className={l} />
          <Link href="/maintenance" className={l}><span className="text-[#5FC79A]">●</span> {t("System status")}</Link>
        </span>
      </div>
    </footer>
  );
}
