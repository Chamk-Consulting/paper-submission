import { lang } from "next/root-params";
import { DEFAULT_LOCALE, INTL, isLocale, type Locale } from "@/lib/i18n/config";
import { makeT } from "@/lib/i18n/translate";

/** Current locale from the [lang] root segment (Server Components only). */
export async function getLocale(): Promise<Locale> {
  const l = await lang();
  return isLocale(l) ? l : DEFAULT_LOCALE;
}
export async function getT() {
  const locale = await getLocale();
  return Object.assign(makeT(locale), { locale, intl: INTL[locale] });
}
