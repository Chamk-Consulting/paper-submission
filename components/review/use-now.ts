"use client";

import { useEffect, useState } from "react";

/** Server time + UTC on first render (hydration-safe); the real clock and viewer's zone after mount, ticking each minute. */
export function useNow(serverNow: number) {
  const [clock, setClock] = useState({ now: serverNow, tz: "UTC" });
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const tick = () => setClock({ now: Date.now(), tz });
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  return clock;
}
