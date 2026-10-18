import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/components/submission/frame";
import { asideCard, card, h2, primaryBtn } from "@/components/submission/shell";
import { FlowFrame, steps } from "@/components/submission/followup/flow-frame";
import { EditFieldsForm } from "@/components/submission/followup/edit-forms";
import { LocalDate } from "@/components/submission/followup/due-pill";
import { OpenViewer } from "@/components/submission/followup/open-viewer";
import { FIELD_LABEL, loadEditPreview, loadVersions } from "@/lib/submission/followup-data";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Edit submission") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "status");
  const t = await getT();
  const base = `/submissions/${id}`;
  if (ctx.sub.stage !== "submitted" || !ctx.editable) redirect(base);
  const [preview, versions] = await Promise.all([loadEditPreview(id), loadVersions(id)]);
  const changed = new Set(preview?.changed ?? []);
  const paper = ctx.files.find((f) => f.role === "paper" && f.current);
  const generatedAt = new Date().toISOString();
  const sections: { key: string; summary: string; href: string }[] = [
    { key: "authors", summary: ctx.authors.map((a) => a.name).join(", "), href: `${base}/authors` },
    { key: "keywords", summary: ctx.sub.keywords.map((k) => t(k)).join(", "), href: `${base}/keywords` },
    { key: "conflicts", summary: t("{n} declared", { n: ctx.conflicts.length }), href: `${base}/conflicts` },
  ];
  const flag = (k: string) => changed.has(k) ? <span className="ml-2 rounded-[3px] bg-[#FBEFDD] px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[#7A4508]">{t("Changed")}</span> : null;
  return (
    <FlowFrame
      ctx={ctx} crumb={t("Edit")} title={t("Edit submission")} due={{ at: ctx.venue.deadline, kind: "edit" }}
      flow={{ name: t("Edit"), mark: 11, steps: steps([[t("Make changes"), `${base}/edit`], [t("Review & save"), changed.size ? `${base}/edit/review` : ""], [t("Saved"), ""]], 0), note: t("Changes are kept as a draft until you save a new version.") }}
      aside={
        <>
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Changes so far")}</h3>
            {changed.size ? (
              <ul className="mb-0 mt-2 flex flex-col gap-1 pl-5 text-[15px]">{[...changed].map((k) => <li key={k}>{t(FIELD_LABEL[k] ?? k)}</li>)}</ul>
            ) : <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("No changes since version {n}.", { n: preview?.version ?? 1 })}</p>}
          </section>
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Version history")}</h3>
            <ol className="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-[14px]">
              {versions.map((v) => (
                <li key={v.no} className="flex justify-between gap-2">
                  <span><span className="font-semibold">v{v.no}</span> · {v.kind === "initial" ? t("Submitted") : v.changed.map((c) => t(FIELD_LABEL[c] ?? c)).join(", ")}</span>
                  <span className="whitespace-nowrap text-[#4A5263]"><LocalDate at={v.createdAt} generatedAt={generatedAt} /></span>
                </li>
              ))}
            </ol>
          </section>
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Who sees edits")}</h3>
            <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("Co-authors see every version. Reviewers only see the latest version after the deadline.")}</p>
          </section>
        </>
      }
    >
      <section className={card}>
        <h2 className={h2}>{t("Title and abstract")}{flag("title") ?? flag("abstract")}</h2>
        <div className="mt-4"><EditFieldsForm id={id} title={ctx.sub.title} abstract={ctx.sub.abstract ?? ""} shortTitle={ctx.sub.shortTitle ?? ""} /></div>
      </section>
      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("Other sections")}</h2>
        <ul className="m-0 mt-3 list-none p-0">
          {sections.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3 border-b border-[#EEF0EC] py-3 last:border-0">
              <span className="min-w-0"><span className="block font-semibold">{t(FIELD_LABEL[s.key])}{flag(s.key)}</span><span className="block truncate text-[14px] text-[#4A5263]">{s.summary || "—"}</span></span>
              <Link href={s.href} className="h-9 flex-none rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px] leading-9 text-[#121826] no-underline">{t("Change")}</Link>
            </li>
          ))}
        </ul>
      </section>
      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("Replace the PDF")}{flag("paper")}</h2>
        <p className="mt-1 text-[#4A5263]">{paper ? t("Current: {name} · v{v} · {n} pages", { name: paper.name, v: paper.version, n: paper.pages ?? "?" }) : t("No PDF yet.")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`${base}/files`} className="inline-flex h-10 items-center rounded-[4px] bg-[#0E1B3D] px-4 text-[15px] font-semibold text-white no-underline">{t("Upload a new PDF")}</Link>
          {paper ? <OpenViewer id={id} files={[paper]} label={t("Open in viewer")} /> : null}
        </div>
      </section>
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {changed.size
          ? <Link href={`${base}/edit/review`} className={primaryBtn}>{t("Review changes")} →</Link>
          : <span aria-disabled="true" className={`${primaryBtn} opacity-50`}>{t("Review changes")} →</span>}
      </div>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={3} cards={2} rows={3} />}><Inner {...props} /></Reveal>;
}
