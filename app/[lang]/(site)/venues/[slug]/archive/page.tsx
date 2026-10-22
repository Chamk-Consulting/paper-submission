import Link from "@/components/site/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LiveHeader } from "@/components/venues/venue-live";
import { getVenue, getVenueArchive } from "@/lib/venues/data";
import { fmtRange } from "@/lib/venues/time";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { ArchiveSkeleton } from "@/components/skeletons/venuepolish";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const [data, t] = await Promise.all([getVenueArchive(slug), getT()]);
  if (!data) return { title: t("Archive") };
  return { title: `${data.archive.acr} · ${t("Archive")}`, description: t("Program, proceedings, awards and figures from {acr}.", { acr: data.archive.acr }) };
}

const h2 = "m-0 font-serif text-[30px] font-normal leading-[1.15]";
const section = "scroll-mt-20 border-t border-[#DADDE3] py-8 first:border-t-0 first:pt-2";
const kicker = "m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]";

async function Archive({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [data, t] = await Promise.all([getVenueArchive(slug), getT()]);
  if (!data) {
    // A venue that isn't over yet has no archive: send people to its live page.
    if (await getVenue(slug)) redirect(`/venues/${slug}`);
    notFound();
  }
  const { archive: a, sessions, awards } = data;
  const days = [...new Set(sessions.map((s) => s.starts_at.slice(0, 10)))].sort();
  const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);
  const num = (n: number | null) => (n == null ? "—" : n.toLocaleString(t.intl));
  const stats: [string, string, string][] = [
    [t("Papers submitted"), num(a.submitted), a.importedFrom ? t("Imported from {source}", { source: a.importedFrom }) : t("Counted by Plenary")],
    [t("Accepted"), num(a.accepted ?? (a.submitted != null && a.acceptanceRate != null ? Math.round((a.submitted * a.acceptanceRate) / 100) : null)), t("Papers in the program")],
    [t("Acceptance rate"), pct(a.acceptanceRate), t("Accepted ÷ submitted")],
    [t("Countries"), num(a.countries), t("From authors' affiliations")],
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <LiveHeader />
      <section className="bg-white">
        <div className="mx-auto max-w-[1280px] px-5 pb-7 pt-6 sm:px-8">
          <nav aria-label={t("Breadcrumb")} className="text-[13px] text-[#4A5263]">
            <Link href="/venues?view=past" className="text-[#121826] underline">{t("Past venues")}</Link> / {a.acr}
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-[2px] bg-[#EEF0EC] px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[#4A5263]">{t("Archive")}</span>
            {a.importedFrom ? <span className="rounded-[2px] bg-[#FBEFDD] px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[#7A4508]">{t("Imported from {source}", { source: a.importedFrom })}</span> : null}
          </div>
          <h1 className="mt-2.5 font-serif text-[40px] font-normal leading-[1.05] tracking-[-0.01em] sm:text-[48px]">{a.acr}</h1>
          <p className="mt-1.5 text-[19px]">{a.name}</p>
          <p className="mt-1.5 text-[15px] text-[#4A5263]">{[fmtRange(a.startsOn, a.endsOn, t.intl, t), a.where].filter(Boolean).join(" · ")}</p>
          <div id="stats" className="mt-6 grid scroll-mt-20 grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map(([label, value, note]) => (
              <div key={label} className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5">
                <p className={kicker}>{label}</p>
                <p className="m-0 mt-1 font-mono text-[28px] font-medium leading-tight">{value}</p>
                <p className="m-0 mt-0.5 text-[12px] text-[#4A5263]">{note}</p>
              </div>
            ))}
          </div>
        </div>
        <nav aria-label={t("On this page")} className="sticky top-[60px] z-10 border-y border-[#DADDE3] bg-white">
          <div className="mx-auto flex max-w-[1280px] gap-6 overflow-x-auto px-5 text-[15px] sm:px-8">
            {([["awards", "Awards"], ["program", "Program"], ["proceedings", "Proceedings"], ["stats", "Stats"]] as const).map(([id, label]) => (
              <a key={id} href={`#${id}`} className="flex-none py-3.5 text-[#4A5263] no-underline hover:text-[#121826]">{t(label)}</a>
            ))}
          </div>
        </nav>
      </section>

      <main className="mx-auto box-border w-full max-w-[1280px] flex-auto px-5 pb-16 pt-2 sm:px-8">
        <section id="awards" aria-labelledby="awards-h" className={section}>
          <h2 id="awards-h" className={h2}>{t("Awards")}</h2>
          {awards.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {awards.map((w) => (
                <div key={w.award + w.title} className="rounded-[8px] border border-[#F1D29A] bg-[#FFF8EC] px-4 py-3.5">
                  <p className="m-0 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#7A4508]">★ {t(w.award)}</p>
                  <p className="m-0 mt-1 font-semibold">{w.title}</p>
                  {w.authors ? <p className="m-0 text-[14px] text-[#4A5263]">{w.authors}</p> : null}
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-[14px] text-[#4A5263]">{t("No awards were recorded for this edition.")}</p>}
        </section>

        <section id="program" aria-labelledby="program-h" className={section}>
          <h2 id="program-h" className={h2}>{t("Program")}</h2>
          {sessions.length ? (
            <div className="mt-4 flex flex-col gap-6">
              {days.map((d) => (
                <div key={d}>
                  <h3 className="m-0 text-[17px] font-semibold">{new Date(`${d}T12:00:00Z`).toLocaleDateString(t.intl, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</h3>
                  <ul className="m-0 mt-2 list-none overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white p-0">
                    {sessions.filter((s) => s.starts_at.startsWith(d)).map((s) => (
                      <li key={s.session_id} className="border-b border-[#EEF0EC] px-4 py-3 last:border-b-0">
                        <details>
                          <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="font-mono text-[13px] text-[#4A5263]">{s.code}</span>
                            <span className="font-semibold">{s.title}</span>
                            <span className="text-[13px] text-[#4A5263]">{[s.room, t("{n} talks", { n: s.talks.length })].filter(Boolean).join(" · ")}</span>
                          </summary>
                          <ol className="m-0 mt-2 list-none p-0 text-[14px]">
                            {s.talks.map((k, i) => (
                              <li key={i} className="border-t border-[#EEF0EC] py-2">
                                <span className="font-mono text-[12px] text-[#4A5263]">{k.number ? `#${String(k.number).padStart(4, "0")} · ` : ""}</span>
                                <span className="font-medium">{k.title}</span>
                                {k.authors ? <span className="block text-[13px] text-[#4A5263]">{k.authors}</span> : null}
                              </li>
                            ))}
                          </ol>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-[14px] text-[#4A5263]">{a.importedFrom ? t("The program wasn't part of the {source} export.", { source: a.importedFrom }) : t("The program for this edition isn't available.")}</p>}
        </section>

        <section id="proceedings" aria-labelledby="proceedings-h" className={section}>
          <h2 id="proceedings-h" className={h2}>{t("Proceedings")}</h2>
          <p className="mt-1 text-[14px] text-[#4A5263]">{t("Accepted papers, in paper-number order. Full texts are in the publisher's digital library.")}</p>
          {a.papers.length ? (
            <ol className="m-0 mt-4 list-none overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white p-0">
              {a.papers.map((p, i) => (
                <li key={`${p.number ?? i}`} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-[#EEF0EC] px-4 py-3 last:border-b-0">
                  <span className="font-mono text-[13px] text-[#4A5263]">{p.number ? `#${String(p.number).padStart(4, "0")}` : "—"}</span>
                  <span className="min-w-0"><span className="block font-semibold">{p.title}</span><span className="block text-[13px] text-[#4A5263]">{[p.authors, p.type].filter(Boolean).join(" · ")}</span></span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 text-[14px] text-[#4A5263]">{t("The paper list for this edition isn't available.")}</p>}
        </section>
        <p className="mt-2 text-[12px] text-[#4A5263]">{t("Figures come from the organizers or the imported records.")} <Link href={`/venues/${a.slug}`} className="text-[#2F5FD0] underline">{t("Venue page")}</Link></p>
      </main>
    </div>
  );
}

/** Canvas PV01p: archive of a past edition (program, proceedings, awards, stats). */
export default function Page({ params }: { params: Promise<Params> }) {
  return (
    <Reveal fallback={<ArchiveSkeleton />}>
      <Archive params={params} />
    </Reveal>
  );
}
