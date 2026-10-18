import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { card, h2 } from "@/components/submission/shell";
import { FlowFrame } from "@/components/submission/followup/flow-frame";
import { RevisionAside, loadRevisionFlow, revisionFlow } from "@/components/submission/followup/revision-shared";
import { RespondForm } from "@/components/submission/followup/revision-forms";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Respond to reviewers") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const f = await loadRevisionFlow(id);
  const t = await getT();
  return (
    <FlowFrame ctx={f.ctx} crumb={t("Revision")} title={t("Revise and respond")} due={{ at: f.due, kind: "due" }} flow={await revisionFlow(f, 1)} aside={<RevisionAside f={f} />}>
      <section className={card}>
        <h2 className={h2}>{t("Respond to each comment")}</h2>
        <p className="mb-4 mt-1 text-[#4A5263]">{t("Comments are taken from the reviews. Say what you changed and where — the associate editor reads this first.")}</p>
        <RespondForm id={id} items={f.items.map((i) => ({ key: i.key, assignmentId: i.assignmentId, ordinal: i.ordinal, no: i.no, quote: i.quote, response: i.response, changedIn: i.changedIn }))} />
      </section>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={4} rows={4} />}><Inner {...props} /></Reveal>;
}
