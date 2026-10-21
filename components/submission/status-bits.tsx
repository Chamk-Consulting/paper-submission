"use client";

import { useActionState, useState } from "react";
import { fileUrl } from "@/lib/submission/actions";
import { useT } from "@/lib/i18n/client";

export function OpenFile({ path, children, className }: { path: string; children: React.ReactNode; className?: string }) {
  const t = useT();
  const [err, setErr] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => { const r = await fileUrl(path); if (r.url) window.open(r.url, "_blank", "noopener"); else setErr(true); }}>
      {err ? t("Couldn't open") : children}
    </button>
  );
}

