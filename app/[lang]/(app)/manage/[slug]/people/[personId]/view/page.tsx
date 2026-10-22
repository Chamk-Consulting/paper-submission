import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { requireEvent } from "@/lib/manage/data";
import { ManagePage } from "@/components/manage/chrome";
import { ViewAs, type Snapshot } from "@/components/manage/opspolish/view-as";
import { Reveal } from "@/components/motion/reveal";
import { TableSkeleton } from "@/components/skeletons/setup2";

type P = { params: Promise<{ slug: string; personId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("View as") };
}

/** EM40 "View as" — what one person sees at this event, read-only. Chairs only (A6). */
async function Inner({ params }: P) {
  const { slug, personId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(personId)) notFound();
  const ctx = await requireEvent(slug, "chair");
  const t = await getT();
  if (ctx.ws.me.person?.id === personId) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("view_as_snapshot", { p_venue: ctx.venue.id, p_person: personId });
  if (error || !data) notFound();
  return (
    <ManagePage ctx={ctx} active="people" crumb={<>{t("People")} · {ctx.label}</>} title={t("View as")} sub={t("See the event exactly as this person does. Nothing can be changed from here.")}>
      <div className="mt-[22px]">
        <ViewAs slug={slug} label={ctx.label} snap={data as Snapshot} back={`/manage/${slug}/people`} nowIso={new Date().toISOString()} />
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<TableSkeleton active="people" />}><Inner {...props} /></Reveal>;
}
