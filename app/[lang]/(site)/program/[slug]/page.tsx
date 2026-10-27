import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/venues/public-header";
import { ProgramBoard } from "@/components/program/program-board";
import { NotPublished, ProgramHero } from "@/components/program/hero";
import { ProgramSkeleton } from "@/components/skeletons/program";
import { Reveal } from "@/components/motion/reveal";
import { loadProgram } from "@/lib/program/data";
import { getT } from "@/lib/i18n/server";

/* Canvas PG01 — public program (and M07 at phone width). */

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const [data, t] = await Promise.all([loadProgram(slug), getT()]);
  if (!data) return { title: t("Program not found") };
  return { title: t("Program · {name}", { name: data.venue.shortName ?? data.venue.name }), description: t("Sessions, rooms and times for {name}.", { name: data.venue.name }) };
}

async function Inner({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [data, t] = await Promise.all([loadProgram(slug), getT()]);
  if (!data) notFound();
  const { venue, sessions, signedIn } = data;
  const acr = venue.shortName ?? venue.name;
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <PublicHeader signedIn={signedIn} />
      <ProgramHero t={t} venue={venue} sessions={sessions}
        crumbs={[[t("Venues"), "/events"], [acr, `/events/${venue.slug}`], [t("Program"), null]]}
        title={t("Program · {name}", { name: acr })} />
      <main className="mx-auto box-border w-full max-w-[1280px] flex-auto px-4 pb-16 pt-5 sm:px-8">
        {sessions.length ? <ProgramBoard venue={venue} sessions={sessions} signedIn={signedIn} generatedAt={new Date().toISOString()} /> : <NotPublished t={t} venue={venue} />}
      </main>
    </div>
  );
}

export default function Page(props: { params: Promise<Params> }) {
  return (
    <Reveal fallback={<ProgramSkeleton />}>
      <Inner {...props} />
    </Reveal>
  );
}
