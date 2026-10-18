import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/components/submission/frame";
import { asideCard, card, h2 } from "@/components/submission/shell";
import { FlowFrame, steps } from "@/components/submission/followup/flow-frame";
import { EditReviewForm } from "@/components/submission/followup/edit-forms";
import { FIELD_LABEL, loadEditPreview, type Snapshot } from "@/lib/submission/followup-data";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Review changes") };
}
type P = { params: Promise<{ id: string }> };

function show(s: Snapshot, k: string, pagesLabel: (n: number | string) => string): string {
  const v = (s as Record<string, unknown>)[k];
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (k === "paper" && typeof v === "object") { const p = v as { name: string; version: number; pages: number | null }; return `${p.name} · v${p.version} · ${pagesLabel(p.pages ?? "?")}`; }
  return String(v);
}

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "status");
  const t = await getT();
  const base = `/submissions/${id}`;
  if (ctx.sub.stage !== "submitted" || !ctx.editable) redirect(base);
  const preview = await loadEditPreview(id);
  if (!preview) redirect(base);
  const all = ["title", "short_title", "abstract", "authors", "keywords", "conflicts", "paper"];
  const unchanged = all.filter((k) => !preview.changed.includes(k));
  const pages = (n: number | string) => t("{n} pages", { n });
  return (
    <FlowFrame
      ctx={ctx} crumb={t("Edit")} title={t("Review changes")} due={{ at: ctx.venue.deadline, kind: "edit" }}
      flow={{ name: t("Edit"), mark: 12, steps: steps([[t("Make changes"), `${base}/edit`], [t("Review & save"), ""], [t("Saved"), ""]], 1), note: t("Nothing is saved until you press the button.") }}
      aside={
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{t("Who sees edits")}</h3>
          <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("Co-authors see every version. Reviewers only see the latest version after the deadline.")}</p>
        </section>
      }
    >
      <section className={card}>
        <h2 className={h2}>{t("Changes since version {n}", { n: preview.version })}</h2>
        {preview.changed.length ? (
          <div className="mt-4 flex flex-col gap-4">
            {preview.changed.map((k) => (
              <div key={k}>
                <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t(FIELD_LABEL[k] ?? k)}</p>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[6px] border border-[#F3C3BE] bg-[#FDF5F4] px-3 py-2 text-[14px]"><span className="block text-[12px] font-semibold text-[#B3261E]">{t("Before")}</span><span className="line-clamp-6 whitespace-pre-line">{show(preview.previous, k, pages)}</span></div>
                  <div className="rounded-[6px] border border-[#BFE3CF] bg-[#F1FAF5] px-3 py-2 text-[14px]"><span className="block text-[12px] font-semibold text-[#14603F]">{t("After")}</span><span className="line-clamp-6 whitespace-pre-line">{show(preview.current, k, pages)}</span></div>
                </div>
              </div>
            ))}
            <p className="m-0 text-[14px] text-[#4A5263]">{t("Not changed: {list}", { list: unchanged.map((k) => t(FIELD_LABEL[k] ?? k)).join(", ") || "—" })}</p>
          </div>
        ) : (
          <p className="mt-3 text-[#4A5263]">{t("Nothing has changed since the last version.")} <Link href={`${base}/edit`} className="text-[#2F5FD0]">{t("Back to editing")}</Link></p>
        )}
        {preview.changed.length ? <EditReviewForm id={id} next={preview.version + 1} /> : null}
      </section>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={3} rows={3} />}><Inner {...props} /></Reveal>;
}
