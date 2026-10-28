"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { setLanguageCookie } from "@/lib/consent-client";
import { useLocale, useT } from "@/lib/i18n/client";

/**
 * Language picker used in the navbar, the footer, the phone menu and the sign-in pages — one component, two looks:
 * `light` on white backgrounds, `dark` on the navy navbar and footer (white text, clear border, globe icon).
 * The opened list is always dark text on white, so it stays readable on every browser.
 * Saves the choice (for a year with "preferences" consent, else for the session) and reloads the page in that language.
 */
export function LanguageSelect({ id = "lang-select", className = "", tone = "light" }: { id?: string; className?: string; tone?: "light" | "dark" }) {
  const locale = useLocale();
  const t = useT();
  const [going, setGoing] = useState<Locale | null>(null);
  function change(next: Locale) {
    if (next === locale) return;
    setGoing(next);
    setLanguageCookie(next);
    // Strip an explicit /fr, /it… prefix so the cookie decides; keep the rest of the URL.
    const { pathname, search, hash } = window.location;
    const clean = pathname.replace(/^\/(en|fr|it|de)(?=\/|$)/, "") || "/";
    // Full reload on purpose: the whole tree (incl. <html lang>) and the router cache must switch language.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`${clean}${search}${hash}`);
  }
  const options = LOCALES.map((l) => <option key={l} value={l} lang={l} className="bg-white text-[#121826]">{LOCALE_NAMES[l]}</option>);
  const label = <label htmlFor={id} className="sr-only">{t("Language")}</label>;

  if (tone === "dark") {
    return (
      <span className={`lang-pick h-9 items-center gap-1.5 rounded-[4px] border border-[#4A5F99] bg-[#17285A] pl-2.5 text-[#F5F6F3] hover:border-[#8F9CC0] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#F2A93B] ${className || "inline-flex"}`}>
        <Globe aria-hidden size={15} className="flex-none text-[#F2A93B]" />
        {label}
        <select id={id} value={going ?? locale} disabled={!!going} aria-busy={!!going || undefined} onChange={(e) => change(e.target.value as Locale)}
          className="h-8 cursor-pointer border-0 bg-transparent pr-1.5 text-[13px] font-medium text-[#F5F6F3] outline-none">
          {options}
        </select>
      </span>
    );
  }
  return (
    <>
      {label}
      <select id={id} value={going ?? locale} disabled={!!going} aria-busy={!!going || undefined} onChange={(e) => change(e.target.value as Locale)} className={`lang-pick h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-2 text-[14px] text-[#121826] ${className}`}>
        {options}
      </select>
    </>
  );
}
