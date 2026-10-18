import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { TypeForm } from "@/components/submission/type-form";
import { TypeAside } from "@/components/submission/type-aside";
import { tracksOf, typeOptions } from "@/lib/submission/options";
import { fmtMonth } from "@/lib/venues/time";

export const metadata: Metadata = { title: "Venue & type" };
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "type");
  const v = ctx.venue;
  return (
    <SubmissionFrame ctx={ctx} step="type" aside={<TypeAside venue={v} type={ctx.sub.paperType} track={ctx.sub.track} />}>
      <TypeForm
        submissionId={id}
        venue={{ id: v.id, acr: v.acr, name: v.name, slug: v.slug, badge: v.acr.replace(/[[\]\s]/g, "").slice(0, 5).toUpperCase(), meta: [v.location, fmtMonth(v.startsOn), v.society ? `by ${v.society}` : null].filter(Boolean).join(" · ") }}
        types={typeOptions(v)} tracks={tracksOf(v)} initialType={ctx.sub.paperType} initialTrack={ctx.sub.track}
      />
    </SubmissionFrame>
  );
}

/** Canvas SB01-VenueType (existing draft). */
export default function Page(props: P) {
  return <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}><Inner {...props} /></Suspense>;
}
