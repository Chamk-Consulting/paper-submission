"use client";

import { PublicHeader } from "@/components/venues/public-header";
import { useFollows } from "@/components/venues/use-clock";

/** Public header for non-venue pages: same as LiveHeader but without "Venues" marked as current. */
export function SiteHeader() {
  const f = useFollows();
  return <PublicHeader signedIn={f.signedIn} active="" />;
}
