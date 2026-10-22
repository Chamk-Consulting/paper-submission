import Link from "@/components/site/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { ChairAside } from "@/components/program/chair-aside";
import { ChairSkeleton } from "@/components/skeletons/program";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { loadMyChairedSessions } from "@/lib/program/data";
import { fmtDay, fmtTime } from "@/lib/program/time";
import { getT } from "@/lib/i18n/server";

/* Canvas CH01 — every session I chair or co-chair, soonest first. */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sessions I chair") };
}

async function Inner() {
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect("/sign-in?next=/chair");
  const [list, t] = await Promise.all([loadMyChairedSessions(), getT()]);
  const now = new Date().getTime();
  const upcoming = list.filter((x) => Date.parse(x.endsAt) >= now).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const past = list.filter((x) => Date.parse(x.endsAt) < now);
  const live = upcoming.find((x) => Date.parse(x.startsAt) <= now);

  const card = (x: (typeof list)[number]) => {
    const ok = x.total > 0 && x.ready === x.total;
    return (
      <li key={x.id} className="rounded-[8px] border border-[#DADDE3] bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{x.code} · {x.venueShort}</p>
            <Link href={`/chair/${x.id}`} className="mt-1 block font-serif text-[22px] leading-[1.2] text-[#121826] no-underline hover:underline">{x.title}</Link>
            <p className="m-0 mt-1 text-[14px] text-[#4A5263]">{fmtDay(x.startsAt, x.timezone, t.intl)} {fmtTime(x.startsAt, x.timezone, t.intl)}–{fmtTime(x.endsAt, x.timezone, t.intl)} · {x.room ?? t("Room to be announced")}</p>
          </div>
          <span className="rounded-[4px] px-2.5 py-1 text-[13px] font-semibold" style={{ background: ok ? "#E1F3EA" : "#FBEFDD", color: ok ? "#14603F" : "#7A4508" }}>{t("{n}/{total} presenters ready", { n: x.ready, total: x.total })}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/chair/${x.id}`} className="inline-flex h-10 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-medium text-[#121826] no-underline">{t("Run sheet")}</Link>
          <Link href={`/chair/${x.id}?view=live`} className="inline-flex h-10 items-center rounded-[4px] bg-[#0E1B3D] px-3.5 text-[14px] font-semibold text-white no-underline">{t("On the day")}</Link>
        </div>
      </li>
    );
  };

  return (
    <WorkspaceShell ctx={ctx} active="sessions">
      <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Session chair")}</p>
      <h1 className="mt-1.5 font-serif text-[34px] font-normal leading-[1.1] tracking-[-0.01em] sm:text-[40px]">{t("Sessions I chair")}</h1>
      <p className="mt-1.5 text-[#4A5263]">{t("Run sheet, presenters and slides for the sessions you chair.")}</p>
      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-auto flex-col gap-5">
          {live ? (
            <Link href={`/chair/${live.id}?view=live`} className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-[#0E1B3D] px-5 py-4 text-[#F5F6F3] no-underline">
              <span><span className="font-mono text-[11px] tracking-[0.06em] text-[#F2A93B]">{t("NOW")}</span> <strong className="ml-2">{live.code} · {live.title}</strong></span>
              <span className="text-[14px] text-[#F2A93B]">{t("Open the live run sheet →")}</span>
            </Link>
          ) : null}
          {upcoming.length ? <ul className="m-0 flex list-none flex-col gap-3 p-0">{upcoming.map(card)}</ul> : null}
          {past.length ? (
            <section>
              <h2 className="m-0 mb-2 font-serif text-[22px] font-normal">{t("Earlier")}</h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0 opacity-80">{past.map(card)}</ul>
            </section>
          ) : null}
          {!list.length ? (
            <div className="rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-10 text-center text-[#4A5263]">
              {t("You don’t chair any sessions yet. When a program chair names you, the session shows up here.")}
            </div>
          ) : null}
        </div>
        <ChairAside t={t} list={list} />
      </div>
    </WorkspaceShell>
  );
}

export default function Page() {
  return (
    <Reveal fallback={<ChairSkeleton />}>
      <Inner />
    </Reveal>
  );
}
