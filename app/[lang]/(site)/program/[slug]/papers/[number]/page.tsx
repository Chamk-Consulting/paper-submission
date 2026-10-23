import Link from "@/components/site/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { loadProgram } from "@/lib/program/data";
import { fmtDay, fmtTime } from "@/lib/program/time";
import { loadProgramPaper, type ProgramPaper } from "@/lib/attend/data";
import { PublicHeader } from "@/components/venues/public-header";
import { SaveButton } from "@/components/program/session-view";
import { CiteBox } from "@/components/attend/cite-box";
import { Reveal } from "@/components/motion/reveal";
import { PaperPageSkeleton } from "@/components/skeletons/attend";
import { RichTextView } from "@/components/rich-text/view";
import { mdToParagraph, mdToPlain, wordCount } from "@/lib/rich-text/plain";

/* Canvas PP01 — public page of one paper in a published program: abstract, when & where, slides, citation. */

type Params = { slug: string; number: string };

async function find(p: Promise<Params>) {
  const { slug, number } = await p;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1 || n > 999999) return null;
  const data = await loadProgram(slug);
  if (!data) return null;
  const paper = await loadProgramPaper(data.venue.id, n);
  return paper ? { data, paper } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const [r, t] = await Promise.all([find(params), getT()]);
  if (!r) return { title: t("Paper not found") };
  const { paper, data } = r;
  return {
    title: paper.title,
    description: mdToPlain(paper.abstract).slice(0, 200) || t("{title} at {venue}", { title: paper.title, venue: data.venue.shortName ?? data.venue.name }),
    other: { citation_title: paper.title, citation_conference_title: data.venue.name, ...(paper.authors[0] ? { citation_author: paper.authors[0].name } : {}) },
  };
}

function cite(p: ProgramPaper, venue: string, year: string): { key: string; label: string; text: string }[] {
  const names = p.authors.map((a) => a.name);
  const last = (n: string) => n.split(" ").slice(-1)[0] ?? n;
  const initials = (n: string) => n.split(" ").slice(0, -1).map((x) => `${x[0]}.`).join(" ");
  const bibAuthors = names.map((n) => `${last(n)}, ${n.split(" ").slice(0, -1).join(" ")}`.replace(/, $/, "")).join(" and ");
  const key = `${last(names[0] ?? "paper").toLowerCase().replace(/[^a-z]/g, "")}${year}${(p.title.split(" ").find((w) => w.length > 3) ?? "paper").toLowerCase().replace(/[^a-z]/g, "")}`;
  const ieeeNames = names.map((n) => `${initials(n)} ${last(n)}`.trim());
  const ieee = ieeeNames.length > 2 ? `${ieeeNames.slice(0, -1).join(", ")} and ${ieeeNames[ieeeNames.length - 1]}` : ieeeNames.join(" and ");
  const apaNames = names.map((n) => `${last(n)}, ${initials(n)}`.replace(/, $/, ""));
  const apa = apaNames.length > 1 ? `${apaNames.slice(0, -1).join(", ")}, & ${apaNames[apaNames.length - 1]}` : apaNames[0] ?? "";
  return [
    { key: "bib", label: "BibTeX", text: `@inproceedings{${key},\n  title     = {${p.title}},\n  author    = {${bibAuthors}},\n  booktitle = {Proc. ${venue}},\n  year      = {${year}}\n}` },
    { key: "ieee", label: "IEEE", text: `${ieee}, "${p.title}," in Proc. ${venue}, ${year}.` },
    { key: "apa", label: "APA", text: `${apa} (${year}). ${p.title}. In Proceedings of ${venue}.` },
  ];
}

async function Inner({ params }: { params: Promise<Params> }) {
  const [r, t] = await Promise.all([find(params), getT()]);
  if (!r) notFound();
  const { data: { venue, sessions, signedIn }, paper } = r;
  const tz = venue.timezone;
  const acr = venue.shortName ?? venue.name;
  const session = sessions.find((s) => s.id === paper.talk.session_id) ?? null;
  const year = (venue.startsOn ?? paper.talk.session_starts_at).slice(0, 4);
  const affs = [...new Set(paper.authors.map((a) => a.affiliation).filter((x): x is string => !!x))];
  const kind = t(paper.talk.kind === "poster" ? "poster" : paper.talk.kind === "keynote" ? "keynote" : "oral");
  const card = "rounded-[8px] border border-[#DADDE3] bg-white px-6 py-5";
  const kicker = "m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]";
  const end = new Date(new Date(paper.talk.starts_at).getTime() + (paper.talk.talk_min || 15) * 60000).toISOString();

  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <PublicHeader signedIn={signedIn} />
      <section className="bg-[#0E1B3D] text-[#F5F6F3]">
        <div className="mx-auto box-border max-w-[1280px] px-5 py-7 sm:px-8">
          <nav aria-label={t("Breadcrumb")} className="text-[13px] text-[#B9C3DA]">
            <Link href={`/program/${venue.slug}`} className="text-[#B9C3DA]">{acr}</Link> / <Link href={`/program/${venue.slug}/sessions/${encodeURIComponent(paper.talk.code)}`} className="text-[#B9C3DA]">{paper.talk.code} {paper.talk.session_title}</Link> / #{String(paper.number).padStart(4, "0")}
          </nav>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className="rounded-[2px] bg-[#E6EDFC] px-2 py-0.5 font-mono text-[11px] uppercase text-[#1F47A8]">{kind}{paper.paper_type ? ` · ${t(paper.paper_type)}` : ""}</span>
          </div>
          <h1 className="mt-2.5 max-w-[900px] font-serif text-[32px] font-normal leading-[1.15] sm:text-[40px]">{paper.title}</h1>
          <p className="mb-0 mt-2.5 text-[16px] text-[#F5F6F3]">
            {paper.authors.map((a, i) => <span key={i}>{i ? ", " : ""}{a.name}{a.affiliation ? <sup>{affs.indexOf(a.affiliation) + 1}</sup> : null}</span>)}
          </p>
          {affs.length ? <p className="mb-0 mt-0.5 text-[14px] text-[#B9C3DA]">{affs.map((a, i) => <span key={a}>{i ? " · " : ""}<sup>{i + 1}</sup> {a}</span>)}</p> : null}
        </div>
      </section>
      <main className="mx-auto box-border flex w-full max-w-[1280px] flex-auto flex-col gap-6 px-5 pb-14 pt-7 sm:px-8 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-col gap-[18px] lg:flex-[999_1_560px]">
          <section className={card}>
            <h2 className="m-0 text-[17px] font-semibold">{t("Abstract")}</h2>
            {paper.abstract ? <RichTextView text={paper.abstract} mode="abstract" className="mb-0 mt-2.5 max-w-[72ch] text-[16px] leading-[1.7]" /> : <p className="mb-0 mt-2.5 max-w-[72ch] whitespace-pre-line text-[16px] leading-[1.7]">{t("The abstract will appear here once the authors publish it.")}</p>}
            {paper.keywords.length ? <div className="mt-3.5 flex flex-wrap gap-1.5">{paper.keywords.map((k) => <span key={k} className="rounded-full bg-[#EEF0EC] px-2.5 py-[3px] text-[13px]">{k}</span>)}</div> : null}
          </section>
          <CiteBox formats={cite(paper, `${acr}${acr.includes(year) ? "" : ` ${year}`}`, year)} />
        </div>
        <aside className="flex w-full flex-col gap-4 lg:w-auto lg:flex-[1_1_300px]">
          <section className={card}>
            <p className={kicker}>{t("When & where")}</p>
            <p className="mb-0 mt-2 font-semibold">{fmtDay(paper.talk.starts_at, tz, t.intl)} · {fmtTime(paper.talk.starts_at, tz, t.intl)}–{fmtTime(end, tz, t.intl)}</p>
            <p className="m-0 text-[14px] text-[#4A5263]">{paper.talk.code} {paper.talk.session_title} · {paper.talk.room ?? t("Room to be announced")}</p>
            {paper.talk.presenter ? <p className="mb-0 mt-1 text-[14px]">{t("Presenter:")} <strong>{paper.talk.presenter}</strong>{paper.talk.remote ? ` (${t("remote")})` : ""}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {session ? <SaveButton session={session} all={sessions} slug={venue.slug} signedIn={signedIn} /> : null}
              <Link href={`/program/${venue.slug}/sessions/${encodeURIComponent(paper.talk.code)}`} className="inline-flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-semibold text-[#0E1B3D] no-underline">{t("Open session")}</Link>
            </div>
          </section>
          <section className={card}>
            <p className={kicker}>{t("Files")}</p>
            <div className="mt-2 flex flex-col gap-2 text-[14px]">
              <span className="text-[#4A5263]">{t("Paper PDF — on IEEE Xplore after the event")}</span>
              {paper.talk.has_slides ? <a href={`/program/${venue.slug}/papers/${paper.number}/slides`}>{t("Slides (PDF)")}</a> : <span className="text-[#4A5263]">{t("Slides not uploaded yet")}</span>}
            </div>
          </section>
          <section className={card}>
            <p className={kicker}>{t("Identifiers")}</p>
            <dl className="mb-0 mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[14px]">
              <dt className="text-[#4A5263]">{t("Paper")}</dt><dd className="m-0 font-mono">#{String(paper.number).padStart(4, "0")}</dd>
              <dt className="text-[#4A5263]">DOI</dt><dd className="m-0 font-mono">{t("[assigned at publication]")}</dd>
              <dt className="text-[#4A5263]">{t("Proceedings")}</dt><dd className="m-0">{venue.name}</dd>
            </dl>
          </section>
        </aside>
      </main>
    </div>
  );
}

export default function Page(props: { params: Promise<Params> }) {
  return <Reveal fallback={<PaperPageSkeleton />}><Inner {...props} /></Reveal>;
}
