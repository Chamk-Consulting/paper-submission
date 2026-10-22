import type { ReactNode } from "react";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SiteHeader } from "@/components/site/site-header";

/** Help pages sit inside the workspace when signed in, and in the public site otherwise (same as HP01). */
export async function HelpFrame({ children }: { children: ReactNode }) {
  const ctx = await getWorkspaceCtx();
  if (ctx) {
    return (
      <WorkspaceShell ctx={ctx} active="m:help">
        <div className="max-w-[880px]">{children}</div>
      </WorkspaceShell>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <SiteHeader />
      <main className="mx-auto box-border w-full max-w-[880px] flex-auto px-5 pb-14 pt-8 sm:px-8">{children}</main>
    </div>
  );
}
