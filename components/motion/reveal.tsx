import { Suspense, type ReactNode } from "react";

/**
 * Suspense with a layout-true placeholder, under one rule for the whole app (globals.css, .reveal-wait): the
 * placeholder stays fully invisible for 700 ms and then fades in as one piece, so fast pages go straight from the
 * frame to their content and only slow ones show a skeleton. Content fades in over 140 ms instead of popping.
 * Placeholders are shapes that match the final layout; no real text (it would re-draw when the page arrives).
 */
export function Reveal({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Suspense fallback={<div className="reveal-wait">{fallback}</div>}>
      <div className="reveal-in">{children}</div>
    </Suspense>
  );
}
