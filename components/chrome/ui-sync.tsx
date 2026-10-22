"use client";

import { useEffect } from "react";
import { useSummary } from "@/components/chrome/summary";
import { applyUi } from "@/lib/account/ui-prefs";
import { setDeviceZone } from "@/lib/account/actions";

/** Brings Settings › Preferences to this browser (a choice made on another device shows here too), and keeps the
 * saved time zone in step with this device when "Follow my device" is on (at most once per tab). */
export function UiSync() {
  const s = useSummary();
  const ui = s?.ui;
  const key = ui ? JSON.stringify(ui) : "";
  useEffect(() => { if (ui) applyUi(ui); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const tz = s?.timezone;
  const follow = !!ui?.followDevice;
  useEffect(() => {
    if (!follow) return;
    try {
      const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!device || device === tz || sessionStorage.getItem("plenary.tzSynced") === device) return;
      sessionStorage.setItem("plenary.tzSynced", device);
      void setDeviceZone(device);
    } catch { /* storage blocked */ }
  }, [follow, tz]);
  return null;
}
