import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { PapersList } from "@/components/workspace/papers-list";
import { getMyPapers, getWorkspaceCtx } from "@/lib/workspace/data";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { WorkspaceSkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("My submissions") };
}

const card = "rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5";
const kicker = "m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]";

async function Inner({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect("/sign-in?next=/workspace/submissions");
  const [{ ready, papers }, { q }] = await Promise.all([getMyPapers(ctx.me.person?.id), searchParams]);
  const t = await getT();

  return (
    <WorkspaceShell ctx={ctx} active="submissions">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Author")}</p>
          <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("My submissions")}</h1>
          <p className="mt-1.5 text-[#4A5263]">{t("Every paper you are an author on, grouped by venue. One venue can hold several of your papers, each at its own stage.")}</p>
        </div>
        <Link href="/venues" className="inline-flex h-[42px] items-center rounded-[4px] bg-[#F2A93B] px-[18px] text-[15px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{t("+ New submission")}</Link>
      </div>

      {!ready ? (
        // TODO(db): disappears once 20261018000500_submissions.sql is applied.
        <p role="status" className="mt-5 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-2.5 text-[14px] text-[#3B2A07]">
          {t("Papers will show here once the submissions database update is installed.")}
        </p>
      ) : null}

      <div className="mt-[22px] flex flex-col items-start gap-6 xl:flex-row">
        <div className="w-full min-w-0 flex-auto">
          <PapersList papers={papers} initialQuery={q ?? ""} />
        </div>

        <aside className="flex w-full flex-col gap-3.5 xl:w-[300px] xl:flex-none">
          <section className={card}>
            <p className={kicker}>{t("At a glance")}</p>
            <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
              <div><div className="font-serif text-[28px] leading-none">{papers.length}</div><div className="text-[12px] text-[#4A5263]">{t("papers")}</div></div>
              {/* TODO(review): reviews due from review assignments (RV01). */}
              <div><div className="font-serif text-[28px] leading-none text-[#A8600F]">0</div><div className="text-[12px] text-[#4A5263]">{t("reviews due")}</div></div>
              <div><div className="font-serif text-[28px] leading-none">{ctx.aeRoles}</div><div className="text-[12px] text-[#4A5263]">{t("AE role")}</div></div>
            </div>
          </section>
          <section className={card}>
            <div className="flex items-baseline justify-between"><p className={kicker}>{t("Following · next deadlines")}</p><span className="text-[12px] text-[#9AA3B5]" title={t("Coming soon")}>{t("Calendar")}</span></div>
            {/* TODO(follow): followed venues + deadlines (PV01c). */}
            <p className="mb-0 mt-2 text-[13px] text-[#4A5263]">{t("Follow a venue to see its deadlines here, in your time zone.")}</p>
          </section>
          <section className={card}>
            <p className={kicker}>{t("Inbox")}</p>
            {/* TODO(inbox): latest messages (IN01). */}
            <p className="mb-0 mt-2 text-[13px] text-[#4A5263]">{t("No messages yet. Chairs and co-authors reach you here.")}</p>
          </section>
          <span aria-disabled title={t("Coming soon")} className="box-border inline-flex h-[42px] w-full items-center justify-center rounded-[4px] border border-[#DADDE3] bg-white px-3.5 text-[14px] font-medium text-[#9AA3B5]">{t("Add deadlines to my calendar")}</span>
        </aside>
      </div>
    </WorkspaceShell>
  );
}

/** Canvas WS02-Submissions. */
export default function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Reveal fallback={<WorkspaceSkeleton active="submissions" />}>
      <Inner searchParams={searchParams} />
    </Reveal>
  );
}
