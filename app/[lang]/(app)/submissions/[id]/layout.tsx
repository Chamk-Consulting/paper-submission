/** A paper's pages inside the workspace: full content width; the edit, revision and final-version steps fold the
 * side menu to icons for room (see focus-mode.tsx). */
import { Suspense } from "react";
import { FocusMode } from "@/components/chrome/focus-mode";

export default function SubmissionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span data-bleed hidden />
      <Suspense fallback={null}><FocusMode /></Suspense>
      {children}
    </>
  );
}
