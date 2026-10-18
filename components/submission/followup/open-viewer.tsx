"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { SubFile } from "@/lib/submission/data";
import { ViewerSkeleton } from "@/components/skeletons/author";

export type ViewerFile = Pick<SubFile, "id" | "name" | "path" | "mime" | "pages" | "check" | "version" | "role">;

// pdf.js is heavy: load the viewer only when someone opens it.
const Viewer = dynamic(() => import("@/components/submission/followup/viewer").then((m) => m.Viewer), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0E1B3D]/70 p-0 sm:p-4">
      <div className="flex min-h-0 flex-auto flex-col overflow-hidden bg-white sm:rounded-[8px]"><div className="h-14 flex-none bg-[#0E1B3D]" /><ViewerSkeleton /></div>
    </div>
  ),
});

/** "Open in viewer" button for the author's own files (SB05v). */
export function OpenViewer({ id, files, label, className, tab }: { id: string; files: ViewerFile[]; label: string; className?: string; tab?: "checks" | "summary" | "translate" | "ask" }) {
  const [open, setOpen] = useState(false);
  if (!files.length) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "h-10 rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[15px] font-medium"}>{label}</button>
      {open ? <Viewer submissionId={id} files={files} initialTab={tab} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
