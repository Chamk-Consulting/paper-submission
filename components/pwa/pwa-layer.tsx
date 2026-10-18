"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { applyUpdate, isStandalone, pwaStore, serverState } from "@/components/pwa/store";

/**
 * Mounted once in the root layout: registers the service worker (production only), surfaces a waiting
 * update ("New version — Reload"), captures the install prompt for <InstallPrompt>, and shows a small
 * pill while the device is offline.
 */
export function PwaLayer() {
  const t = useT();
  const s = useSyncExternalStore(pwaStore.subscribe, pwaStore.get, () => serverState);
  const [backOnline, setBackOnline] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    pwaStore.set({ online: navigator.onLine, installed: isStandalone() });
    const onBip = (e: Event) => { e.preventDefault(); pwaStore.set({ install: e as never }); };
    const onInstalled = () => pwaStore.set({ install: null, installed: true });
    let timer = 0;
    const onOnline = () => {
      pwaStore.set({ online: true });
      if (wasOffline.current) { setBackOnline(true); timer = window.setTimeout(() => setBackOnline(false), 2500); }
      wasOffline.current = false;
    };
    const onOffline = () => { wasOffline.current = true; pwaStore.set({ online: false }); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const register = async () => {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
          const track = (w: ServiceWorker | null) => {
            if (!w) return;
            w.addEventListener("statechange", () => {
              // A new version is ready while an old one controls the page → offer a reload.
              if (w.state === "installed" && navigator.serviceWorker.controller) pwaStore.set({ waiting: w });
            });
          };
          if (reg.waiting && navigator.serviceWorker.controller) pwaStore.set({ waiting: reg.waiting });
          navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ type: "LANG", lang: document.documentElement.lang })).catch(() => {});
          track(reg.installing);
          reg.addEventListener("updatefound", () => track(reg.installing));
          // Check for a new version when the app comes back to the foreground.
          document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
        } catch { /* unsupported or blocked: the site still works normally */ }
      };
      if (document.readyState === "complete") register(); else window.addEventListener("load", register, { once: true });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div aria-live="polite" className="vt-toasts pointer-events-none fixed inset-x-0 bottom-0 z-[95] flex flex-col items-center gap-2 px-3 pb-3">
      {s.waiting ? (
        <div role="status" className="toast-in pointer-events-auto flex max-w-[calc(100vw-24px)] items-center gap-3 rounded-full bg-[#0E1B3D] py-1.5 pl-4 pr-1.5 text-[14px] text-[#F5F6F3] shadow-[0_8px_24px_rgba(14,27,61,0.3)]">
          <span>{t("A new version of Plenary is ready.")}</span>
          <button type="button" onClick={applyUpdate} className="h-8 rounded-full border-0 bg-[#F2A93B] px-3.5 text-[13px] font-semibold text-[#0E1B3D]">{t("Reload")}</button>
        </div>
      ) : null}
      {!s.online ? (
        <div role="status" className="toast-in flex items-center gap-2 rounded-full bg-[#3B2A07] px-4 py-2 text-[13px] text-[#FFF6E6] shadow-[0_8px_24px_rgba(14,27,61,0.25)]">
          <span aria-hidden className="size-2 rounded-full bg-[#F2A93B]" />{t("You’re offline — pages you opened before still work.")}
        </div>
      ) : backOnline ? (
        <div role="status" className="toast-in flex items-center gap-2 rounded-full bg-[#14603F] px-4 py-2 text-[13px] text-white shadow-[0_8px_24px_rgba(14,27,61,0.25)]">
          <span aria-hidden className="size-2 rounded-full bg-[#B9E0CB]" />{t("Back online")}
        </div>
      ) : null}
    </div>
  );
}
