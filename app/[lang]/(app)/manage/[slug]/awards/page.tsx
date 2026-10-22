import type { Metadata } from "next";
import { connection } from "next/server";
import { getT } from "@/lib/i18n/server";
import { requireAwardsAccess } from "@/lib/manage/orgtools-data";
import { ManagePage } from "@/components/manage/chrome";
import { AwardsBoard } from "@/components/manage/orgtools/awards-board";
import { Reveal } from "@/components/motion/reveal";
import { AwardsSkeleton } from "@/components/skeletons/orgtools";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Awards") };
}

async function Inner({ params }: P) {
  const { slug } = await params;
  await connection();
  const { ctx, board } = await requireAwardsAccess(slug);
  const t = await getT();
  return (
    <ManagePage ctx={ctx} active="awards" crumb={`${ctx.label} · ${t("After decisions")}`} title={t("Awards")}
      sub={t("Associate editors nominate, the award committee shortlists and votes, the chair announces.")} wide>
      <AwardsBoard slug={slug} board={board} />
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<AwardsSkeleton />}><Inner {...props} /></Reveal>;
}
