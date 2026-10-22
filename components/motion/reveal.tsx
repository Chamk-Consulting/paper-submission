import { Suspense, type ReactNode } from "react";

/**
 * Suspense with a layout-true skeleton. The skeleton is part of the prerendered shell, but it stays
 * invisible for the first ~250 ms (CSS, .reveal-wait): fast pages swap straight to their content with
 * no grey flash, slow ones show the skeleton. No fades on the way in — content just appears.
 */
export function Reveal({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return <Suspense fallback={<div className="reveal-wait">{fallback}</div>}>{children}</Suspense>;
}
