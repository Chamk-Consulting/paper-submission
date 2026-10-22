"use client";

import { usePathname } from "next/navigation";
import { barePath } from "@/lib/site/chrome-mode";

/** Marks wizard steps (edit, revision, final version, withdraw…) so the side menu folds to icons while you work. */
const STEPS = /^\/submissions\/[^/]+\/(edit|revision|final|withdraw|type|details|authors|keywords|files|conflicts|review)(\/|$)/;
export function FocusMode() {
  const p = barePath(usePathname() ?? "/");
  return STEPS.test(p) ? <span data-focus-mode hidden /> : null;
}
