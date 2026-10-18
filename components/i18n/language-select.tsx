"use client";

import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { setLanguageCookie } from "@/lib/consent-client";
import { useLocale, useT } from "@/lib/i18n/client";

/** Language picker used in every header. Saves the choice (for a year with "preferences" consent, else for the session) and reloads the page in that language. */
export function LanguageSelect({ id = "lang-select", className = "" }: { id?: string; className?: string }) {
  const locale = useLocale();
  const t = useT();
  function change(next: Locale) {
    setLanguageCookie(next);
    // Strip an explicit /fr, /it… prefix so the cookie decides; keep the rest of the URL.
    const { pathname, search, hash } = window.location;
    const clean = pathname.replace(/^\/(en|fr|it|de)(?=\/|$)/, "") || "/";
    document.documentElement.classList.add("lang-leaving");
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
