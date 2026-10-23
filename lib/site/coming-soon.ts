/*
 * Settings pages that are switched off for now. Their real page and code stay in place: each page checks this list
 * first and shows a "Coming soon" panel instead. Remove a key here to turn that page back on — nothing else changes.
 */
export type SoonKey = "security" | "privacy" | "notifications" | "calendar" | "preferences";

export const COMING_SOON: ReadonlySet<SoonKey> = new Set<SoonKey>(["security", "privacy", "notifications", "calendar", "preferences"]);

/** Sidebar addresses of the pages above, for the "Soon" tag. */
export const SOON_HREFS: Record<string, SoonKey> = {
  "/workspace/account/security": "security",
  "/workspace/account/privacy": "privacy",
  "/workspace/settings/notifications": "notifications",
  "/workspace/settings/calendar": "calendar",
  "/workspace/settings/preferences": "preferences",
};

export const isSoon = (k: SoonKey) => COMING_SOON.has(k);
export const isSoonHref = (href: string) => !!SOON_HREFS[href] && COMING_SOON.has(SOON_HREFS[href]);
