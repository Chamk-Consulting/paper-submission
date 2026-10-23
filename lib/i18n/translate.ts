import type { Locale } from "@/lib/i18n/config";
import { fr } from "@/lib/i18n/dict/fr";
import { it } from "@/lib/i18n/dict/it";
import { de } from "@/lib/i18n/dict/de";
import { authpolish_fr } from "@/lib/i18n/dict/modules/authpolish.fr";
import { authpolish_it } from "@/lib/i18n/dict/modules/authpolish.it";
import { authpolish_de } from "@/lib/i18n/dict/modules/authpolish.de";
import { manage_fr } from "@/lib/i18n/dict/modules/manage.fr";
import { manage_it } from "@/lib/i18n/dict/modules/manage.it";
import { manage_de } from "@/lib/i18n/dict/modules/manage.de";
import { review_fr } from "@/lib/i18n/dict/modules/review.fr";
import { review_it } from "@/lib/i18n/dict/modules/review.it";
import { review_de } from "@/lib/i18n/dict/modules/review.de";
import { author_fr } from "@/lib/i18n/dict/modules/author.fr";
import { author_it } from "@/lib/i18n/dict/modules/author.it";
import { author_de } from "@/lib/i18n/dict/modules/author.de";
import { opspolish_fr } from "@/lib/i18n/dict/modules/opspolish.fr";
import { opspolish_it } from "@/lib/i18n/dict/modules/opspolish.it";
import { opspolish_de } from "@/lib/i18n/dict/modules/opspolish.de";
import { identity_fr } from "@/lib/i18n/dict/modules/identity.fr";
import { identity_it } from "@/lib/i18n/dict/modules/identity.it";
import { identity_de } from "@/lib/i18n/dict/modules/identity.de";
import { signin2_fr } from "@/lib/i18n/dict/modules/signin2.fr";
import { signin2_it } from "@/lib/i18n/dict/modules/signin2.it";
import { signin2_de } from "@/lib/i18n/dict/modules/signin2.de";
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
import { reviewpolish_fr } from "@/lib/i18n/dict/modules/reviewpolish.fr";
import { reviewpolish_it } from "@/lib/i18n/dict/modules/reviewpolish.it";
import { reviewpolish_de } from "@/lib/i18n/dict/modules/reviewpolish.de";
import { data_fr } from "@/lib/i18n/dict/modules/data.fr";
import { data_it } from "@/lib/i18n/dict/modules/data.it";
import { data_de } from "@/lib/i18n/dict/modules/data.de";
import { venuepolish_fr } from "@/lib/i18n/dict/modules/venuepolish.fr";
import { venuepolish_it } from "@/lib/i18n/dict/modules/venuepolish.it";
import { venuepolish_de } from "@/lib/i18n/dict/modules/venuepolish.de";
import { orgtools_fr } from "@/lib/i18n/dict/modules/orgtools.fr";
import { orgtools_it } from "@/lib/i18n/dict/modules/orgtools.it";
import { orgtools_de } from "@/lib/i18n/dict/modules/orgtools.de";
import { admin_fr } from "@/lib/i18n/dict/modules/admin.fr";
import { admin_it } from "@/lib/i18n/dict/modules/admin.it";
import { admin_de } from "@/lib/i18n/dict/modules/admin.de";
import { attend_fr } from "@/lib/i18n/dict/modules/attend.fr";
import { attend_it } from "@/lib/i18n/dict/modules/attend.it";
import { attend_de } from "@/lib/i18n/dict/modules/attend.de";
import { chrome_fr } from "@/lib/i18n/dict/modules/chrome.fr";
import { chrome_it } from "@/lib/i18n/dict/modules/chrome.it";
import { chrome_de } from "@/lib/i18n/dict/modules/chrome.de";
import { signup3_fr } from "@/lib/i18n/dict/modules/signup3.fr";
import { signup3_it } from "@/lib/i18n/dict/modules/signup3.it";
import { signup3_de } from "@/lib/i18n/dict/modules/signup3.de";
import { signup4_fr } from "@/lib/i18n/dict/modules/signup4.fr";
import { signup4_it } from "@/lib/i18n/dict/modules/signup4.it";
import { signup4_de } from "@/lib/i18n/dict/modules/signup4.de";



/**
 * English text is the key. Missing translations fall back to English, so a string is never blank.
 * Placeholders: t("{n} venues match", { n: 3 }).
 */
export type { Dict } from "@/lib/i18n/t-core";
import type { Dict } from "@/lib/i18n/t-core";
export const DICTS: Record<Locale, Dict> = {
  en: {},
  fr: { ...fr, ...manage_fr, ...review_fr, ...author_fr, ...account_fr, ...public_fr, ...program_fr, ...committee_fr, ...ops_fr, ...event_fr, ...reviewpolish_fr, ...data_fr, ...venuepolish_fr, ...authpolish_fr, ...orgtools_fr, ...admin_fr, ...attend_fr, ...opspolish_fr, ...identity_fr, ...signin2_fr, ...chrome_fr, ...signup3_fr, ...signup4_fr },
  it: { ...it, ...manage_it, ...review_it, ...author_it, ...account_it, ...public_it, ...program_it, ...committee_it, ...ops_it, ...event_it, ...reviewpolish_it, ...data_it, ...venuepolish_it, ...authpolish_it, ...orgtools_it, ...admin_it, ...attend_it, ...opspolish_it, ...identity_it, ...signin2_it, ...chrome_it, ...signup3_it, ...signup4_it },
  de: { ...de, ...manage_de, ...review_de, ...author_de, ...account_de, ...public_de, ...program_de, ...committee_de, ...ops_de, ...event_de, ...reviewpolish_de, ...data_de, ...venuepolish_de, ...authpolish_de, ...orgtools_de, ...admin_de, ...attend_de, ...opspolish_de, ...identity_de, ...signin2_de, ...chrome_de, ...signup3_de, ...signup4_de },
};
export type { Vars, T } from "@/lib/i18n/t-core";
import { makeTFrom, type T } from "@/lib/i18n/t-core";

/** Server side only: the browser receives just the current language's table (see I18nProvider). */
export function makeT(locale: Locale, brand?: string): T {
  return makeTFrom(DICTS[locale] ?? {}, brand);
}
