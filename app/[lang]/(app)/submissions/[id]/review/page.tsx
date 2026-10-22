import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { SubmitForm } from "@/components/submission/submit-form";
import { DeadlineBig } from "@/components/submission/live";
import { asideCard, card, h2 } from "@/components/submission/shell";
import { STEPS } from "@/lib/submission/data";
import { Reveal } from "@/components/motion/reveal";
import { WizardSkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Review & submit") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "review");
  const t = await getT();
  const { sub, venue, authors, files, conflicts, done } = ctx;
  const paper = files.find((f) => f.role === "paper" && f.current);
  const extras = files.filter((f) => f.role !== "paper");
  const words = sub.abstract?.trim() ? sub.abstract.trim().split(/\s+/).length : 0;
  const invites = authors.filter((a) => !a.hasAccount).length;
  const missing = STEPS.filter((s) => s.key !== "review" && !done[s.key]);
  const autoInst = new Set(authors.map((a) => a.institution).filter(Boolean)).size;
  const base = `/submissions/${id}`;
  const rows: [string, string, React.ReactNode][] = [
    [t("Venue & type"), "type", <span key="v"><strong>{venue.acr}</strong> · {t(sub.paperType)}{sub.track ? ` · ${t(sub.track)}` : ""}</span>],
    [t("Title"), "details", <span key="t" className="font-serif text-[17px] leading-[1.3]">{sub.title}</span>],
    [t("Abstract"), "details", <span key="a" className="text-[#4A5263]">{(sub.abstract ?? "—").slice(0, 220)}{(sub.abstract?.length ?? 0) > 220 ? "…" : ""} <span className="font-mono text-[12px]">{t("{n} words", { n: words })}</span></span>],
    [t("Authors"), "authors", <ol key="au" className="m-0 list-none p-0">{authors.map((a) => <li key={a.personId}>{a.position}. {a.name}{a.corresponding ? <span className="text-[#4A5263]"> {t("(corresponding)")}</span> : null}{!a.hasAccount ? <span className="ml-1.5 font-mono text-[11px] text-[#7A4508]">{t("INVITE ON SUBMIT")}</span> : null}</li>)}</ol>],
    [t("Keywords"), "keywords", sub.keywords.length ? <span key="k">{sub.keywords.map((k, i) => <span key={k}>{i ? " · " : ""}{i === 0 ? <strong>{t(k)} {t("(main)")}</strong> : t(k)}</span>)}</span> : <span key="k0" className="text-[#B3261E]">{t("None yet")}</span>],
    [t("Files"), "files", paper ? <span key="f">{paper.name}{paper.pages != null ? ` · ${t("{n} pages", { n: paper.pages })}` : ""} <span className="ml-1 rounded-[2px] px-1.5 font-mono text-[11px]" style={{ background: paper.check.status === "failed" ? "#FDECEA" : "#E1F3EA", color: paper.check.status === "failed" ? "#B3261E" : "#14603F" }}>{paper.check.status === "failed" ? t("× PROBLEMS") : t("✓ PASSED")}</span>{extras.length ? <span className="block text-[#4A5263]">+ {extras.map((e) => e.name).join(" · ")}</span> : null}</span> : <span key="f0" className="text-[#B3261E]">{t("No PDF yet")}</span>],
    [t("Conflicts"), "conflicts", `${autoInst + conflicts.length} — ${t(autoInst === 1 ? "{n} institution" : "{n} institutions", { n: autoInst })}, ${t(conflicts.length === 1 ? "{n} person" : "{n} people", { n: conflicts.length })}`],
  ];
  return (
    <SubmissionFrame ctx={ctx} step="review" aside={
      <>
        <DeadlineBig deadline={venue.deadline} generatedAt={new Date(sub.updatedAt).toISOString()} />
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{missing.length ? t(missing.length === 1 ? "{n} step to finish" : "{n} steps to finish", { n: missing.length }) : t("All checks passed")}</h3>
          <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0 text-[15px]">
            {missing.length ? missing.map((m) => <li key={m.key} className="text-[#B3261E]">× <Link href={`${base}/${m.key}`} className="text-[#B3261E] underline">{t(m.label)}</Link></li>) : (
              <>
                <li><span className="text-[#14603F]">✓</span> {t("Required fields complete")}</li>
                <li><span className="text-[#14603F]">✓</span> {t("PDF meets the template")}</li>
                <li><span className="text-[#14603F]">✓</span> {t("Conflicts reviewed")}</li>
              </>
            )}
            {invites ? <li className="text-[#7A4508]">! {t(invites === 1 ? "{n} co-author will be invited by email" : "{n} co-authors will be invited by email", { n: invites })}</li> : null}
          </ul>
        </section>
      </>
    }>
      <section className={card}>
        <h2 className={h2}>{t("Check everything once")}</h2>
        <dl className="m-0 mt-3">
          {rows.map(([label, step, value]) => (
            <div key={label} className="grid grid-cols-[110px_1fr_auto] gap-3 border-b border-[#EEF0EC] py-3.5 last:border-b-0 sm:grid-cols-[150px_1fr_auto]">
              <dt className="text-[14px] font-medium text-[#4A5263]">{label}</dt>
              <dd className="m-0 min-w-0 text-[15px]">{value}</dd>
              <dd className="m-0"><Link href={`${base}/${step}`} className="text-[14px] text-[#2F5FD0] underline">{t("Edit")}</Link></dd>
            </div>
          ))}
        </dl>
      </section>
      <SubmitForm id={id} ready={missing.length === 0} resubmit={sub.stage === "submitted"} />
    </SubmissionFrame>
  );
}

/** Canvas SB07-Review. */
export default function Page(props: P) {
  return <Reveal fallback={<WizardSkeleton step="review" />}><Inner {...props} /></Reveal>;
}
