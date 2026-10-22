"use client";

import { useSyncExternalStore } from "react";

export type VenueRef = { slug: string; name: string; shortName: string | null; roles: string[] };
export type Summary = {
  signedIn: boolean; name?: string; initials?: string; plenaryId?: string | null; unread?: number; submissionCount?: number;
  venues?: VenueRef[]; organizerOf?: string | null; isAdmin?: boolean;
  following?: { slug: string; name: string; shortName: string | null }[];
  currentEvents?: { slug: string; name: string }[]; myEventsCount?: number; followingCount?: number;
  timezone?: string | null; ui?: import("@/lib/account/ui-prefs").UiPrefs;
};

/*
 * The signed-in person's header data, fetched once per tab and refreshed in the background (on focus, and
 * on navigation at most every 15 s). Kept in sessionStorage so a reload paints the avatar and badges at once.
 * The page itself never waits for it.
 */
const KEY = "plenary:summary";
let state: Summary | null = null;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function readCache(): Summary | null {
  try { const raw = sessionStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Summary) : null; } catch { return null; }
}
function writeCache(s: Summary | null) {
  try { if (s?.signedIn) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

/** The session cookie set by @supabase/ssr (readable). Used before the summary arrives. */
export const hasSessionCookie = () => typeof document !== "undefined" && /(?:^|;\s*)sb-[a-z0-9]+-auth-token(?:\.0)?=/.test(document.cookie);

function setAuthFlag(signedIn: boolean) {
  document.documentElement.dataset.auth = signedIn ? "in" : "out";
}

export function refreshSummary(force = false): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!force && (inflight || Date.now() - fetchedAt < 15_000)) return inflight ?? Promise.resolve();
  inflight = fetch("/api/me/summary", { cache: "no-store", credentials: "same-origin" })
    .then((r) => (r.ok ? (r.json() as Promise<Summary>) : null))
    .then((s) => {
      if (!s) return;
      state = s; fetchedAt = Date.now(); writeCache(s); setAuthFlag(s.signedIn); emit();
    })
    .catch(() => {})
    .finally(() => { inflight = null; });
  return inflight;
}

/**
 * Call on every page change. Signing in or out happens without a full page load (code screens, server actions),
 * so compare the session cookie with what the header shows and refresh at once when they disagree.
 */
export function syncAuth(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const cookie = hasSessionCookie();
  const shown = state?.signedIn ?? document.documentElement.dataset.auth === "in";
  if (cookie !== shown) {
    setAuthFlag(cookie);
    if (!cookie) { clearSummary(); return Promise.resolve(); }
    return refreshSummary(true);
  }
  return refreshSummary();
}

/** Forget the person (sign out). */
export function clearSummary() {
  state = { signedIn: false }; writeCache(null); setAuthFlag(false); emit();
}

function subscribe(f: () => void) {
  subs.add(f);
  if (!state) { state = readCache(); if (state) emit(); }
  void refreshSummary();
  return () => subs.delete(f);
}
const snapshot = () => state;
const serverSnapshot = () => null;

export function useSummary(): Summary | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
