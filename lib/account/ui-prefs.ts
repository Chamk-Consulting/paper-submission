/* Settings › Preferences: how Plenary looks and behaves for one person. Stored in persons.ui_prefs, copied to
   this browser (localStorage "plenary.ui") so the page can apply it before the first paint (app/[lang]/layout.tsx). */

export type UiPrefs = {
  textSize: "normal" | "large";
  motion: "auto" | "reduce";
  contrast: "normal" | "high";
  sidebar: "auto" | "folded";
  start: "home" | "submissions" | "reviews" | "events";
  followDevice: boolean;
};

export const UI_DEFAULTS: UiPrefs = { textSize: "normal", motion: "auto", contrast: "normal", sidebar: "auto", start: "home", followDevice: true };

const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);

export function parseUi(x: unknown): UiPrefs {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return {
    textSize: pick(o.textSize, ["normal", "large"], UI_DEFAULTS.textSize),
    motion: pick(o.motion, ["auto", "reduce"], UI_DEFAULTS.motion),
    contrast: pick(o.contrast, ["normal", "high"], UI_DEFAULTS.contrast),
    sidebar: pick(o.sidebar, ["auto", "folded"], UI_DEFAULTS.sidebar),
    start: pick(o.start, ["home", "submissions", "reviews", "events"], UI_DEFAULTS.start),
    followDevice: typeof o.followDevice === "boolean" ? o.followDevice : UI_DEFAULTS.followDevice,
  };
}

/** Where "start page after sign-in" goes. */
export const START_HREF: Record<UiPrefs["start"], string> = { home: "/workspace", submissions: "/workspace/submissions", reviews: "/workspace/reviews", events: "/workspace/events" };

export const UI_KEY = "plenary.ui";
const SIDE_KEY = "plenary.sideRail";

/** Applies the display choices to <html> and remembers them in this browser. The sidebar choice is applied
 * only when it changed, so folding the sidebar by hand still sticks until the setting itself changes. */
export function applyUi(p: UiPrefs) {
  try {
    const d = document.documentElement.dataset;
    d.text = p.textSize; d.motion = p.motion; d.contrast = p.contrast;
    const before = parseUi(JSON.parse(localStorage.getItem(UI_KEY) ?? "null"));
    const had = localStorage.getItem(UI_KEY) !== null;
    if (!had || before.sidebar !== p.sidebar) localStorage.setItem(SIDE_KEY, p.sidebar === "folded" ? "rail" : "auto");
    localStorage.setItem(UI_KEY, JSON.stringify(p));
    if (!had || before.sidebar !== p.sidebar) window.dispatchEvent(new StorageEvent("storage", { key: SIDE_KEY }));
  } catch { /* storage blocked: the choices still apply on this page */ }
}

/** Inline, before the first paint: the display choices remembered in this browser. */
export const UI_FLAG = `try{var u=JSON.parse(localStorage.getItem("${UI_KEY}")||"{}"),d=document.documentElement.dataset;if(u.textSize==="large")d.text="large";if(u.motion==="reduce")d.motion="reduce";if(u.contrast==="high")d.contrast="high"}catch(e){}`;
