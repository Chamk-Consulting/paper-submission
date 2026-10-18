"use client";

import { CONSENT_COOKIE, CONSENT_MAX_AGE, parseConsent, serializeConsent, type Consent, type ConsentCategory } from "@/lib/consent";
import { LOCALE_COOKIE } from "@/lib/i18n/config";

/* Browser side of cookie consent: read/write the record and keep other storage in line with it. */

const EVENT = "pl:consent";
const OPEN_EVENT = "pl:consent-open";

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? m[1] : null;
}
const secure = () => (window.location.protocol === "https:" ? "; secure" : "");

export function getConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  return parseConsent(readCookie(CONSENT_COOKIE));
}

export function hasConsent(cat: ConsentCategory): boolean {
  if (cat === "necessary") return true;
  return !!getConsent()?.[cat];
}

/** Save the visitor's choice and bring existing storage in line with it. */
export function saveConsent(choice: { preferences: boolean }) {
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(choice)}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax${secure()}`;
  const lang = readCookie(LOCALE_COOKIE);
  if (lang) {
    // With preferences: remember the language for a year. Without: keep it for this browser session only.
    document.cookie = `${LOCALE_COOKIE}=${lang}; path=/; samesite=lax${secure()}${choice.preferences ? "; max-age=31536000" : ""}`;
  }
  if (!choice.preferences) {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("plenary.")).forEach((k) => localStorage.removeItem(k));
    } catch { /* storage blocked */ }
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Language cookie set by an explicit choice in the language menu. */
export function setLanguageCookie(lang: string) {
  document.cookie = `${LOCALE_COOKIE}=${lang}; path=/; samesite=lax${secure()}${hasConsent("preferences") ? "; max-age=31536000" : ""}`;
}

/** Device storage for small UI choices: kept on the device only with "preferences" consent. */
export function prefStorage(): Storage | null {
  try {
    return hasConsent("preferences") ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function onConsentChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Re-open the cookie settings (footer link "Cookie settings"). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}
export function onOpenCookieSettings(cb: () => void) {
  window.addEventListener(OPEN_EVENT, cb);
  return () => window.removeEventListener(OPEN_EVENT, cb);
}
