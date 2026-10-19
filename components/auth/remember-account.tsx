"use client";

import { useEffect } from "react";
import { hasConsent } from "@/lib/consent-client";
import { DEVICE_ACCOUNTS_KEY, JUST_SIGNED_IN_COOKIE, decodeAccount, mergeAccount, parseAccounts } from "@/lib/auth/device-accounts";

/** Moves the one-off "just signed in" cookie into device storage for the PR03 account chooser, then deletes it. */
export function RememberAccount() {
  useEffect(() => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${JUST_SIGNED_IN_COOKIE}=([^;]*)`));
    if (!m) return;
    document.cookie = `${JUST_SIGNED_IN_COOKIE}=; path=/; max-age=0; samesite=lax`;
    const acc = decodeAccount(decodeURIComponent(m[1]));
    if (!acc || !hasConsent("preferences")) return;
    try {
      localStorage.setItem(DEVICE_ACCOUNTS_KEY, JSON.stringify(mergeAccount(parseAccounts(localStorage.getItem(DEVICE_ACCOUNTS_KEY)), acc)));
    } catch { /* storage blocked */ }
  }, []);
  return null;
}
