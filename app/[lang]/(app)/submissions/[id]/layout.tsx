import { Suspense } from "react";
import { PaperFrame } from "@/components/chrome/focus-mode";

/** A paper's pages inside the workspace: full content width, and the wizard steps fold the side menu (PaperFrame). */
export default function SubmissionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}><PaperFrame /></Suspense>
      {children}
    </>
  );
}
