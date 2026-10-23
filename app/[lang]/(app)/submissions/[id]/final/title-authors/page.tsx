import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { asideCard, card, h2 } from "@/components/submission/shell";
import { FlowFrame } from "@/components/submission/followup/flow-frame";
import { FinalChecklist, finalFlow, loadFinalFlow } from "@/components/submission/followup/final-shared";
import { TitleLockForm } from "@/components/submission/followup/final-forms";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Final title and authors") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const f = await loadFinalFlow(id);
  const t = await getT();
  const { ctx, final, regs } = f;
  const presenter = final?.presenterId;
  const authors = ctx.authors.map((a) => ({
    name: a.name,
    institution: a.institution,
    tag: a.personId === presenter ? t("Presenter") : a.corresponding ? t("Corresponding") : regs.find((r) => r.personId === a.personId)?.registered ? t("Registered") : !a.hasAccount ? t("No account yet") : null,
  }));
  const noAccount = ctx.authors.filter((a) => !a.hasAccount && !a.isYou).map((a) => a.name);
  return (
    <FlowFrame ctx={ctx} crumb={t("Final version")} title={t("Final version")} due={{ at: f.due, kind: "due" }} flow={await finalFlow(f, 1)}
      aside={
        <>
          <FinalChecklist f={f} current={1} />
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Names in other scripts")}</h3>
            <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("Names in Chinese, Arabic or other scripts appear in the program next to the Latin form. Digital libraries show the Latin form only.")}</p>
          </section>
        </>
      }
    >
      <section className={card}>
        <h2 className={h2}>{t("Final title and authors")}</h2>
        {noAccount.length ? <p className="mt-2 rounded-[6px] bg-[#FBEFDD] px-3 py-2 text-[14px] text-[#3B2A07]">{t("{names} haven't created an account yet. They can still be listed; they need one to register or present.", { names: noAccount.join(", ") })}</p> : null}
        <p className="mt-1 text-[#4A5263]">{t("This is exactly how the paper appears in the program and the proceedings. Check spelling, accents and order.")}</p>
        <TitleLockForm id={id} title={final?.finalTitle ?? ctx.sub.title} authors={authors} locked={!!final?.lockedAt} />
      </section>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={5} rows={3} />}><Inner {...props} /></Reveal>;
}
