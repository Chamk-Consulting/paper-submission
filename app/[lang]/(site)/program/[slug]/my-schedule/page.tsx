import Link from "@/components/site/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublicHeader } from "@/components/venues/public-header";
import { ProgramHero } from "@/components/program/hero";
import { MySchedule, PrintButton } from "@/components/program/my-schedule";
import { ProgramSkeleton } from "@/components/skeletons/program";
import { Reveal } from "@/components/motion/reveal";
import { loadProgram } from "@/lib/program/data";
import { getMe } from "@/lib/auth/me";
import { getT } from "@/lib/i18n/server";

/* Canvas PG03 — my schedule: saved sessions plus everything I present or chair. */

type Params = { slug: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("My schedule") };
}

async function Inner({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [data, me, t] = await Promise.all([loadProgram(slug), getMe(), getT()]);
  if (!data) notFound();
  if (!me) redirect(`/sign-in?next=${encodeURIComponent(`/program/${slug}/my-schedule`)}`);
  const { venue, sessions } = data;
  const acr = venue.shortName ?? venue.name;
  const name = me.person?.display_name ?? [me.person?.given_name, me.person?.family_name].filter(Boolean).join(" ");
  const btn = "inline-flex h-11 items-center rounded-[4px] border border-[#3A4A75] bg-transparent px-4 text-[15px] font-medium text-[#F5F6F3] no-underline";

  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <div className="print:hidden"><PublicHeader signedIn /></div>
      <ProgramHero t={t} venue={venue}
        crumbs={[[acr, `/venues/${venue.slug}`], [t("Program"), `/program/${venue.slug}`], [t("My schedule"), null]]}
        title={<><span className="mb-1 block font-mono text-[12px] tracking-[0.06em] text-[#F2A93B]">{acr.toUpperCase()}{name ? ` · ${t("SIGNED IN AS {name}", { name: name.toUpperCase() })}` : ""}</span>{t("My schedule")}</>}
        sub={t("Sessions you saved, plus everything you present or chair — those are added automatically.")}
        actions={<>
          <Link href="/settings/calendar" className={btn}>{t("Sync to calendar")}</Link>
          <PrintButton label={t("Print")} className={btn} />
        </>} />
      <main className="mx-auto box-border w-full max-w-[880px] flex-auto px-4 pb-16 pt-6 sm:px-8">
        <h1 className="m-0 mb-4 hidden font-serif text-[28px] font-normal print:block">{t("My schedule")} · {acr}</h1>
        <MySchedule sessions={sessions} slug={venue.slug} tz={venue.timezone} />
      </main>
    </div>
  );
}

export default function Page(props: { params: Promise<Params> }) {
  return (
    <Reveal fallback={<ProgramSkeleton variant="list" />}>
      <Inner {...props} />
    </Reveal>
  );
}
