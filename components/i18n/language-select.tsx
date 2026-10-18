"use client";

import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";

/** Language picker used in every header. Saves the choice for a year and reloads the page in that language. */
export function LanguageSelect({ id = "lang-select", className = "" }: { id?: string; className?: string }) {
  const locale = useLocale();
  const t = useT();
  function change(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // Strip an explicit /fr, /it… prefix so the cookie decides; keep the rest of the URL.
    const { pathname, search, hash } = window.location;
    const clean = pathname.replace(/^\/(en|fr|it|de)(?=\/|$)/, "") || "/";
    // Full reload on purpose: the whole tree (incl. <html lang>) and the router cache must switch language.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`${clean}${search}${hash}`);
  }
  return (
    <>
      <label htmlFor={id} className="sr-only">{t("Language")}</label>
      <select id={id} value={locale} onChange={(e) => change(e.target.value as Locale)} className={`h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-2 text-[14px] text-[#121826] ${className}`}>
        {LOCALES.map((l) => <option key={l} value={l} lang={l}>{LOCALE_NAMES[l]}</option>)}
      </select>
    </>
  );
}
