export const LOCALES = ["en", "fr", "it", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", fr: "Français", it: "Italiano", de: "Deutsch" };
/** BCP-47 tags used for dates and numbers. */
export const INTL: Record<Locale, string> = { en: "en-GB", fr: "fr-FR", it: "it-IT", de: "de-DE" };
export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** Pick the best supported locale from an Accept-Language header. */
export function negotiate(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
