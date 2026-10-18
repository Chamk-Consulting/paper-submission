import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PublicFooter } from "@/components/venues/public-header";
import { CountdownCard, DatesList, FollowButton, LiveHeader, StatusCard } from "@/components/venues/venue-live";
import { getVenue } from "@/lib/venues/data";
import { FIELD_COLOR, FIELD_LABEL, FORMAT_LABEL } from "@/lib/venues/types";
import { fmtRange } from "@/lib/venues/time";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getVenue(slug);
  if (!data) return { title: "Venue not found" };
  return { title: data.venue.acr, description: `${data.venue.name} — call for papers, deadlines and how to submit.` };
}

const h2 = "m-0 font-serif text-[30px] font-normal leading-[1.15]";
const section = "scroll-mt-20 border-t border-[#DADDE3] py-8 first:border-t-0 first:pt-2";

async function Venue({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const data = await getVenue(slug);
  if (!data) notFound();
  const { venue: v, details, website } = data;
  const generatedAt = new Date().toISOString();
  const [fbg, fink] = v.field ? FIELD_COLOR[v.field] : ["#E6EDFC", "#1F47A8"];
  const tags = [v.field ? (v.field === "ocean" ? "Ocean" : v.field) : null, v.format ? FORMAT_LABEL[v.format] : null, v.reviewMode, v.indexedIn.length ? v.indexedIn.join(" · ") : null].filter(Boolean) as string[];
  const where = v.kind === "journal" ? "Online journal" : [v.location ?? [v.city, v.country].filter(Boolean).join(", ")].filter(Boolean).join("");
  const topics = details.topics ?? [];
  const types = details.types ?? [];
  const policies = details.policies ?? [];
  const organizers = details.organizers ?? [];
  const nav: [string, string][] = [["cfp", "Call for papers"], ["dates", "Dates"], ["types", "How to submit"], ["policies", "Policies"], ["publication", "Publication"], ["program", "Program"], ["organizers", "Organizers"]];

  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <LiveHeader />
      <section className="bg-white">
        <div className="mx-auto max-w-[1280px] px-5 pb-7 pt-6 sm:px-8">
          <nav aria-label="Breadcrumb" className="text-[13px] text-[#4A5263]">
            <Link href="/venues" className="text-[#121826] underline">Venues</Link>
            {v.field ? <> / <Link href="/venues" className="text-[#121826] underline">{FIELD_LABEL[v.field]}</Link></> : null} / {v.acr}
          </nav>
          <div className="mt-4 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-5">
              <span aria-hidden className="hidden size-[76px] flex-none items-center justify-center rounded-[8px] px-1 text-center font-mono text-[13px] font-semibold leading-[1.15] sm:flex" style={{ background: fbg, color: fink }}>{v.society ?? v.acr.slice(0, 6)}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t, i) => <span key={t} className="rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em]" style={i === 0 && v.field ? { background: fbg, color: fink } : { background: "#EEF0EC", color: "#4A5263" }}>{t}</span>)}
                </div>
                <h1 className="mt-2.5 font-serif text-[40px] font-normal leading-[1.05] tracking-[-0.01em] sm:text-[48px]">{v.acr}</h1>
                <p className="mt-1.5 text-[19px]">{v.name}</p>
                <p className="mt-1.5 text-[15px] text-[#4A5263]">{[fmtRange(v.startsOn, v.endsOn), where, v.society ? `Sponsored by ${v.society}` : null].filter(Boolean).join(" · ")}</p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Link href={`/submit/${v.slug}`} className="inline-flex h-11 items-center rounded-[4px] bg-[#F2A93B] px-5 text-[15px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">Submit a paper</Link>
                  <FollowButton venueId={v.id} slug={v.slug} />
                  <a href={`/venues/${v.slug}/calendar.ics`} className="inline-flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[15px] font-medium text-[#121826] no-underline">Add deadlines to calendar</a>
                </div>
              </div>
            </div>
            <CountdownCard dates={v.dates} generatedAt={generatedAt} />
          </div>
        </div>
        <nav aria-label="On this page" className="sticky top-0 z-10 border-y border-[#DADDE3] bg-white">
          <div className="mx-auto flex max-w-[1280px] gap-6 overflow-x-auto px-5 text-[15px] sm:px-8">
            {nav.map(([id, label]) => <a key={id} href={`#${id}`} className="flex-none py-3.5 text-[#4A5263] no-underline hover:text-[#121826]">{label}</a>)}
          </div>
        </nav>
      </section>

      <div className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-10 px-5 pb-16 pt-2 sm:px-8 lg:flex-row lg:items-start">
        <main className="min-w-0 flex-auto">
          <section id="cfp" aria-labelledby="cfp-h" className={section}>
            <h2 id="cfp-h" className={h2}>Call for papers</h2>
            <p className="mt-3 max-w-[68ch] text-[17px]">{details.cfp ?? `${v.acr} — the organizers haven't published the call text yet.`}</p>
            {topics.length ? <div className="mt-4 flex flex-wrap gap-2">{topics.map((t) => <span key={t} className="rounded-full border border-[#DADDE3] bg-white px-3 py-1.5 text-[14px]">{t}</span>)}</div> : null}
            {v.accepting ? <p className="mt-4 text-[14px] text-[#4A5263]">Accepting: {v.accepting}</p> : null}
          </section>

          <section id="dates" aria-labelledby="dates-h" className={section}>
            <h2 id="dates-h" className={h2}>Important dates</h2>
            <DatesList dates={v.dates} generatedAt={generatedAt} />
          </section>

          <section id="types" aria-labelledby="types-h" className={section}>
            <h2 id="types-h" className={h2}>How to submit</h2>
            <p className="mt-1 text-[14px] text-[#4A5263]">Pick a type — you can change it until you submit.</p>
            {types.length ? (
              <div className="relative mt-4 overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
                <table className="w-full min-w-[600px] border-collapse text-[14px]">
                  <thead><tr className="border-b border-[#DADDE3] text-left font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]"><th className="px-4 py-2.5 font-medium">Type</th><th className="px-4 py-2.5 font-medium">Length</th><th className="px-4 py-2.5 font-medium">Review</th><th className="px-4 py-2.5 font-medium"><span className="sr-only">Action</span></th></tr></thead>
                  <tbody>
                    {types.map((t) => (
                      <tr key={t.name} className="border-b border-[#EEF0EC] last:border-b-0">
                        <td className="px-4 py-3"><strong>{t.name}</strong>{t.note ? <div className="text-[13px] text-[#4A5263]">{t.note}</div> : null}</td>
                        <td className="px-4 py-3">{t.length ?? "—"}</td>
                        <td className="px-4 py-3">{t.review ?? "—"}</td>
                        <td className="px-4 py-3 text-right"><Link href={`/submit/${v.slug}?type=${encodeURIComponent(t.name)}`} className="font-semibold text-[#2F5FD0]">{/workshop|proposal/i.test(t.name) ? "Propose →" : "Submit →"}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-4 text-[14px] text-[#4A5263]">Submission types will be listed here when the call opens.</p>}
            <p className="mt-4 text-[14px] text-[#4A5263]"><strong className="text-[#121826]">No separate PDF test.</strong> Your PDF is checked for fonts, page size, margins and names when you upload it, with the page number of any problem.</p>
          </section>

          <section id="policies" aria-labelledby="policies-h" className={section}>
            <h2 id="policies-h" className={h2}>Policies</h2>
            <p className="mt-1 text-[14px] text-[#4A5263]">Read these before you submit. Each one is shown again at the step where it applies.</p>
            {policies.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {policies.map((p) => (
                  <div key={p.title} className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5">
                    <div className="flex items-center gap-2 font-semibold">{p.title}{p.tag ? <span className="rounded-[2px] bg-[#FBEFDD] px-1.5 py-px font-mono text-[10px] text-[#7A4508]">{p.tag}</span> : null}</div>
                    <div className="mt-1 text-[14px] text-[#4A5263]">{p.text}</div>
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 text-[14px] text-[#4A5263]">Policies will be published with the call.</p>}
          </section>

          <section id="publication" aria-labelledby="publication-h" className={section}>
            <h2 id="publication-h" className={h2}>Publication</h2>
            <dl className="m-0 mt-4 grid grid-cols-1 gap-x-6 gap-y-2 rounded-[8px] border border-[#DADDE3] bg-white px-4 py-4 text-[14px] sm:grid-cols-[160px_1fr]">
              <dt className="text-[#4A5263]">Proceedings</dt><dd className="m-0">{details.publication?.proceedings ?? "To be announced"}</dd>
              <dt className="text-[#4A5263]">Indexed in</dt><dd className="m-0">{v.indexedIn.length ? v.indexedIn.join(", ") : "—"}</dd>
              <dt className="text-[#4A5263]">Copyright</dt><dd className="m-0">{details.publication?.copyright ?? "Signed from your paper page after acceptance."}</dd>
              {details.publication?.journal ? <><dt className="text-[#4A5263]">Journal option</dt><dd className="m-0">{details.publication.journal}</dd></> : null}
            </dl>
          </section>

          {/* TODO(venue): Attending (fees, visas, grants), Venue & travel map and Gallery sections from canvas PV02. */}

          <section id="program" aria-labelledby="program-h" className={section}>
            <h2 id="program-h" className={h2}>Program</h2>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-[#DADDE3] bg-white px-4 py-4">
              <div><div className="font-semibold">The program is published after acceptance.</div><div className="text-[14px] text-[#4A5263]">Then you can browse sessions and build My agenda.</div></div>
              <FollowButton venueId={v.id} slug={v.slug} />
            </div>
          </section>

          <section id="organizers" aria-labelledby="organizers-h" className={section}>
            <h2 id="organizers-h" className={h2}>Organizers</h2>
            {organizers.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {organizers.map((o) => (
                  <div key={o.role + o.name} className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5">
                    <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{o.role}</div>
                    <div className="mt-1 font-semibold">{o.name}</div>
                    {o.org ? <div className="text-[13px] text-[#4A5263]">{o.org}</div> : null}
                    {o.topic ? <div className="mt-1.5 text-[13px] text-[#4A5263]">{o.topic}</div> : null}
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 text-[14px] text-[#4A5263]">Organizers will be listed here.</p>}
          </section>
          <p className="mt-2 text-[12px] text-[#4A5263]">Venue content is provided by its organizers.</p>
        </main>

        <aside className="flex w-full flex-col gap-4 pt-8 lg:w-[320px] lg:flex-none">
          <StatusCard acr={v.acr} slug={v.slug} />
          <section aria-labelledby="ag-h" className="rounded-[8px] border border-[#DADDE3] bg-white p-[18px]">
            <h2 id="ag-h" className="m-0 text-[17px] font-semibold">At a glance</h2>
            <dl className="m-0 mt-3 grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-[14px]">
              <dt className="text-[#4A5263]">Review</dt><dd className="m-0">{v.reviewMode ?? "—"}</dd>
              {v.acceptanceRate != null ? <><dt className="text-[#4A5263]">Accepted</dt><dd className="m-0">{Math.round(v.acceptanceRate)}%{v.papersCount ? ` of ${v.papersCount.toLocaleString("en-US")}` : ""}</dd></> : null}
              <dt className="text-[#4A5263]">Proceedings</dt><dd className="m-0">{v.indexedIn.length ? v.indexedIn.join(", ") : "—"}</dd>
              <dt className="text-[#4A5263]">Format</dt><dd className="m-0">{v.format ? FORMAT_LABEL[v.format] : "—"}</dd>
              <dt className="text-[#4A5263]">Pages</dt><dd className="m-0">{v.pageLimit ?? "—"}</dd>
              {website ? <><dt className="text-[#4A5263]">Website</dt><dd className="m-0 truncate"><a href={website} rel="noopener noreferrer" target="_blank" className="text-[#2F5FD0] underline">{website.replace(/^https:\/\//, "")}</a></dd></> : null}
            </dl>
          </section>
          <section aria-labelledby="q-h" className="rounded-[8px] border border-[#DADDE3] bg-white p-[18px]">
            <h2 id="q-h" className="m-0 text-[17px] font-semibold">Questions?</h2>
            <p className="mt-1.5 text-[14px] text-[#4A5263]">Message the right chair. Replies arrive in your Plenary inbox and by email.</p>
            {/* TODO(inbox): contact-organizers form (IN01). */}
            <span title="Coming soon" className="mt-3 flex h-10 items-center justify-center rounded-[4px] border border-[#DADDE3] text-[14px] font-medium text-[#9AA3B5]">Contact organizers</span>
            <p className="mt-2.5 text-[13px]"><Link href="/account-help" className="text-[#2F5FD0] underline">Technical problem? Plenary support</Link></p>
          </section>
        </aside>
      </div>
      <PublicFooter />
    </div>
  );
}

/** Canvas PV02-Venue. */
export default function Page({ params }: { params: Promise<Params> }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}>
      <Venue params={params} />
    </Suspense>
  );
}
