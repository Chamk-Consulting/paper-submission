"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, INTL, type Locale } from "@/lib/i18n/config";
import { makeT, type T } from "@/lib/i18n/translate";

const Ctx = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}
export function useLocale(): Locale {
  return useContext(Ctx);
}
/** Translate in Client Components. */
export function useT(): T & { locale: Locale; intl: string } {
  const locale = useLocale();
  return useMemo(() => Object.assign(makeT(locale), { locale, intl: INTL[locale] }), [locale]);
}
