/*
 * Pages that are switched off for now (settings and parts of My work). Their real page and code stay in place: each page checks this list
 * first and shows a "Coming soon" panel instead. Remove a key here to turn that page back on — nothing else changes.
 */
export type SoonKey = "security" | "privacy" | "notifications" | "calendar" | "preferences" | "reviews" | "talks" | "agenda" | "inbox";
/** Keys that sit in the Account/Settings frame; the others use the My work page head. */
export const SETTINGS_SOON: ReadonlySet<SoonKey> = new Set<SoonKey>(["security", "privacy", "notifications", "calendar", "preferences"]);

export const COMING_SOON: ReadonlySet<SoonKey> = new Set<SoonKey>(["security", "privacy", "notifications", "calendar", "preferences", "reviews", "talks", "agenda", "inbox"]);

/** Sidebar addresses of the pages above, for the "Soon" tag. */
export const SOON_HREFS: Record<string, SoonKey> = {
  "/workspace/account/security": "security",
  "/workspace/account/privacy": "privacy",
  "/workspace/settings/notifications": "notifications",
  "/workspace/settings/calendar": "calendar",
  "/workspace/settings/preferences": "preferences",
  "/workspace/reviews": "reviews",
  "/workspace/talks": "talks",
  "/workspace/agenda": "agenda",
  "/workspace/inbox": "inbox",
};

export const isSoon = (k: SoonKey) => COMING_SOON.has(k);
export const isSoonHref = (href: string) => !!SOON_HREFS[href] && COMING_SOON.has(SOON_HREFS[href]);
