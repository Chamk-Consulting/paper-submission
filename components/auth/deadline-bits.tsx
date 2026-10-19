"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { cityOf, countdown, fmtLocal } from "@/lib/venues/time";

const noop = () => () => {};

/** "Fri 12 Mar, 13:59 Lagos" in the visitor's own time zone (rendered after hydration). */
export function LocalDeadline({ iso, fallback = "" }: { iso: string; fallback?: string }) {
  const t = useT();
  const tz = useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => "");
  if (!tz) return <span>{fallback}</span>;
  return <span>{fmtLocal(iso, tz, true, t.intl)} {cityOf(tz)}</span>;
}

/** Live "4d 06h" countdown, updated every minute; "closed" once past. */
export function Countdown({ iso, generatedAt }: { iso: string; generatedAt: string }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.parse(generatedAt));
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return <span>{t("closed")}</span>;
  return <span>{t("closes in {time}", { time: countdown(ms) })}</span>;
}
