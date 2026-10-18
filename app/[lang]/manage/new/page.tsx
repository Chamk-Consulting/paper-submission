import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { WorkspaceShell } from "@/components/workspace/shell";
import { CreateEventForm } from "@/components/manage/setup1/create-event-form";
import { Rules } from "@/components/manage/setup1/bits";
import { ROLE_LABEL } from "@/lib/manage/data";
import { canCopy, myEvents, requireSignedIn } from "@/lib/manage/setup1-data";
import { Reveal } from "@/components/motion/reveal";
import { ManageSkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Create an event") };
}

/** EM01 — create an event. */
async function Inner() {
  const ws = await requireSignedIn("/manage/new");
  const [t, events] = await Promise.all([getT(), myEvents()]);
  const past = events.filter(canCopy).map((e) => ({ id: e.venueId, label: e.shortName ?? e.name, detail: t("you were {role}", { role: t(ROLE_LABEL[e.roles[0]] ?? e.roles[0]).toLowerCase() }) }));
  return (
    <WorkspaceShell ctx={ws} active="home">
      <div className="max-w-[1180px]">
        <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Organizer")}</p>
        <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("Create an event")}</h1>
        <p className="mt-1.5 text-[#4A5263]">{t("Takes about 5 minutes. Everything can be changed later in setup.")}</p>
        <div className="mt-[22px] flex flex-col items-start gap-6 xl:flex-row">
          <div className="w-full min-w-0 flex-auto"><CreateEventForm past={past} /></div>
          <Rules rules={[["A2", "Every event keeps at least one owner."], ["A8", "Owners need two-step sign-in."], ["K1", "Copying never copies papers, reviews or accepted roles."]]}>
            <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[18px] py-4">
              <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("You become")}</p>
              <p className="mb-0 mt-2 text-[14px]">{t("The Owner of this event. Add a second owner later so the event never depends on one person (A2).")}</p>
            </section>
          </Rules>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default function Page() {
  return <Reveal fallback={<ManageSkeleton rows={3} />}><Inner /></Reveal>;
}
