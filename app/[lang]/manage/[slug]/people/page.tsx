import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { requireEvent } from "@/lib/manage/data";
import { ManagePage } from "@/components/manage/chrome";
import { PeopleTable, type PersonRow } from "@/components/manage/setup2/people";
import { Reveal } from "@/components/motion/reveal";
import { TableSkeleton } from "@/components/skeletons/setup2";

type P = { params: Promise<{ slug: string }> };
type Row = { person_id: string; display_name: string; plenary_id: string | null; email: string | null; institution: string | null; roles: string[] | null; papers: number | null; reviews: number | null };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("People") };
}

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug, "organizer");
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase.rpc("venue_people", { p_venue: ctx.venue.id });
  const me = ctx.ws.me.person?.id;
  const rows: PersonRow[] = ((data ?? []) as Row[]).map((p) => ({
    id: p.person_id, name: p.display_name || p.email || "—", plenaryId: p.plenary_id, email: p.email, institution: p.institution,
    roles: p.roles ?? [], papers: Number(p.papers ?? 0), reviews: Number(p.reviews ?? 0), you: p.person_id === me,
  }));
  return (
    <ManagePage ctx={ctx} active="people" title={t("People")} sub={t("Everyone with a role or a paper at {venue}.", { venue: ctx.label })}>
      <div className="mt-[22px]">
        <PeopleTable slug={slug} label={ctx.label} rows={rows} canMessage={ctx.isOrganizer} canViewAs={ctx.isChair} />
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<TableSkeleton active="people" />}><Inner {...props} /></Reveal>;
}
