import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { asideCard, card, h2 } from "@/components/submission/shell";
import { FlowFrame } from "@/components/submission/followup/flow-frame";
import { FinalChecklist, finalFlow, loadFinalFlow } from "@/components/submission/followup/final-shared";
import { CopyrightForm } from "@/components/submission/followup/final-forms";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sign the copyright form") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const f = await loadFinalFlow(id);
  const t = await getT();
  const { ctx, final } = f;
  return (
    <FlowFrame ctx={ctx} crumb={t("Final version")} title={t("Final version")} due={{ at: f.due, kind: "due" }} flow={await finalFlow(f, 2)}
      aside={
        <>
          <FinalChecklist f={f} current={2} />
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Who can sign")}</h3>
            <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("Any author can sign for all authors. If your employer must sign, send them the IEEE link.")}</p>
          </section>
        </>
      }
    >
      <section className={card}>
        <h2 className={h2}>{t("Sign the copyright form")}</h2>
        <p className="mt-1 text-[#4A5263]">{t("For: {title} · {authors}", { title: final?.finalTitle ?? ctx.sub.title, authors: ctx.authors.map((a) => a.name).join(", ") })}</p>
        <CopyrightForm id={id} type={final?.copyrightType ?? null} status={final?.copyrightStatus ?? "not_started"} signer={final?.copyrightSigner ?? null}
          ecfUrl={process.env.IEEE_ECF_URL || "https://ecopyright.ieee.org/"} locked={!!final?.lockedAt} />
      </section>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={5} rows={3} />}><Inner {...props} /></Reveal>;
}
