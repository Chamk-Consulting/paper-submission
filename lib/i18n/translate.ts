import type { Locale } from "@/lib/i18n/config";
import { fr } from "@/lib/i18n/dict/fr";
import { it } from "@/lib/i18n/dict/it";
import { de } from "@/lib/i18n/dict/de";

/**
 * English text is the key. Missing translations fall back to English, so a string is never blank.
 * Placeholders: t("{n} venues match", { n: 3 }).
 */
export type Dict = Record<string, string>;
export const DICTS: Record<Locale, Dict> = { en: {}, fr, it, de };
export type Vars = Record<string, string | number>;
export type T = (key: string, vars?: Vars) => string;

export function makeT(locale: Locale): T {
  const d = DICTS[locale] ?? {};
  return (key, vars) => {
    let s = d[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}
