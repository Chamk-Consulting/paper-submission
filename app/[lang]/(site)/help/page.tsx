import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { SiteHeader } from "@/components/site/site-header";
import { HelpCenter } from "@/components/site/help-center";
import { HelpSkeleton } from "@/components/skeletons/site1";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Help & guides"), description: t("Answers for authors, reviewers, editors and organizers.") };
}

async function Inner({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, ctx] = await Promise.all([searchParams, getWorkspaceCtx()]);
  const query = typeof q === "string" ? q.slice(0, 80) : "";
  const body = <HelpCenter initialQuery={query} signedIn={!!ctx} />;
  if (ctx) {
    return (
      <WorkspaceShell ctx={ctx} active="m:help">
        <div className="max-w-[1280px]">{body}</div>
      </WorkspaceShell>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <SiteHeader />
      <main className="flex flex-auto flex-col"><HelpCenter initialQuery={query} signedIn={false} hero /></main>
    </div>
  );
}

/** HP01 — Help & guides (inside the workspace when signed in, public otherwise). */
export default function Page(props: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Reveal fallback={<div className="min-h-dvh bg-[#F5F6F3] px-5 pt-[92px] sm:px-8"><div className="mx-auto max-w-[1280px]"><HelpSkeleton /></div></div>}>
      <Inner {...props} />
    </Reveal>
  );
}
