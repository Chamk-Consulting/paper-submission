"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

/** "21 Oct" (server, UTC) → "21 Oct, 23:59" in the viewer's time zone after hydration. */
export function LocalWhen({ at, className }: { at: string; className?: string }) {
  const t = useT();
  const d = new Date(at);
  const [text, setText] = useState(() => d.toLocaleDateString(t.intl, { day: "numeric", month: "short", timeZone: "UTC" }));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- local time zone is only known in the browser
    setText(new Date(at).toLocaleString(t.intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
  }, [at, t.intl]);
  return <time dateTime={at} className={className} suppressHydrationWarning>{text}</time>;
}
