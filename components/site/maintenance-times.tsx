"use client";

import { useT } from "@/lib/i18n/client";

/** Maintenance window in the visitor's own time zone. */
export function MaintenanceTimes({ start, end }: { start: string; end: string }) {
  const t = useT();
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d).toLocaleString(t.intl, o);
  return (
    <strong className="text-[#121826]" suppressHydrationWarning>
      {t("{from} – {to}, your time.", { from: f(start, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), to: f(end, { hour: "2-digit", minute: "2-digit" }) })}
    </strong>
  );
}
