"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { isIOS, isStandalone, promptInstall, pwaStore, serverState } from "@/components/pwa/store";
import { getConsent, onConsentChange, prefStorage } from "@/lib/consent-client";

const DISMISS_KEY = "plenary.installDismissed";

/**
 * Invitation to install Plenary as an app, shown in the workspace once the cookie choice is made.
 * Chrome/Edge/Android: real install prompt. iPhone/iPad Safari: short "Add to Home Screen" hint.
 * "Not now" is remembered (on the device with preferences consent, else for this session).
 */
export function InstallPrompt() {
  const t = useT();
  const s = useSyncExternalStore(pwaStore.subscribe, pwaStore.get, () => serverState);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const check = () => {
      setDismissed(!!prefStorage()?.getItem(DISMISS_KEY));
      setReady(!!getConsent());
      setIos(isIOS() && !isStandalone());
    };
    check();
    return onConsentChange(check);
  }, []);

  if (!ready || dismissed || s.installed || (!s.install && !ios)) return null;
  const close = () => { prefStorage()?.setItem(DISMISS_KEY, "1"); setDismissed(true); };

  return (
    <aside aria-label={t("Install Plenary")} className="consent-in vt-install fixed bottom-5 right-5 z-[85] w-[min(360px,calc(100vw-40px))] rounded-[10px] border border-[#DADDE3] bg-white p-4 text-[14px] text-[#121826] shadow-[0_12px_40px_rgba(14,27,61,0.18)]">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="flex-none rounded-[9px]" />
        <div className="min-w-0">
          <div className="font-semibold">{t("Install Plenary")}</div>
          <p className="mb-0 mt-0.5 text-[13px] text-[#4A5263]">
            {ios ? t("On iPhone or iPad: tap Share, then “Add to Home Screen”.") : t("Open it from your dock or home screen — deadlines one tap away, even on a weak connection.")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={close} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-medium">{ios ? t("Got it") : t("Not now")}</button>
        {!ios ? <button type="button" onClick={async () => { if (await promptInstall()) close(); }} className="h-9 rounded-[4px] border-0 bg-[#0E1B3D] px-3.5 text-[13px] font-semibold text-white">{t("Install")}</button> : null}
      </div>
    </aside>
  );
}

/** "Install app" entry for menus; renders nothing when installing isn't possible. */
export function InstallMenuItem({ className = "" }: { className?: string }) {
  const t = useT();
  const s = useSyncExternalStore(pwaStore.subscribe, pwaStore.get, () => serverState);
  if (!s.install || s.installed) return null;
  return <button type="button" role="menuitem" onClick={() => void promptInstall()} className={className}>{t("Install app")}</button>;
}
