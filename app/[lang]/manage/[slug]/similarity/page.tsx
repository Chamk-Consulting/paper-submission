import type { Metadata } from "next";
import { connection } from "next/server";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { loadSimilarity } from "@/lib/manage/orgtools-data";
import { ManagePage } from "@/components/manage/chrome";
import { SimilarityBoard } from "@/components/manage/orgtools/similarity-board";
import { Reveal } from "@/components/motion/reveal";
import { SimilaritySkeleton } from "@/components/skeletons/orgtools";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Similarity check") };
}

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug, "ae");
  await connection();
  const t = await getT();
  const rows = await loadSimilarity(ctx.venue.id);
  const st = ctx.settings as { similarity_threshold?: number; similarity_ignore_refs?: boolean } | null;
  const providerOn = !!(process.env.SIMILARITY_API_URL && process.env.SIMILARITY_API_KEY);
  return (
    <ManagePage ctx={ctx} active="similarity" crumb={`${ctx.label} · ${t("Papers")}`} title={t("Similarity check")}
      sub={t("Every submitted PDF is compared with published work and other submissions. A high score is a reason to look, never a verdict.")} wide>
      <SimilarityBoard slug={slug} rows={rows} threshold={st?.similarity_threshold ?? 30} ignoreRefs={st?.similarity_ignore_refs ?? true}
        canEdit={ctx.isChair} providerOn={providerOn} />
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<SimilaritySkeleton />}><Inner {...props} /></Reveal>;
}
