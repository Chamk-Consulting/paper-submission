import Link from "@/components/site/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame } from "@/components/account/settings-frame";
import { ExportPanel } from "@/components/data/export-panel";
import { ExportSkeleton } from "@/components/skeletons/data";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getExportPage } from "@/lib/data/data";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Your data export") };
}

type P = { searchParams: Promise<{ expired?: string }> };

async function Inner({ searchParams }: P) {
  const [ctx, page, t, sp] = await Promise.all([getWorkspaceCtx(), getExportPage(), getT(), searchParams]);
  if (!ctx || !page) redirect("/sign-in?next=/workspace/account/privacy/export");
  return (
    <WorkspaceShell ctx={ctx} active="m:settings">
      <SettingsFrame active="privacy">
        <div className="flex min-w-0 flex-auto flex-col gap-[18px]">
          <nav aria-label={t("Breadcrumb")} className="text-[13px] text-[#4A5263]"><Link href="/workspace/account/privacy" className="text-[#2F5FD0]">{t("Privacy & data")}</Link> / {t("Export")}</nav>
          <ExportPanel page={page} expiredHint={sp.expired === "1"} />
        </div>
      </SettingsFrame>
    </WorkspaceShell>
  );
}

/** Canvas ST05 — your data export, and your data requests. */
export default function Page(props: P) {
  return <Reveal fallback={<ExportSkeleton />}><Inner {...props} /></Reveal>;
}
