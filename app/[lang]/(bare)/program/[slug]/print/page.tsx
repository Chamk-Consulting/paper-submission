import Link from "@/components/site/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/program/my-schedule";
import { ProgramSkeleton } from "@/components/skeletons/program";
import { Reveal } from "@/components/motion/reveal";
import { loadProgram } from "@/lib/program/data";
import { KIND_STYLE, dayKey, fmtDay, fmtTime, talkStart, tzLabel } from "@/lib/program/time";
import { getT } from "@/lib/i18n/server";
import { RichTextView } from "@/components/rich-text/view";

/* PG01 "Full program (PDF)" and "Book of abstracts": a print-ready page (Print → Save as PDF). */

type Params = { slug: string };
type Search = { abstracts?: string };

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const [{ slug }, { abstracts }, t] = await Promise.all([params, searchParams, getT()]);
  const data = await loadProgram(slug);
  const name = data?.venue.shortName ?? data?.venue.name ?? "";
  return { title: abstracts ? t("Book of abstracts · {name}", { name }) : t("Full program · {name}", { name }) };
}

async function Inner({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const [{ slug }, { abstracts }, t] = await Promise.all([params, searchParams, getT()]);
  const data = await loadProgram(slug);
  if (!data) notFound();
  const { venue, sessions } = data;
  const tz = venue.timezone;
  const book = abstracts === "1";
  const days = [...new Set(sessions.map((s) => dayKey(s.startsAt, tz)))].sort();
  const acr = venue.shortName ?? venue.name;

  return (
    <div className="min-h-dvh bg-white text-[14px] leading-[1.5] text-[#121826]">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#DADDE3] bg-[#F5F6F3] px-4 py-2.5 print:hidden sm:px-8">
        <Link href={`/program/${venue.slug}`} className="text-[14px]">{t("← Back to the program")}</Link>
        <div className="flex gap-2">
          <Link href={book ? `/program/${venue.slug}/print` : `/program/${venue.slug}/print?abstracts=1`} className="inline-flex h-9 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px] text-[#121826] no-underline">{book ? t("Full program") : t("Book of abstracts")}</Link>
          <PrintButton label={t("Print or save as PDF")} className="inline-flex h-9 items-center rounded-[4px] border-0 bg-[#0E1B3D] px-3 text-[14px] font-semibold text-white" />
        </div>
      </div>
      <article className="mx-auto max-w-[860px] px-5 py-8 print:max-w-none print:p-0">
        <header className="border-b-2 border-[#0E1B3D] pb-3">
          <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{book ? t("Book of abstracts") : t("Full program")}</p>
          <h1 className="m-0 mt-1 font-serif text-[32px] font-normal leading-[1.1]">{venue.name}</h1>
          <p className="m-0 mt-1 text-[#4A5263]">{[acr, venue.location ?? venue.city, t("times are local ({tz})", { tz: tzLabel(tz, sessions[0] ? new Date(sessions[0].startsAt) : undefined) })].filter(Boolean).join(" · ")}</p>
        </header>
        {!sessions.length ? <p className="mt-6 text-[#4A5263]">{t("The program isn’t published yet")}</p> : null}
        {days.map((d) => {
          const list = sessions.filter((s) => dayKey(s.startsAt, tz) === d);
          return (
            <section key={d} className="mt-6 break-before-auto">
              <h2 className="m-0 border-b border-[#DADDE3] pb-1 font-serif text-[22px] font-normal">{fmtDay(list[0].startsAt, tz, t.intl)}</h2>
              {list.map((s) => (
                <div key={s.id} className="mt-3 break-inside-avoid">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-mono text-[13px] font-semibold">{fmtTime(s.startsAt, tz, t.intl)}–{fmtTime(s.endsAt, tz, t.intl)}</span>
                    <span className="font-mono text-[11px] uppercase text-[#4A5263]">{t((KIND_STYLE[s.kind] ?? KIND_STYLE.oral)[2])} · {s.code}</span>
                    <strong className="text-[15px]">{s.title}</strong>
                  </div>
                  <div className="text-[12px] text-[#4A5263]">{[s.room, s.chair ? t("Chair {name}", { name: s.chair }) : null, s.cochair ? t("Co-chair {name}", { name: s.cochair }) : null].filter(Boolean).join(" · ")}</div>
                  {s.talks.length ? (
                    <ol className="m-0 mt-1 list-none p-0">
                      {s.talks.map((x, i) => (
                        <li key={x.id} className="mt-1.5 flex gap-3 break-inside-avoid">
                          <span className="w-[42px] flex-none font-mono text-[12px] text-[#4A5263]">{s.kind === "poster" ? (x.number ? `#${x.number}` : "") : fmtTime(talkStart(s.startsAt, s.talks, i), tz, t.intl)}</span>
                          <div className="min-w-0">
                            <div className="font-semibold">{x.title}</div>
                            {x.authors ? <div className="text-[12px] italic text-[#4A5263]">{x.authors}</div> : null}
                            {book && x.abstract ? <RichTextView text={x.abstract} mode="abstract" className="m-0 mt-1 text-[12px] leading-[1.55]" /> : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              ))}
            </section>
          );
        })}
      </article>
    </div>
  );
}

export default function Page(props: { params: Promise<Params>; searchParams: Promise<Search> }) {
  return (
    <Reveal fallback={<ProgramSkeleton variant="list" />}>
      <Inner {...props} />
    </Reveal>
  );
}
