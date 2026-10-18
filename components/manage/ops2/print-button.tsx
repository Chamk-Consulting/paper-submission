"use client";

import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";

export function PrintButton() {
  const t = useT();
  return <button type="button" onClick={() => window.print()} className={`${ui.primary} print:hidden`}>{t("Print or save as PDF")}</button>;
}
