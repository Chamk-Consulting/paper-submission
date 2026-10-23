import { lang } from "next/root-params";
import { DEFAULT_LOCALE, INTL, isLocale, type Locale } from "@/lib/i18n/config";
import { makeT } from "@/lib/i18n/translate";
import { getBrand } from "@/lib/config/brand";

/** Current locale from the [lang] root segment (Server Components only). */
export async function getLocale(): Promise<Locale> {
  const l = await lang();
  return isLocale(l) ? l : DEFAULT_LOCALE;
}
export async function getT() {
  const [locale, brand] = await Promise.all([getLocale(), getBrand()]);
  return Object.assign(makeT(locale, brand), { locale, intl: INTL[locale], brand });
}
