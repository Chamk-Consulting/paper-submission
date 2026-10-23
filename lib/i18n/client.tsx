"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, INTL, type Locale } from "@/lib/i18n/config";
import { makeTFrom, type Dict, type T } from "@/lib/i18n/t-core";

// Only the current language's table reaches the browser (passed once by the root layout).
const Ctx = createContext<{ locale: Locale; dict: Dict; brand: string }>({ locale: DEFAULT_LOCALE, dict: {}, brand: "Plenary" });

/** `brand`: the product name from the database (lib/config/brand.ts), shown instead of "Plenary" in every string. */
export function I18nProvider({ locale, dict, brand = "Plenary", children }: { locale: Locale; dict: Dict; brand?: string; children: ReactNode }) {
  const value = useMemo(() => ({ locale, dict, brand }), [locale, dict, brand]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useLocale(): Locale {
  return useContext(Ctx).locale;
}
/** The product name from the database (see lib/config/brand.ts). */
export function useBrand(): string {
  return useContext(Ctx).brand;
}
/** The product name as text, for logos and headings; works in Server and Client Components (inside I18nProvider). */
export function BrandName() {
  return <>{useContext(Ctx).brand}</>;
}
/** Translate in Client Components. */
export function useT(): T & { locale: Locale; intl: string; brand: string } {
  const { locale, dict, brand } = useContext(Ctx);
  return useMemo(() => Object.assign(makeTFrom(dict, brand), { locale, intl: INTL[locale], brand }), [locale, dict, brand]);
}
