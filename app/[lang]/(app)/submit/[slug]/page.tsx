import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StepRail, TitleBand, WizardHeader, WizardLayout } from "@/components/submission/shell";
import { TypeForm } from "@/components/submission/type-form";
import { TypeAside } from "@/components/submission/type-aside";
import { initialsOf } from "@/components/submission/frame";
import { getMe } from "@/lib/auth/me";
import { loadVenueBySlug } from "@/lib/submission/data";
import { tracksOf, typeOptions } from "@/lib/submission/options";
import { fmtMonth } from "@/lib/venues/time";
import { getT } from "@/lib/i18n/server";
import { fmtDay, getSubmissionWindow } from "@/lib/venues/window";
import { Reveal } from "@/components/motion/reveal";
import { WizardSkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("New submission") };
}
type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ type?: string }> };

async function Inner({ params, searchParams }: P) {
  const [{ slug }, { type }] = await Promise.all([params, searchParams]);
  const me = await getMe();
  if (!me) redirect(`/sign-in?next=${encodeURIComponent(`/submit/${slug}`)}`);
  if (!me.person) redirect("/create-account/profile");
  const venue = await loadVenueBySlug(slug);
  if (!venue) notFound();
  const [t, win] = await Promise.all([getT(), getSubmissionWindow(venue.id)]);
  const options = typeOptions(venue, win);
  // Same rule as the database: closed when no type is open (or, without a window, when there's no future deadline).
  const closed = win ? !win.open : !venue.deadline && venue.kind !== "journal";
  const closedOn = win && !win.open ? fmtDay(win.closedAt, t.intl) : null;
  // The pill counts down to the soonest deadline among the types still open (e.g. proposals after papers closed).
  const nextDeadline = win?.types.filter((x) => x.open && x.deadline).map((x) => x.deadline as string).sort()[0] ?? venue.deadline;
  const generatedAt = new Date().toISOString();
  const name = `${me.person.given_name} ${me.person.family_name}`;
  return (
    <WizardLayout
      header={<WizardHeader initials={initialsOf(name, me.email)} />}
      band={<TitleBand crumb={t("New submission")} title={t("New submission")} venue={{ ...venue, deadline: nextDeadline }} generatedAt={generatedAt} closedOn={closed ? (closedOn ?? "") : undefined} />}
      rail={<StepRail rail={{ done: { type: false, details: false, authors: false, keywords: false, files: false, conflicts: false, review: false }, current: "type", reachable: 1, base: "" }} />}
      aside={<TypeAside venue={venue} type={type} />}
    >
      {closed ? (
        <p role="alert" className="mb-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2.5 text-[14px] text-[#5C1A15]">
          {closedOn ? t("Submissions for {venue} closed on {date}.", { venue: venue.acr, date: closedOn }) : t("Submissions for {venue} are closed.", { venue: venue.acr })}
        </p>
      ) : null}
      <TypeForm
        venue={{ id: venue.id, acr: venue.acr, name: venue.name, slug: venue.slug, badge: venue.acr.replace(/[[\]\s]/g, "").slice(0, 5).toUpperCase(), meta: [venue.location, fmtMonth(venue.startsOn, t.intl), venue.society ? t("by {society}", { society: venue.society }) : null].filter(Boolean).join(" · ") }}
        types={options}
        tracks={tracksOf(venue)}
        initialType={options.find((o) => o.name === type)?.name}
        closed={closed}
      />
    </WizardLayout>
  );
}

/** Canvas SB01-VenueType (new draft). */
export default function Page(props: P) {
  return <Reveal fallback={<WizardSkeleton step="type" />}><Inner {...props} /></Reveal>;
}
