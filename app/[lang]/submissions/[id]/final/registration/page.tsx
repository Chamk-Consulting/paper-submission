import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { asideCard, card, h2 } from "@/components/submission/shell";
import { FlowFrame, no4 } from "@/components/submission/followup/flow-frame";
import { FinalChecklist, finalFlow, loadFinalFlow } from "@/components/submission/followup/final-shared";
import { PresenterForm } from "@/components/submission/followup/final-forms";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Registration & presenter") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const f = await loadFinalFlow(id);
  const t = await getT();
  const { ctx, final, regs } = f;
  const covered = regs.find((r) => r.coversPaper);
  const regUrl = ctx.venue.details.website || `/venues/${ctx.venue.slug}`;
  const regDue = f.info?.dates.registration ?? null;
  return (
    <FlowFrame ctx={ctx} crumb={t("Final version")} title={t("Final version")} due={{ at: f.due, kind: "due" }} flow={await finalFlow(f, 3)}
      aside={
        <>
          <FinalChecklist f={f} current={3} />
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Slides and remote talks")}</h3>
            <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("You can upload slides from the paper page once the program is out. Remote presentation is for visa or health reasons only.")}</p>
          </section>
        </>
      }
    >
      <section className={card}>
        <h2 className={h2}>{t("Registration")}</h2>
        {covered ? (
          <p className="mt-3 rounded-[6px] bg-[#E1F3EA] px-3 py-2 text-[15px] text-[#14603F]">✓ {t("{name} is registered ({no}) and the registration covers this paper.", { name: covered.name, no: covered.number ?? "—" })}</p>
        ) : (
          <>
            <p className="mt-3 rounded-[6px] bg-[#FBEFDD] px-3 py-2 text-[15px] text-[#3B2A07]">{t("No author registration covers this paper yet.")}</p>
            <p className="mt-3 text-[15px]">{t("Register on the conference site with paper ID {no} — we link it automatically.", { no: no4(ctx.sub.number) })}</p>
            {regDue ? <p className="mt-1 text-[14px] text-[#4A5263]">{t("Author registration deadline: {date}", { date: new Date(regDue).toLocaleDateString(t.intl, { day: "numeric", month: "short", year: "numeric" }) })}</p> : null}
            <a href={regUrl} target={regUrl.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="mt-3 inline-flex h-10 items-center rounded-[4px] bg-[#0E1B3D] px-4 text-[15px] font-semibold text-white no-underline">{t("Go to registration")} ↗</a>
          </>
        )}
      </section>
      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("Who presents?")}</h2>
        <p className="mt-1 text-[#4A5263]">{t("The presenter must be a registered author.")}</p>
        <PresenterForm id={id} people={regs.map((r) => ({ personId: r.personId, name: r.name, registered: r.registered, number: r.number }))} presenter={final?.presenterId ?? null} remote={!!final?.remoteRequested} />
      </section>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={5} cards={2} rows={2} />}><Inner {...props} /></Reveal>;
}
