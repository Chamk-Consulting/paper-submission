import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { card, h2 } from "@/components/submission/shell";
import { FlowFrame } from "@/components/submission/followup/flow-frame";
import { FinalChecklist, finalFlow, loadFinalFlow } from "@/components/submission/followup/final-shared";
import { FinalSubmitForm } from "@/components/submission/followup/final-forms";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Review & submit") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const f = await loadFinalFlow(id);
  const t = await getT();
  const { ctx, final, regs, pdf, done } = f;
  const base = `/submissions/${id}/final`;
  const presenter = regs.find((r) => r.personId === final?.presenterId);
  const rows: { label: string; value: string; ok: boolean; href: string }[] = [
    { label: t("Camera-ready PDF"), value: pdf ? `${pdf.name} · ${t("{n} pages", { n: pdf.pages ?? "?" })}` : t("Not uploaded"), ok: done.pdf, href: base },
    { label: t("Title & authors"), value: final?.lockedAt ? `${final.finalTitle ?? ctx.sub.title} · ${t("locked")}` : t("Not locked"), ok: done.title, href: `${base}/title-authors` },
    { label: t("Copyright"), value: final?.copyrightStatus === "signed" ? t("Signed by {name}", { name: final.copyrightSigner ?? "—" }) : final?.copyrightStatus === "waiting" ? t("Waiting for IEEE") : t("Not signed"), ok: done.copyright, href: `${base}/copyright` },
    { label: t("Registration & presenter"), value: presenter ? `${presenter.name}${final?.remoteRequested ? ` · ${t("remote requested")}` : ""}` : t("Not chosen"), ok: done.registration, href: `${base}/registration` },
  ];
  const ready = done.pdf && done.title;
  return (
    <FlowFrame ctx={ctx} crumb={t("Final version")} title={t("Final version")} due={{ at: f.due, kind: "due" }} flow={await finalFlow(f, 4)} aside={<FinalChecklist f={f} current={4} />}>
      <section className={card}>
        <h2 className={h2}>{t("Review & submit")}</h2>
        {final?.submittedAt ? <p className="mt-2 rounded-[6px] bg-[#E1F3EA] px-3 py-2 text-[14px] text-[#14603F]">✓ {t("Submitted. Receipt {r}.", { r: final.receipt ?? "—" })}</p> : null}
        <ul className="m-0 mt-3 list-none border-t border-[#EEF0EC] p-0">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3 border-b border-[#EEF0EC] py-3">
              <span aria-hidden className={`flex size-[22px] flex-none items-center justify-center rounded-full text-[12px] font-bold ${r.ok ? "bg-[#E1F3EA] text-[#14603F]" : "bg-[#FBEFDD] text-[#7A4508]"}`}>{r.ok ? "✓" : "!"}</span>
              <span className="min-w-0 flex-auto"><span className="block font-semibold">{r.label}</span><span className="block truncate text-[14px] text-[#4A5263]">{r.value}</span></span>
              <Link href={r.href} className="text-[14px] text-[#2F5FD0]">{t("Change")}</Link>
            </li>
          ))}
        </ul>
        {!done.copyright || !done.registration ? <p className="mt-3 text-[14px] text-[#4A5263]">{t("You can submit now; the paper is complete once the copyright is signed and one author is registered.")}</p> : null}
        {final?.submittedAt ? null : <FinalSubmitForm id={id} ready={ready} />}
      </section>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={5} rows={4} />}><Inner {...props} /></Reveal>;
}
