import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { StepRail, TitleBand, WizardHeader, WizardLayout } from "@/components/submission/shell";
import { TypeForm } from "@/components/submission/type-form";
import { TypeAside } from "@/components/submission/type-aside";
import { initialsOf } from "@/components/submission/frame";
import { getMe } from "@/lib/auth/me";
import { loadVenueBySlug } from "@/lib/submission/data";
import { tracksOf, typeOptions } from "@/lib/submission/options";
import { fmtMonth } from "@/lib/venues/time";

export const metadata: Metadata = { title: "New submission" };
type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ type?: string }> };

async function Inner({ params, searchParams }: P) {
  const [{ slug }, { type }] = await Promise.all([params, searchParams]);
  const me = await getMe();
  if (!me) redirect(`/sign-in?next=${encodeURIComponent(`/submit/${slug}`)}`);
  if (!me.person) redirect("/create-account/profile");
  const venue = await loadVenueBySlug(slug);
  if (!venue) notFound();
  const options = typeOptions(venue);
  const generatedAt = new Date().toISOString();
  const name = `${me.person.given_name} ${me.person.family_name}`;
  return (
    <WizardLayout
      header={<WizardHeader initials={initialsOf(name, me.email)} />}
      band={<TitleBand crumb="New submission" title="New submission" venue={venue} generatedAt={generatedAt} />}
      rail={<StepRail rail={{ done: { type: false, details: false, authors: false, keywords: false, files: false, conflicts: false, review: false }, current: "type", reachable: 1, base: "" }} />}
      aside={<TypeAside venue={venue} type={type} />}
    >
      {!venue.deadline && venue.kind !== "journal" ? (
        <p role="alert" className="mb-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2.5 text-[14px] text-[#5C1A15]">Submissions for {venue.acr} are closed.</p>
      ) : null}
      <TypeForm
        venue={{ id: venue.id, acr: venue.acr, name: venue.name, slug: venue.slug, badge: venue.acr.replace(/[[\]\s]/g, "").slice(0, 5).toUpperCase(), meta: [venue.location, fmtMonth(venue.startsOn), venue.society ? `by ${venue.society}` : null].filter(Boolean).join(" · ") }}
        types={options}
        tracks={tracksOf(venue)}
        initialType={options.find((o) => o.name === type)?.name}
      />
    </WizardLayout>
  );
}

/** Canvas SB01-VenueType (new draft). */
export default function Page(props: P) {
  return <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}><Inner {...props} /></Suspense>;
}
