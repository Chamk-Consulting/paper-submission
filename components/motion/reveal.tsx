import { Suspense, type ReactNode } from "react";

/**
 * Suspense with a layout-true placeholder, under one rule for the whole app (globals.css, .reveal-wait): the
 * placeholder stays invisible for 150 ms and then fades in as one piece, so fast pages go straight from the frame to
 * their content and slower ones show the page outline almost at once (never a blank screen). Content shows at once.
 * Placeholders are shapes that match the final layout; no real text (it would re-draw when the page arrives).
 */
export function Reveal({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Suspense fallback={<div className="reveal-wait">{fallback}</div>}>
      <div className="reveal-in">{children}</div>
    </Suspense>
  );
}
