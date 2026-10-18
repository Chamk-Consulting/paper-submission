import { ViewTransition, type ReactNode } from "react";
import { VT } from "@/lib/motion";

/**
 * Persistent chrome (headers, step rail, side nav). A stable view-transition name pairs the old and the
 * new copy across navigations and skeleton → content reveals, so the piece stays put instead of
 * fading or sliding with the page. `swap` is for pinned panels whose content changes (fade-through).
 * Each name must appear at most once per page.
 */
export function Pin({ name, swap = false, children }: { name: string; swap?: boolean; children: ReactNode }) {
  return (
    <ViewTransition name={name} share={swap ? VT.chromeSwap : VT.chrome} default="none">
      {children}
    </ViewTransition>
  );
}
