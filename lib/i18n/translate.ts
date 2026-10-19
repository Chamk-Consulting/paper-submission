import type { Locale } from "@/lib/i18n/config";
import { fr } from "@/lib/i18n/dict/fr";
import { it } from "@/lib/i18n/dict/it";
import { de } from "@/lib/i18n/dict/de";
import { manage_fr } from "@/lib/i18n/dict/modules/manage.fr";
import { manage_it } from "@/lib/i18n/dict/modules/manage.it";
import { manage_de } from "@/lib/i18n/dict/modules/manage.de";
import { review_fr } from "@/lib/i18n/dict/modules/review.fr";
import { review_it } from "@/lib/i18n/dict/modules/review.it";
import { review_de } from "@/lib/i18n/dict/modules/review.de";
import { author_fr } from "@/lib/i18n/dict/modules/author.fr";
import { author_it } from "@/lib/i18n/dict/modules/author.it";
import { author_de } from "@/lib/i18n/dict/modules/author.de";
import { account_fr } from "@/lib/i18n/dict/modules/account.fr";
import { account_it } from "@/lib/i18n/dict/modules/account.it";
import { account_de } from "@/lib/i18n/dict/modules/account.de";
import { public_fr } from "@/lib/i18n/dict/modules/public.fr";
import { public_it } from "@/lib/i18n/dict/modules/public.it";
import { public_de } from "@/lib/i18n/dict/modules/public.de";
import { program_fr } from "@/lib/i18n/dict/modules/program.fr";
import { program_it } from "@/lib/i18n/dict/modules/program.it";
import { program_de } from "@/lib/i18n/dict/modules/program.de";
import { committee_fr } from "@/lib/i18n/dict/modules/committee.fr";
import { committee_it } from "@/lib/i18n/dict/modules/committee.it";
import { committee_de } from "@/lib/i18n/dict/modules/committee.de";
import { ops_fr } from "@/lib/i18n/dict/modules/ops.fr";
import { ops_it } from "@/lib/i18n/dict/modules/ops.it";
import { ops_de } from "@/lib/i18n/dict/modules/ops.de";
import { event_fr } from "@/lib/i18n/dict/modules/event.fr";
import { event_it } from "@/lib/i18n/dict/modules/event.it";
import { event_de } from "@/lib/i18n/dict/modules/event.de";
import { venuepolish_fr } from "@/lib/i18n/dict/modules/venuepolish.fr";
import { venuepolish_it } from "@/lib/i18n/dict/modules/venuepolish.it";
import { venuepolish_de } from "@/lib/i18n/dict/modules/venuepolish.de";



/**
 * English text is the key. Missing translations fall back to English, so a string is never blank.
 * Placeholders: t("{n} venues match", { n: 3 }).
 */
export type Dict = Record<string, string>;
export const DICTS: Record<Locale, Dict> = {
  en: {},
  fr: { ...fr, ...manage_fr, ...review_fr, ...author_fr, ...account_fr, ...public_fr, ...program_fr, ...committee_fr, ...ops_fr, ...event_fr, ...venuepolish_fr },
  it: { ...it, ...manage_it, ...review_it, ...author_it, ...account_it, ...public_it, ...program_it, ...committee_it, ...ops_it, ...event_it, ...venuepolish_it },
  de: { ...de, ...manage_de, ...review_de, ...author_de, ...account_de, ...public_de, ...program_de, ...committee_de, ...ops_de, ...event_de, ...venuepolish_de },
};
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
