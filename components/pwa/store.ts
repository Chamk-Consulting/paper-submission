"use client";

/* Tiny shared state for the PWA layer (install prompt, waiting update, connectivity). */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type State = { install: InstallEvent | null; waiting: ServiceWorker | null; online: boolean; installed: boolean };

let state: State = { install: null, waiting: null, online: true, installed: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const pwaStore = {
  get: () => state,
  set(patch: Partial<State>) { state = { ...state, ...patch }; emit(); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};
export const serverState: State = { install: null, waiting: null, online: true, installed: false };

export async function promptInstall(): Promise<boolean> {
  const ev = state.install;
  if (!ev) return false;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  pwaStore.set({ install: null });
  return outcome === "accepted";
}

export function applyUpdate() {
  const w = state.waiting;
  if (!w) return window.location.reload();
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
  w.postMessage({ type: "SKIP_WAITING" });
}

export const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
