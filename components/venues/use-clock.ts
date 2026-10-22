"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getFollowState, toggleFollow, type FollowState } from "@/lib/venues/actions";

/**
 * Server render uses the cache time + UTC so hydration matches; after mount we switch to the
 * real clock and the viewer's time zone, then tick every minute.
 */
export function useClock(generatedAt: string) {
  const [clock, setClock] = useState({ now: Date.parse(generatedAt), tz: "UTC" });
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const tick = () => setClock({ now: Date.now(), tz });
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  return clock;
}

// One request per page load, shared by every component that needs it.
let pending: Promise<FollowState> | null = null;
const loadFollows = () =>
  (pending ??= getFollowState()
    .catch(() => ({ signedIn: false, followed: [] }))
    .finally(() => setTimeout(() => { pending = null; }, 2000)));

// Last answer, kept for the life of the tab: moving between public pages doesn't ask again or flicker.
let known: FollowState | null = null;
// Before the answer arrives, the session cookie tells us (readable, set by @supabase/ssr) — no "Sign in" flash.
const hasSession = () => /(?:^|;\s*)sb-[a-z0-9]+-auth-token(?:\.0)?=/.test(document.cookie);
const noop = () => () => {};

/** Signed-in state and follows, loaded after the (cached, public) page renders. */
export function useFollows() {
  const router = useRouter();
  const cookieSays = useSyncExternalStore(noop, hasSession, () => false);
  const [state, setState] = useState<FollowState & { loaded: boolean }>(() => (known ? { ...known, loaded: true } : { signedIn: false, followed: [], loaded: false }));
  useEffect(() => {
    let live = true;
    loadFollows().then((s) => { known = s; if (live) setState({ ...s, loaded: true }); });
    return () => { live = false; };
  }, []);
  const signedIn = state.loaded ? state.signedIn : cookieSays;
  async function toggle(venueId: string, nextHref: string) {
    if (!signedIn) { router.push(`/sign-in?next=${encodeURIComponent(nextHref)}`); return; }
    const was = state.followed.includes(venueId);
    setState((p) => ({ ...p, followed: was ? p.followed.filter((x) => x !== venueId) : [...p.followed, venueId] }));
    const r = await toggleFollow(venueId);
    if (!r.ok) {
      setState((p) => ({ ...p, followed: was ? [...p.followed, venueId] : p.followed.filter((x) => x !== venueId) }));
      if (r.reason === "signin") router.push(`/sign-in?next=${encodeURIComponent(nextHref)}`);
    }
  }
  return { ...state, signedIn, toggle };
}
