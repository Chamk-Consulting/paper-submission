"use client";

import { useT } from "@/lib/i18n/client";

export function LoadingLabel() {
  const t = useT();
  return <span role="status" className="sr-only">{t("Loading…")}</span>;
}
