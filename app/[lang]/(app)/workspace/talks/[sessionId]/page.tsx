import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { ChairView } from "@/components/program/chair-view";
import { ChairAside } from "@/components/program/chair-aside";
import { ChairSkeleton } from "@/components/skeletons/program";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { loadChairSession, loadMyChairedSessions, slideLinks } from "@/lib/program/data";
import { getT } from "@/lib/i18n/server";

/* Canvas CH01 (one session, Before / On the day) and M05 (?view=live, the phone run sheet). */

type Params = { sessionId: string };
type Search = { view?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { sessionId } = await params;
  const [s, t] = await Promise.all([loadChairSession(sessionId), getT()]);
  return { title: s ? t("Chair · {code}", { code: s.code }) : t("Talks & sessions") };
}

async function Inner({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const [{ sessionId }, { view }] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect(`/sign-in?next=/workspace/talks/${sessionId}`);
  const [s, list, t] = await Promise.all([loadChairSession(sessionId), loadMyChairedSessions(), getT()]);
  if (!s) notFound();
  const slides = await slideLinks(s.talks);
  return (
    <WorkspaceShell ctx={ctx} active="sessions">
      <p className="m-0 font-mono text-[12px] text-[#4A5263] print:hidden">{t("Session chair")}</p>
      <h1 className="mt-1.5 font-serif text-[34px] font-normal leading-[1.1] tracking-[-0.01em] sm:text-[40px] print:text-[28px]">{t("Talks & sessions")}</h1>
      <p className="mt-1.5 text-[#4A5263] print:hidden">{t("Run sheet, presenters and slides for the sessions you chair.")}</p>
      <div className="mt-2 print:hidden"><a href={`/feed/session/${s.id}`} className="text-[14px]">{t("Add to calendar")}</a></div>
      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-auto"><ChairView s={s} slides={slides} view={view === "live" ? "live" : "before"} /></div>
        <ChairAside t={t} list={list} current={s} />
      </div>
    </WorkspaceShell>
  );
}

export default function Page(props: { params: Promise<Params>; searchParams: Promise<Search> }) {
  return (
    <Reveal fallback={<ChairSkeleton />}>
      <Inner {...props} />
    </Reveal>
  );
}
