"use client";


/** The public header is now the shared site header (components/chrome/app-chrome.tsx). Kept so pages compile. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PublicHeader(_: { signedIn?: boolean; active?: "venues" | "organizers" | "pricing" | "help" | "contact" | "" }) {
  return null;
}

