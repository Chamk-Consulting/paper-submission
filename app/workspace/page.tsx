import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/shell";
import { getWorkspaceCtx } from "@/lib/workspace/data";

export const metadata: Metadata = { title: "My workspace" };

async function Inner({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect("/sign-in?next=/workspace");
  const { notice } = await searchParams;
  const first = ctx.me.person?.given_name?.trim();

  return (
    <WorkspaceShell ctx={ctx} active="home">
      {notice === "password-changed" ? (
        <p role="status" className="mb-5 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3.5 py-2.5 text-[14px] text-[#14603F]">✓ Password changed. Other devices were signed out.</p>
      ) : null}
      <p className="m-0 font-mono text-[12px] text-[#4A5263]">My workspace</p>
      <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">Welcome{first ? `, ${first}` : ""}</h1>
      <p className="mt-1.5 text-[#4A5263]">Everything you owe, across every venue.</p>
      {/* TODO(WS01): due-next list, role tabs and to-do cards from canvas WS01-Workspace. */}
      <div className="mt-6 grid max-w-[720px] gap-3.5 sm:grid-cols-2">
        <Link href="/workspace/submissions" className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-4 text-[#121826] no-underline hover:border-[#B7BDC9]">
          <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">Author</div>
          <div className="mt-1 font-semibold">My submissions</div>
          <div className="text-[13px] text-[#4A5263]">{ctx.submissionCount} {ctx.submissionCount === 1 ? "paper" : "papers"}</div>
        </Link>
        <Link href="/#open-calls" className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-4 text-[#121826] no-underline hover:border-[#B7BDC9]">
          <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">Venues</div>
          <div className="mt-1 font-semibold">Find a call for papers</div>
          <div className="text-[13px] text-[#4A5263]">Open calls, in your time zone</div>
        </Link>
      </div>
    </WorkspaceShell>
  );
}

export default function Page(props: { searchParams: Promise<{ notice?: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}>
      <Inner {...props} />
    </Suspense>
  );
}
