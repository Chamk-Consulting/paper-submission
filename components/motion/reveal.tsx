import { Suspense, ViewTransition, type ReactNode } from "react";
import { VT } from "@/lib/motion";

/**
 * Suspense with a layout-true skeleton: the skeleton is part of the prerendered shell (shown at once on
 * navigation) and dissolves into the real content when it streams in.
 */
export function Reveal({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Suspense fallback={<ViewTransition exit={VT.skeletonOut} default="none">{fallback}</ViewTransition>}>
      <ViewTransition enter={VT.contentIn} default="none">{children}</ViewTransition>
    </Suspense>
  );
}
