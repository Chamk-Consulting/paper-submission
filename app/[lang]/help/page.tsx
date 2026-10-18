import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { HelpCenter } from "@/components/site/help-center";
import { HelpSkeleton } from "@/components/skeletons/site1";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Help & guides"), description: t("Answers for authors, reviewers, editors and organizers.") };
}

async function Inner({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, ctx] = await Promise.all([searchParams, getWorkspaceCtx()]);
  const body = <HelpCenter initialQuery={typeof q === "string" ? q.slice(0, 80) : ""} signedIn={!!ctx} />;
  if (ctx) {
    return (
      <WorkspaceShell ctx={ctx} active="m:help">
        <div className="max-w-[1040px]">{body}</div>
      </WorkspaceShell>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <SiteHeader />
      <main className="mx-auto box-border w-full max-w-[1040px] flex-auto px-5 pb-14 pt-8 sm:px-8">{body}</main>
      <SiteFooter />
    </div>
  );
}

/** HP01 — Help & guides (inside the workspace when signed in, public otherwise). */
export default function Page(props: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Reveal fallback={<div className="min-h-dvh bg-[#F5F6F3] px-5 pt-[92px] sm:px-8"><div className="mx-auto max-w-[1040px]"><HelpSkeleton /></div></div>}>
      <Inner {...props} />
    </Reveal>
  );
}
