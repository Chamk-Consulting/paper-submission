"use client";

import Link from "next/link";
import { LanguageSelect } from "@/components/i18n/language-select";
import { useT } from "@/lib/i18n/client";
import { Logo } from "@/components/auth/logo";
import { Pin } from "@/components/motion/pin";
import { CookieSettingsLink } from "@/components/consent/cookie-consent";

/* Top bar and footer of canvas PR02–PR11 (client: language picker + translations). */

export function TopBar() {
  const t = useT();
  return (
    <Pin name="auth-top">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Logo />
      <div className="flex items-center gap-4 text-[14px]">
        <LanguageSelect id="auth-lang" />
        <Link href="/account-help" className="font-medium text-[#121826] no-underline">{t("Help")}</Link>
      </div>
    </div>
    </Pin>
  );
}

export function Footer() {
  const t = useT();
  return (
    <Pin name="auth-foot">
    <div className="flex flex-wrap justify-between gap-3 text-[13px] text-[#4A5263]">
      {/* TODO(ops): link to a real status page. */}
      <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#18744F]" />{t("All systems normal")}</span>
      <span className="flex flex-wrap gap-4">
        <Link href="/contact" className="text-[#4A5263]">{t("Contact")}</Link>
        <Link href="/legal/privacy" className="text-[#4A5263]">{t("Privacy")}</Link>
        <Link href="/legal/terms" className="text-[#4A5263]">{t("Terms")}</Link>
        <Link href="/legal/accessibility" className="text-[#4A5263]">{t("Accessibility")}</Link>
        <Link href="/legal/security" className="text-[#4A5263]">{t("Security")}</Link>
        <Link href="/legal/cookies" className="text-[#4A5263]">{t("Cookies")}</Link>
        <CookieSettingsLink className="text-[#4A5263]" />
      </span>
    </div>
    </Pin>
  );
}
