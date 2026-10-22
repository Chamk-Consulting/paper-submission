"use client";

import { usePathname } from "next/navigation";
import { barePath } from "@/lib/site/chrome-mode";

/* A paper's pages inside the workspace. Most draw their own full-width bands ([data-bleed]); the wizard steps (edit,
   revision, final version, withdraw…) also fold the side menu to icons ([data-focus-mode]). The co-author, message
   and rebuttal pages were made for the normal padded frame, so they get neither. */
const PADDED = /^\/submissions\/[^/]+\/(confirm|message|rebuttal)(\/|$)/;
const STEPS = /^\/submissions\/[^/]+\/(edit|revision|final|withdraw|type|details|authors|keywords|files|conflicts|review)(\/|$)/;

export function PaperFrame() {
  const p = barePath(usePathname() ?? "/");
  if (PADDED.test(p)) return null;
  return STEPS.test(p) ? <span data-bleed data-focus-mode hidden /> : <span data-bleed hidden />;
}
