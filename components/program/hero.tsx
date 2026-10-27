import Link from "@/components/site/link";
import type { ReactNode } from "react";
import { tzLabel } from "@/lib/program/time";
import { fmtRange } from "@/lib/venues/time";
import type { ProgramVenue, Session } from "@/lib/program/data";
import type { getT } from "@/lib/i18n/server";

type T = Awaited<ReturnType<typeof getT>>;

/** Dark band at the top of the program pages (canvas PG01–PG03). */
export function ProgramHero({ t, venue, sessions, crumbs, title, sub, actions }: {
  t: T; venue: ProgramVenue; sessions?: Session[]; crumbs: [string, string | null][]; title: ReactNode; sub?: ReactNode; actions?: ReactNode;
}) {
  const papers = sessions ? sessions.reduce((n, s) => n + s.talks.filter((x) => x.submissionId).length, 0) : 0;
  const info = sessions ? [
    venue.startsOn ? fmtRange(venue.startsOn, venue.endsOn, t.intl, t) : null,
    venue.location ?? venue.city,
    t("{p} papers in {s} sessions", { p: papers, s: sessions.length }),
    t("times are local ({city}, {tz})", { city: venue.city ?? venue.timezone.split("/").pop()!.replace(/_/g, " "), tz: tzLabel(venue.timezone, sessions[0] ? new Date(sessions[0].startsAt) : undefined) }),
  ].filter(Boolean).join(" · ") : null;
  return (
    <section className="bg-[#0E1B3D] text-[#F5F6F3] print:hidden">
      <div className="mx-auto box-border flex max-w-[1280px] flex-col gap-4 px-5 py-7 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <nav aria-label={t("Breadcrumb")} className="text-[13px] text-[#B9C3DA]">
            {crumbs.map(([label, href], i) => (
              <span key={i}>{i ? " / " : ""}{href ? <Link href={href} className="text-[#F5F6F3] underline">{label}</Link> : label}</span>
            ))}
          </nav>
          <h1 className="mt-2 font-serif text-[30px] font-normal leading-[1.1] tracking-[-0.01em] sm:text-[38px]">{title}</h1>
          {info || sub ? <p className="mt-1.5 text-[14px] text-[#B9C3DA]">{sub ?? info}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function NotPublished({ t, venue }: { t: T; venue: ProgramVenue }) {
  return (
    <div className="mx-auto box-border w-full max-w-[720px] px-5 py-16 text-center">
      <h2 className="m-0 font-serif text-[28px] font-normal">{t("The program isn’t published yet")}</h2>
      <p className="mt-2 text-[#4A5263]">{t("{name} will publish its program here once sessions are scheduled.", { name: venue.shortName ?? venue.name })}</p>
      <Link href={`/events/${venue.slug}`} className="mt-4 inline-block">{t("Back to the venue page")}</Link>
    </div>
  );
}
