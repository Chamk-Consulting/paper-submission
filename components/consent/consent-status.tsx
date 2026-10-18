"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { CONSENT_COOKIE } from "@/lib/consent";
import { getConsent, onConsentChange, openCookieSettings } from "@/lib/consent-client";

const read = () => document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`))?.[1] ?? "none";

/** "Your current choice" box on the cookie policy page, with a button to change it. */
export function ConsentStatus() {
  const t = useT();
  const raw = useSyncExternalStore(onConsentChange, read, () => "ssr");
  const c = raw === "ssr" ? null : getConsent();
  const label = raw === "ssr" ? "…" : !c ? t("Not chosen yet") : c.preferences ? t("Necessary + preferences") : t("Necessary only");
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Your current choice")}</div>
        <div className="mt-0.5 font-semibold">{label}</div>
      </div>
      <button type="button" onClick={openCookieSettings} className="inline-flex h-10 items-center rounded-[4px] border-0 bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white hover:bg-[#17285A]">{t("Change my choice")}</button>
    </div>
  );
}
