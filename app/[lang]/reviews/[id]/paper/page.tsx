import Link from "@/components/site/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { ReviewSkeleton } from "@/components/skeletons/review";
import { PaperViewer } from "@/components/review/paper-viewer";
import { Crumbs, NotYours, Tag } from "@/components/review/parts";
import { loadReview } from "@/lib/review/page";
import { getFiles, getNotes, signedPdfUrl } from "@/lib/review/data";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Paper viewer") };
}

async function Inner({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id, ctx, form, t, no } = await loadReview(params, "/paper");
  if (!form) return <WorkspaceShell ctx={ctx} active="reviews"><NotYours t={t} /></WorkspaceShell>;
  const a = form.assignment;
  if (!["accepted", "submitted"].includes(a.status)) redirect(`/reviews/${id}`);
  const [notes, files, sp] = await Promise.all([getNotes(id), getFiles(a.submission_id), searchParams]);
  const [pdfUrl, ...fileUrls] = await Promise.all([signedPdfUrl(form.paper.pdf_path), ...files.map((f) => signedPdfUrl(f.storage_path))]);
  const inReview = notes.filter((n) => n.in_review).length;
  const tab = sp.tab === "ask" || sp.tab === "summary" || sp.tab === "files" ? sp.tab : "notes";
  const blind = form.settings.blind_type;

  return (
    <WorkspaceShell ctx={ctx} active="reviews">
      <Crumbs items={[[t("Reviews"), "/reviews"], [no, `/reviews/${id}`], [t("Paper"), null]]} />
      <h1 className="mb-0 mt-2 font-serif text-[30px] font-normal leading-[1.2]">{form.paper.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[14px]">
        {blind === "double" ? <Tag tone="b">{t("BLIND · AUTHOR DETAILS REMOVED")}</Tag> : null}
        {form.paper.version && form.paper.version > 1 ? <Tag tone="n">{t("VERSION {n}", { n: form.paper.version })}</Tag> : null}
        <Link href={`/reviews/${id}`} className="text-[#2F5FD0] no-underline hover:underline">{t("Go to review form")}</Link>
        <span className="text-[#4A5263]">· {t("{n} notes in review", { n: inReview })}</span>
      </div>
      <PaperViewer
        assignmentId={id} submissionId={a.submission_id} pdfUrl={pdfUrl} pages={form.paper.pages} notes={notes}
        files={files.map((f, i) => ({ id: f.id, role: f.role, name: blind === "open" ? f.file_name : `${f.role}-v${f.version}.${f.file_name.split(".").pop() ?? "pdf"}`, pages: f.pages, size: f.size_bytes, url: fileUrls[i] ?? null }))}
        canEdit={a.status === "accepted" && !a.locked_at} aiPolicy={form.settings.ai_policy} initialTab={tab}
      />
    </WorkspaceShell>
  );
}

/** Canvas RV05-Viewer. */
export default function Page(props: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  return (
    <Reveal fallback={<ReviewSkeleton variant="viewer" />}>
      <Inner {...props} />
    </Reveal>
  );
}
