"use client";

import { ViewTransition, useLayoutEffect, type ReactNode } from "react";
import { VT } from "@/lib/motion";

let previous = 0;

/**
 * Rendered by each wizard screen with its position (1–7 steps, 8 submitted, 0 status page). On mount it
 * compares with the previous screen and hands the direction to the CSS through html[data-nav-dir] —
 * layout effects run inside the view-transition update, before the browser starts animating, so this
 * works for links, server-action redirects and the Back button alike.
 */
export function StepMark({ n }: { n: number }) {
  useLayoutEffect(() => {
    const dir = previous > 0 && n > 0 && n !== previous ? (n > previous ? "forward" : "back") : "none";
    document.documentElement.dataset.navDir = dir;
    previous = n;
  }, [n]);
  return null;
}

/** Wizard steps slide left/right in the direction of travel; header, title band and step rail stay put. */
export function StepTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={VT.stepIn} exit={VT.stepOut} default="none">
      {children}
    </ViewTransition>
  );
}
