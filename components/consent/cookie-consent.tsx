"use client";

import Link from "@/components/site/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { CATEGORIES, CONSENT_COOKIE } from "@/lib/consent";
import { getConsent, onConsentChange, onOpenCookieSettings, openCookieSettings, saveConsent } from "@/lib/consent-client";

/*
 * Cookie banner + settings dialog (mounted once in the root layout).
 * - Shown until the visitor decides; "Accept all" and "Necessary only" have equal weight.
 * - Nothing optional is pre-ticked. The choice lasts 6 months, then we ask again.
 * - "Cookie settings" in every footer re-opens the dialog.
 */

const subscribe = (cb: () => void) => onConsentChange(cb);
const snapshot = () => {
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  return getConsent() && m ? m[1] : "none";
};
const serverSnapshot = () => "ssr";

const btn = "inline-flex min-h-11 min-w-0 flex-[1_1_150px] items-center justify-center rounded-[4px] px-4 py-2 text-center text-[15px] font-semibold leading-tight";

export function CookieConsent() {
  const t = useT();
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const dialog = useRef<HTMLDialogElement>(null);
  const [prefs, setPrefs] = useState(false);

  useEffect(() => onOpenCookieSettings(() => {
    setPrefs(getConsent()?.preferences ?? false);
    dialog.current?.showModal();
  }), []);

  const decide = (preferences: boolean) => {
    saveConsent({ preferences });
    dialog.current?.close();
  };

  return (
    <>
      {state === "none" ? (
        <section
          role="region"
          aria-label={t("Cookie consent")}
          className="consent-in vt-consent fixed inset-x-3 bottom-3 z-[90] rounded-[10px] border border-[#DADDE3] bg-white p-5 text-[14px] leading-[1.5] text-[#121826] shadow-[0_12px_40px_rgba(14,27,61,0.18)] sm:inset-x-auto sm:left-5 sm:bottom-5 sm:w-[min(560px,calc(100vw-40px))]"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 flex size-8 flex-none items-center justify-center rounded-full bg-[#FFF6E6] text-[16px]">🍪</span>
            <div className="min-w-0">
              <h2 className="m-0 font-serif text-[20px] font-normal leading-[1.2]">{t("Cookies on Plenary")}</h2>
              <p className="mb-0 mt-1.5 text-[#4A5263]">
                {t("We use strictly necessary cookies to keep you signed in and the service secure. With your OK, we also remember your language and a few display choices on this device. No advertising, no tracking.")}{" "}
                <Link href="/legal/cookies" className="text-[#2F5FD0]">{t("Cookie policy")}</Link>
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => decide(true)} className={`${btn} border-0 bg-[#0E1B3D] text-white hover:bg-[#17285A]`}>{t("Accept all")}</button>
            <button type="button" onClick={() => decide(false)} className={`${btn} border-0 bg-[#0E1B3D] text-white hover:bg-[#17285A]`}>{t("Necessary only")}</button>
            <button type="button" onClick={openCookieSettings} className={`${btn} border border-[#B7BDC9] bg-white text-[#121826] hover:bg-[#F7F8F6] max-sm:basis-full sm:flex-none`}>{t("Choose…")}</button>
          </div>
        </section>
      ) : null}

      <dialog
        ref={dialog}
        aria-labelledby="cookie-settings-title"
        className="consent-dialog m-auto w-[min(560px,calc(100vw-24px))] rounded-[10px] border border-[#DADDE3] bg-white p-0 text-[15px] leading-[1.5] text-[#121826] shadow-[0_24px_64px_rgba(14,27,61,0.28)] backdrop:bg-[#0E1B3D]/40"
      >
        <form method="dialog" onSubmit={(e) => { e.preventDefault(); decide(prefs); }} className="p-6">
          <h2 id="cookie-settings-title" className="m-0 font-serif text-[26px] font-normal leading-[1.15]">{t("Cookie settings")}</h2>
          <p className="mb-0 mt-2 text-[14px] text-[#4A5263]">{t("Choose what Plenary may store on this device. You can change this at any time from “Cookie settings” at the bottom of every page.")}</p>
          <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
            {CATEGORIES.map((c) => {
              const on = c.required ? true : prefs;
              return (
                <li key={c.key} className="rounded-[8px] border border-[#DADDE3] px-4 py-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <span id={`cc-${c.key}`} className="font-semibold">{t(c.title)}</span>
                    {c.required ? (
                      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#14603F]">{t("Always on")}</span>
                    ) : (
                      <button type="button" role="switch" aria-checked={on} aria-labelledby={`cc-${c.key}`} onClick={() => setPrefs((v) => !v)}
                        className="relative h-6 w-[42px] flex-none rounded-full border-0 p-0" style={{ background: on ? "#18744F" : "#B7BDC9" }}>
                        <span aria-hidden className="absolute top-[3px] size-[18px] rounded-full bg-white shadow transition-[left] duration-150" style={{ left: on ? 21 : 3 }} />
                      </button>
                    )}
                  </div>
                  <p className="mb-0 mt-1 text-[13px] text-[#4A5263]">{t(c.body)}</p>
                </li>
              );
            })}
          </ul>
          <p className="mb-0 mt-4 text-[13px] text-[#4A5263]">
            {t("Plenary uses no advertising or analytics cookies.")} <Link href="/legal/cookies" onClick={() => dialog.current?.close()} className="text-[#2F5FD0]">{t("See every cookie we use")}</Link>
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="submit" className={`${btn} border-0 bg-[#0E1B3D] text-white hover:bg-[#17285A]`}>{t("Save my choices")}</button>
            <button type="button" onClick={() => decide(true)} className={`${btn} border border-[#B7BDC9] bg-white text-[#121826] hover:bg-[#F7F8F6]`}>{t("Accept all")}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** Footer link that re-opens the cookie settings. */
export function CookieSettingsLink({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <button type="button" onClick={openCookieSettings} className={`cursor-pointer border-0 bg-transparent p-0 text-inherit underline-offset-2 hover:underline ${className}`}>
      {t("Cookie settings")}
    </button>
  );
}
