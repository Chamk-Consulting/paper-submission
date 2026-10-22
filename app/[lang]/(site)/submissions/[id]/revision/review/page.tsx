import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { asideCard, card, h2 } from "@/components/submission/shell";
import { FlowFrame } from "@/components/submission/followup/flow-frame";
import { loadRevisionFlow, revisionFlow } from "@/components/submission/followup/revision-shared";
import { RevisionSubmitForm } from "@/components/submission/followup/revision-forms";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Review and submit") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const f = await loadRevisionFlow(id);
  const t = await getT();
  const base = `/submissions/${id}/revision`;
  const ready = f.done.responses && f.done.files;
  return (
    <FlowFrame ctx={f.ctx} crumb={t("Revision")} title={t("Revise and respond")} due={{ at: f.due, kind: "due" }} flow={await revisionFlow(f, 3)}
      aside={
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{t("After you submit")}</h3>
          <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("You can't change the revision while it is being checked. The associate editor usually replies within 2 weeks.")}</p>
        </section>
      }
    >
      <section className={card}>
        <h2 className={h2}>{t("Review and submit")}</h2>
        <p className="mt-1 text-[#4A5263]">{t("The associate editor gets your responses and the revised paper. The original reviewers may be asked to check it.")}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[14px]">
            <thead><tr className="border-b border-[#DADDE3] text-[12px] uppercase tracking-[0.06em] text-[#4A5263]"><th className="py-2 pr-3 font-medium">{t("Comment")}</th><th className="py-2 pr-3 font-medium">{t("Your response")}</th><th className="py-2 font-medium">{t("Where")}</th></tr></thead>
            <tbody>
              {f.items.map((c) => (
                <tr key={c.key} className="border-b border-[#EEF0EC] align-top">
                  <td className="py-2.5 pr-3"><span className="font-semibold">{c.ordinal ? `${c.ordinal}.${c.no}` : t("General")}</span> <span className="line-clamp-2 text-[#4A5263]">{c.quote}</span></td>
                  <td className={`py-2.5 pr-3 ${c.response.trim().length > 5 ? "" : "text-[#B3261E]"}`}><span className="line-clamp-3">{c.response.trim() || t("Not answered")}</span></td>
                  <td className="py-2.5">{c.changedIn || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link href={`${base}/respond`} className="mt-2 inline-block text-[14px] text-[#2F5FD0]">{t("Edit responses")}</Link>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-[6px] bg-[#F7F8F6] px-4 py-3 text-[14px]">
          <span className={f.files.revision ? "" : "text-[#B3261E]"}>{f.files.revision ? `✓ ${f.files.revision.name}${f.files.revision.pages ? ` · ${t("{n} pages", { n: f.files.revision.pages })}` : ""}` : t("Revised paper missing")}</span>
          {f.files.highlighted ? <span>✓ {f.files.highlighted.name}</span> : null}
          {f.files.supplementary ? <span>✓ {f.files.supplementary.name}</span> : null}
          <Link href={`${base}/files`} className="text-[#2F5FD0]">{t("Change files")}</Link>
        </div>
        {!ready ? <p className="mt-3 text-[14px] text-[#B3261E]">{!f.done.responses ? t("Answer every comment before submitting.") : t("Upload the revised paper first.")}</p> : null}
        <RevisionSubmitForm id={id} ready={ready} />
      </section>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={4} rows={4} />}><Inner {...props} /></Reveal>;
}
