import { ViewTransition, type ReactNode } from "react";
import { VT } from "@/lib/motion";

/** Used by template.tsx files: the page content crossfades on navigation (no exit-then-enter wait). */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={VT.pageIn} exit={VT.pageOut} default="none">
      {children}
    </ViewTransition>
  );
}
