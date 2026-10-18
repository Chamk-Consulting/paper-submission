import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/components/submission/frame";
import { WorkspaceShell } from "@/components/workspace/shell";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { asideCard, card, kicker } from "@/components/submission/shell";
import { no4 } from "@/components/submission/followup/flow-frame";
import { MessageChairForm } from "@/components/submission/followup/message-form";
import { Reveal } from "@/components/motion/reveal";
import { WorkspaceFormSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Message the program chair") };
}
type P = { params: Promise<{ id: string }>; searchParams: Promise<{ about?: string }> };

async function Inner({ params, searchParams }: P) {
  const { id } = await params;
  const { about } = await searchParams;
  const ctx = await requireCtx(id, "status");
  const ws = await getWorkspaceCtx();
  const t = await getT();
  const subject = `${no4(ctx.sub.number)} · ${about === "decision" ? t("Question about the decision") : about === "withdraw" ? t("Question about withdrawing") : t("Question about my paper")}`;
  return (
    <WorkspaceShell ctx={ws} active="submissions">
      <p className="m-0 text-[14px] text-[#4A5263]"><Link href="/workspace/submissions" className="text-[#121826] underline">{t("My submissions")}</Link> / <Link href={`/submissions/${id}`} className="text-[#121826] underline">{no4(ctx.sub.number)}</Link> / {t("Message")}</p>
      <h1 className="mt-2 font-serif text-[34px] font-normal leading-[1.15]">{t("Message the program chair")}</h1>
      <p className="mt-1.5 text-[15px] text-[#4A5263]">{ctx.sub.title} · {ctx.venue.acr}</p>
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <section className={`${card} min-w-0 flex-auto`}>
          <MessageChairForm id={id} defaultSubject={subject} />
        </section>
        <aside className="flex w-full flex-col gap-4 lg:w-[300px] lg:flex-none">
          <section className={asideCard}>
            <p className={kicker}>{t("Who reads this")}</p>
            <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("The venue's general and program chairs. Reviewers never see it, and your co-authors aren't copied.")}</p>
          </section>
          <section className={asideCard}>
            <p className={kicker}>{t("Replies")}</p>
            <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("Replies arrive in your Plenary inbox. Your message stays linked to this paper.")}</p>
          </section>
        </aside>
      </div>
    </WorkspaceShell>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<WorkspaceShell ctx={null} active="submissions"><WorkspaceFormSkeleton /></WorkspaceShell>}><Inner {...props} /></Reveal>;
}
