import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { WorkspaceShell } from "@/components/workspace/shell";
import { ui } from "@/components/manage/ui";
import { ROLE_LABEL } from "@/lib/manage/data";
import { myEvents, requireSignedIn } from "@/lib/manage/setup1-data";
import { Reveal } from "@/components/motion/reveal";
import { ManageSkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Events I organize") };
}

const STATUS: Record<string, [string, string, string]> = {
  draft: ["Setup", "#EEF0EC", "#4A5263"], open: ["Submissions open", "#E1F3EA", "#14603F"], reviewing: ["Reviewing", "#E6EDFC", "#1F47A8"],
  decisions: ["Decisions", "#FBEFDD", "#7A4508"], finals: ["Final versions", "#FBEFDD", "#7A4508"], program: ["Program", "#E6EDFC", "#1F47A8"],
  live: ["Live", "#E1F3EA", "#14603F"], closed: ["Closed", "#EEF0EC", "#4A5263"], archived: ["Archived", "#EEF0EC", "#4A5263"],
};

async function Inner() {
  const ws = await requireSignedIn("/manage");
  const [t, events] = await Promise.all([getT(), myEvents()]);
  return (
    <WorkspaceShell ctx={ws} active="home">
      <div className="max-w-[1000px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Organizer")}</p>
            <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("Events I organize")}</h1>
            <p className="mt-1.5 text-[#4A5263]">{t("Every event where you hold a committee role.")}</p>
          </div>
          <Link href="/manage/new" className={ui.primary}>{t("+ Create event")}</Link>
        </div>
        {events.length ? (
          <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
            {events.map((e) => {
              const [label, bg, fg] = STATUS[e.status] ?? STATUS.draft;
              return (
                <li key={e.venueId} className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#DADDE3] bg-white px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/manage/${e.slug}`} className="text-[18px] font-semibold text-[#121826] no-underline hover:underline">{e.shortName ?? e.name}</Link>
                      <span className={ui.tag} style={{ background: bg, color: fg }}>{t(label)}</span>
                    </div>
                    <div className="text-[14px] text-[#4A5263]">{e.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">{e.roles.map((r) => <span key={r} className={`${ui.tag} bg-[#0E1B3D] text-[#F2A93B]`}>{t(ROLE_LABEL[r] ?? r)}</span>)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.status === "draft" ? <Link href={`/manage/${e.slug}/setup`} className={ui.navy}>{t("Continue setup")}</Link> : <Link href={`/manage/${e.slug}`} className={ui.navy}>{t("Open dashboard")}</Link>}
                    <Link href={`/manage/${e.slug}/setup`} className={ui.ghost}>{t("Setup")}</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-6 rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-9 text-center text-[#4A5263]">
            <p className="m-0">{t("You don’t organize any event yet.")}</p>
            <Link href="/manage/new" className={`${ui.primary} mt-4`}>{t("Create an event")}</Link>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

export default function Page() {
  return <Reveal fallback={<ManageSkeleton rows={2} />}><Inner /></Reveal>;
}
