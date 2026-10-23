import Link from "@/components/site/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { ChairAside } from "@/components/program/chair-aside";
import { ChairSkeleton } from "@/components/skeletons/program";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { loadMyChairedSessions } from "@/lib/program/data";
import { getEventRows } from "@/lib/workspace/events-pages";
import { loadTalksAndSessions } from "@/lib/workspace/my-work";
import { TalksList, type TalkRow } from "@/components/workspace/talks-list";
import { fmtDay, fmtTime } from "@/lib/program/time";
import { getT } from "@/lib/i18n/server";
import { isSoon } from "@/lib/site/coming-soon";
import { ComingSoonPage } from "@/components/account/coming-soon";

/* Canvas CH01, widened: talks I give and sessions I chair or co-chair, soonest first. */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Talks & sessions") };
}

type Search = { when?: string; role?: string; q?: string; event?: string };

async function Inner({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect("/sign-in?next=/workspace/talks");
  const [ev, list, t, sp] = await Promise.all([getEventRows(), loadMyChairedSessions(), getT(), searchParams]);
  const items: TalkRow[] = (await loadTalksAndSessions(ctx.me.person?.id, ev.rows)).map((x) => ({
    ...x, when: `${fmtDay(x.startsAt, x.timezone, t.intl)} ${fmtTime(x.startsAt, x.timezone, t.intl)}–${fmtTime(x.endsAt, x.timezone, t.intl)}`,
  }));
  const now = Date.parse(ev.generatedAt);
  const live = list.find((x) => Date.parse(x.startsAt) <= now && Date.parse(x.endsAt) >= now);

  return (
    <WorkspaceShell ctx={ctx} active="sessions">
      <h1 className="m-0 font-serif text-[34px] font-normal leading-[1.1] tracking-[-0.01em] sm:text-[40px]">{t("Talks & sessions")}</h1>
      <p className="mt-1.5 text-[#4A5263]">{t("The talks you give and the sessions you chair, across every event.")}</p>
      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-auto flex-col gap-5">
          {live ? (
            <Link href={`/workspace/talks/${live.id}?view=live`} className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-[#0E1B3D] px-5 py-4 text-[#F5F6F3] no-underline">
              <span><span className="font-mono text-[11px] tracking-[0.06em] text-[#F2A93B]">{t("NOW")}</span> <strong className="ml-2">{live.code} · {live.title}</strong></span>
              <span className="text-[14px] text-[#F2A93B]">{t("Open the live run sheet →")}</span>
            </Link>
          ) : null}
          <TalksList items={items} generatedAt={ev.generatedAt} init={sp} />
        </div>
        {list.length ? <ChairAside t={t} list={list} /> : null}
      </div>
    </WorkspaceShell>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  // Switched off for now (lib/site/coming-soon.ts); the page below is kept as is.
  if (isSoon("talks")) return <Reveal fallback={<ChairSkeleton />}><ComingSoonPage active="talks" next="/workspace/talks" /></Reveal>;
  return (
    <Reveal fallback={<ChairSkeleton />}>
      <Inner searchParams={searchParams} />
    </Reveal>
  );
}
