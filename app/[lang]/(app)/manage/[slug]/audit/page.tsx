import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { requireEvent, ROLE_LABEL } from "@/lib/manage/data";
import { ManagePage } from "@/components/manage/chrome";
import { ui } from "@/components/manage/ui";
import { AuditTable, type AuditRow } from "@/components/manage/setup2/audit";
import { Reveal } from "@/components/motion/reveal";
import { TableSkeleton } from "@/components/skeletons/setup2";

type P = { params: Promise<{ slug: string }> };
type Row = { id: string; at: string; action: string; actor: string; acted_as: string | null; rule: string | null; details: Record<string, unknown> | null };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Audit log") };
}

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug, "organizer");
  const t = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("venue_audit", { p_venue: ctx.venue.id, p_limit: 1000 });
  const rows: AuditRow[] = ((data ?? []) as Row[]).map((r) => ({ id: String(r.id), at: r.at, action: r.action, actor: r.actor, actedAs: r.acted_as, rule: r.rule, details: r.details }));
  return (
    <ManagePage ctx={ctx} active="audit" title={t("Audit log")} sub={t("Every sensitive action at {venue}, with who did it and under which rule.", { venue: ctx.label })}>
      <div className="mt-[22px]">
        {!ctx.isOwner ? <p className={`${ui.warn} mb-4`}>{t("Only owners see the whole log. You see your own actions.")}</p> : null}
        {error ? <p role="alert" className={`${ui.bad} mb-4`}>{t("The audit log couldn't be loaded.")}</p> : null}
        <AuditTable slug={slug} rows={rows} roleLabels={ROLE_LABEL} />
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<TableSkeleton active="audit" />}><Inner {...props} /></Reveal>;
}
