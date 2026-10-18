import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { WorkspaceSkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("My workspace") };
}

async function Inner({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect("/sign-in?next=/workspace");
  const { notice } = await searchParams;
  const first = ctx.me.person?.given_name?.trim();
  const t = await getT();

  return (
    <WorkspaceShell ctx={ctx} active="home">
      {notice === "password-changed" ? (
        <p role="status" className="mb-5 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3.5 py-2.5 text-[14px] text-[#14603F]">✓ {t("Password changed. Other devices were signed out.")}</p>
      ) : null}
      <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("My workspace")}</p>
      <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{first ? t("Welcome, {name}", { name: first }) : t("Welcome")}</h1>
      <p className="mt-1.5 text-[#4A5263]">{t("Everything you owe, across every venue.")}</p>
      {/* TODO(WS01): due-next list, role tabs and to-do cards from canvas WS01-Workspace. */}
      <div className="mt-6 grid max-w-[720px] gap-3.5 sm:grid-cols-2">
        <Link href="/workspace/submissions" className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-4 text-[#121826] no-underline hover:border-[#B7BDC9]">
          <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Author")}</div>
          <div className="mt-1 font-semibold">{t("My submissions")}</div>
          <div className="text-[13px] text-[#4A5263]">{t(ctx.submissionCount === 1 ? "{n} paper" : "{n} papers", { n: ctx.submissionCount })}</div>
        </Link>
        <Link href="/venues" className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-4 text-[#121826] no-underline hover:border-[#B7BDC9]">
          <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Venues")}</div>
          <div className="mt-1 font-semibold">{t("Find a call for papers")}</div>
          <div className="text-[13px] text-[#4A5263]">{t("Open calls, in your time zone")}</div>
        </Link>
      </div>
    </WorkspaceShell>
  );
}

export default function Page(props: { searchParams: Promise<{ notice?: string }> }) {
  return (
    <Reveal fallback={<WorkspaceSkeleton active="home" />}>
      <Inner {...props} />
    </Reveal>
  );
}
