import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { requireEvent, groupStatus, lastChange } from "@/lib/manage/data";
import { ManagePage, SetupLayout } from "@/components/manage/chrome";
import { SubmissionsForm, type SubType } from "@/components/manage/setup1/submissions-form";
import { aoeDate, type CustomQuestion } from "@/lib/manage/setup1-shared";
import { Reveal } from "@/components/motion/reveal";
import { Setup1Skeleton } from "@/components/skeletons/setup1";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Submission types, form & PDF") };
}

const SECTIONS = ["submission_types", "submission_form", "pdf_rules"] as const;

/** EM05 — submission types, form & PDF rules. */
async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const supabase = await createClient();
  const [{ data: rows }, { data: used }] = await Promise.all([
    supabase.from("submission_types").select("id, name, description, pages, extra_pages, extra_page_fee, revision_pages, deadline_at, blind_override, enabled").eq("venue_id", ctx.venue.id).order("sort").order("name"),
    supabase.from("submissions").select("paper_type").eq("venue_id", ctx.venue.id).not("paper_type", "is", null),
  ]);
  const inUse = new Set(((used ?? []) as { paper_type: string }[]).map((u) => u.paper_type));
  const types: SubType[] = ((rows ?? []) as (Omit<SubType, "deadline" | "inUse"> & { deadline_at: string | null })[]).map(({ deadline_at, ...r }) => ({ ...r, deadline: deadline_at ? aoeDate(deadline_at) : null, inUse: inUse.has(r.name) }));
  const s = ctx.settings ?? ({} as Record<string, unknown>);
  const settings = {
    form_fields: (s.form_fields as Record<string, string>) ?? {},
    custom_questions: (s.custom_questions as CustomQuestion[]) ?? [],
    pdf_rules: (s.pdf_rules as Record<string, boolean>) ?? {},
    max_papers: (s.max_papers_per_author as number | null) ?? null,
    keyword_list: (s.keyword_list as string | null) ?? "",
  };
  return (
    <ManagePage ctx={ctx} active="setup" crumb={<>{t("Setup")} · {ctx.label}</>} title={t("Submission types, form & PDF")} sub={t("What authors can submit, what they fill in, and which PDF checks run.")}>
      <SetupLayout ctx={ctx} current="submissions">
        <SubmissionsForm slug={slug} types={types} settings={settings} status={groupStatus(ctx, [...SECTIONS])} last={lastChange(ctx, [...SECTIONS])} canEdit={ctx.isChair} locked={ctx.locked} />
      </SetupLayout>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<Setup1Skeleton rows={4} />}><Inner {...props} /></Reveal>;
}
