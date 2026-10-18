import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { TypeForm } from "@/components/submission/type-form";
import { TypeAside } from "@/components/submission/type-aside";
import { tracksOf, typeOptions } from "@/lib/submission/options";
import { fmtMonth } from "@/lib/venues/time";
import { Reveal } from "@/components/motion/reveal";
import { WizardSkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Venue & type") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "type");
  const v = ctx.venue;
  const t = await getT();
  return (
    <SubmissionFrame ctx={ctx} step="type" aside={<TypeAside venue={v} type={ctx.sub.paperType} track={ctx.sub.track} />}>
      <TypeForm
        submissionId={id}
        venue={{ id: v.id, acr: v.acr, name: v.name, slug: v.slug, badge: v.acr.replace(/[[\]\s]/g, "").slice(0, 5).toUpperCase(), meta: [v.location, fmtMonth(v.startsOn, t.intl), v.society ? t("by {society}", { society: v.society }) : null].filter(Boolean).join(" · ") }}
        types={typeOptions(v)} tracks={tracksOf(v)} initialType={ctx.sub.paperType} initialTrack={ctx.sub.track}
      />
    </SubmissionFrame>
  );
}

/** Canvas SB01-VenueType (existing draft). */
export default function Page(props: P) {
  return <Reveal fallback={<WizardSkeleton step="type" />}><Inner {...props} /></Reveal>;
}
