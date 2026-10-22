"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, INTL, type Locale } from "@/lib/i18n/config";
import { makeTFrom, type Dict, type T } from "@/lib/i18n/t-core";

// Only the current language's table reaches the browser (passed once by the root layout).
const Ctx = createContext<{ locale: Locale; dict: Dict }>({ locale: DEFAULT_LOCALE, dict: {} });

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dict; children: ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useLocale(): Locale {
  return useContext(Ctx).locale;
}
/** Translate in Client Components. */
export function useT(): T & { locale: Locale; intl: string } {
  const { locale, dict } = useContext(Ctx);
  return useMemo(() => Object.assign(makeTFrom(dict), { locale, intl: INTL[locale] }), [locale, dict]);
}
