"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

/** Signed-in state and follows, loaded after the (cached, public) page renders. */
export function useFollows() {
  const router = useRouter();
  const [state, setState] = useState<FollowState & { loaded: boolean }>({ signedIn: false, followed: [], loaded: false });
  useEffect(() => {
    let live = true;
    loadFollows().then((s) => { if (live) setState({ ...s, loaded: true }); });
    return () => { live = false; };
  }, []);
  async function toggle(venueId: string, nextHref: string) {
    if (!state.signedIn) { router.push(`/sign-in?next=${encodeURIComponent(nextHref)}`); return; }
    const was = state.followed.includes(venueId);
    setState((p) => ({ ...p, followed: was ? p.followed.filter((x) => x !== venueId) : [...p.followed, venueId] }));
    const r = await toggleFollow(venueId);
    if (!r.ok) {
      setState((p) => ({ ...p, followed: was ? [...p.followed, venueId] : p.followed.filter((x) => x !== venueId) }));
      if (r.reason === "signin") router.push(`/sign-in?next=${encodeURIComponent(nextHref)}`);
    }
  }
  return { ...state, toggle };
}
