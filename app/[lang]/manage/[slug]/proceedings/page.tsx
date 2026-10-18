import type { Metadata } from "next";
import { getLocale, getT } from "@/lib/i18n/server";
import { INTL } from "@/lib/i18n/config";
import { requireEvent } from "@/lib/manage/data";
import { createClient } from "@/lib/supabase/server";
import { paperNo } from "@/lib/manage/ops2-time";
import { ManagePage, ui } from "@/components/manage/chrome";
import { ArchiveForm, NoshowDecision, StepButton } from "@/components/manage/ops2/proceedings-parts";
import { Reveal } from "@/components/motion/reveal";
import { ProceedingsSkeleton } from "@/components/skeletons/ops2";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Proceedings & reports") };
}

type Author = { name: string | null; affiliation: string | null };
type Paper = { submission_id: string; number: number; title: string; locked_title: string | null; authors: Author[]; attendance: string | null; noshow_decision: string | null; noshow_note: string | null; session_code: string | null; title_matches: boolean; locked: boolean; final_status: string | null };
type Stats = {
  submissions: number; accepted: number; withdrawn_after: number; reviews: number; on_time: number | null; countries: number; registered: number; attendees: number;
  presented: number; no_shows: number; topics: { topic: string; submitted: number; accepted: number }[]; by_country: { country: string; n: number }[];
  by_ae: { ae: string; done: number; on_time: number; overdue: number }[];
};

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const [t, locale, supabase] = [await getT(), await getLocale(), await createClient()];
  const id = ctx.venue.id;
  const [{ data: papersRaw }, { data: statsRaw }, { data: exp }] = await Promise.all([
    supabase.rpc("proceedings_papers", { p_venue: id }),
    supabase.rpc("proceedings_stats", { p_venue: id }),
    supabase.from("proceedings_exports").select("steps, exported_at").eq("venue_id", id).maybeSingle(),
  ]);
  const papers = (papersRaw ?? []) as Paper[];
  const st = (statsRaw ?? { submissions: 0, accepted: 0, withdrawn_after: 0, reviews: 0, on_time: null, countries: 0, registered: 0, attendees: 0, presented: 0, no_shows: 0, topics: [], by_country: [], by_ae: [] }) as Stats;
  const steps = ((exp?.steps ?? {}) as Record<string, string>);
  const when = (k: string) => (steps[k] ? new Date(steps[k]).toLocaleDateString(INTL[locale], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: ctx.venue.timezone }) : null);
  const noShows = papers.filter((p) => p.attendance === "no_show");
  const undecided = noShows.filter((p) => !p.noshow_decision).length;
  const problems = papers.filter((p) => p.final_status !== "dropped" && (!p.locked || !p.authors.length || !p.title_matches || p.authors.some((a) => !a.affiliation)));
  const kept = papers.filter((p) => p.final_status !== "dropped" && (p.attendance === "presented" || (p.attendance === "no_show" && p.noshow_decision === "keep")));
  const canEdit = ctx.roles.some((r) => ["owner", "chair", "program_chair", "publication_chair"].includes(r));
  const archived = ctx.venue.status === "archived";
  const maxTopic = Math.max(1, ...st.topics.map((x) => x.submitted));
  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

  const STEPS = [
    { key: "confirmed", n: 1, title: t("Confirm presented papers"), sub: t("{p} presented · {n} no-shows · {w} withdrawn after acceptance", { p: st.presented, n: st.no_shows, w: st.withdrawn_after }), cta: t("Confirm") },
    { key: "noshows", n: 2, title: t("Decide on no-shows"), sub: undecided ? t("{n} still to decide — keep with an exception, or leave out of Xplore (H6)", { n: undecided }) : t("Keep with an exception, or leave out of Xplore (H6)"), cta: t("Continue") },
    { key: "metadata", n: 3, title: t("Check metadata"), sub: problems.length ? t("{n} paper(s) need attention: titles, authors and affiliations must match the locked versions (G2)", { n: problems.length }) : t("Titles, authors and affiliations match the locked versions (G2)"), cta: t("Run checks") },
    { key: "exported", n: 4, title: t("Export to IEEE Xplore"), sub: t("XML + PDFs to the IEEE Conference Publishing portal · {n} papers", { n: kept.length }), cta: t("Mark as uploaded") },
  ];

  return (
    <ManagePage ctx={ctx} active="proceedings" title={t("Proceedings & reports")} sub={t("Close the event: no-shows, IEEE Xplore export, statistics and archive.")}>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {STEPS.map((s, i) => {
              const done = when(s.key);
              const prevDone = i === 0 || !!steps[STEPS[i - 1].key];
              return (
                <li key={s.key} className={`${ui.card} flex flex-wrap items-center gap-4 p-4! ${prevDone ? "" : "opacity-60"}`}>
                  <span className={`flex size-8 flex-none items-center justify-center rounded-full font-mono text-[13px] ${done ? "bg-[#18744F] text-white" : "bg-[#EEF0EC] text-[#4A5263]"}`}>{done ? "✓" : s.n}</span>
                  <div className="min-w-0 flex-auto">
                    <p className="m-0 font-medium">{s.title}</p>
                    <p className="m-0 text-[13px] text-[#4A5263]">{s.sub}</p>
                    {done ? <p className="m-0 font-mono text-[11px] text-[#14603F]">{t("done {when}", { when: done })}</p> : null}
                    {s.key === "exported" && prevDone ? <a href={`/api/manage/${slug}/proceedings`} className="mt-1 inline-block text-[13px]" download>{t("Download Xplore XML ({n} papers)", { n: kept.length })}</a> : null}
                  </div>
                  {canEdit && !archived ? <StepButton slug={slug} step={s.key} label={s.cta} done={done} disabled={!prevDone} /> : null}
                </li>
              );
            })}
          </ol>

          {noShows.length ? (
            <section className={ui.card}>
              <h2 className={ui.h2}>{t("No-show decisions")}</h2>
              <ul className="m-0 mt-3 flex list-none flex-col p-0">
                {noShows.map((p) => (
                  <li key={p.submission_id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0EC] py-3 last:border-0">
                    <div className="min-w-0"><p className="m-0 text-[14px]"><span className="font-mono text-[12px]">{paperNo(p.number)}</span> {p.locked_title ?? p.title}</p><p className="m-0 text-[12px] text-[#4A5263]">{p.session_code}{p.noshow_note ? ` · ${p.noshow_note}` : ""}</p></div>
                    {canEdit && !archived ? <NoshowDecision slug={slug} submission={p.submission_id} decision={p.noshow_decision} /> : <span className={ui.hint}>{p.noshow_decision ? t(p.noshow_decision === "keep" ? "Exception — keep" : "Leave out") : t("Undecided")}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {problems.length ? (
            <section className={ui.card}>
              <h2 className={ui.h2}>{t("Metadata to fix")}</h2>
              <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0 text-[13px]">
                {problems.slice(0, 30).map((p) => (
                  <li key={p.submission_id}><span className="font-mono text-[12px]">{paperNo(p.number)}</span> {p.locked_title ?? p.title} — <span className="text-[#8C1D18]">{[!p.locked && t("not locked"), !p.authors.length && t("no authors"), !p.title_matches && t("title differs from the locked version"), p.authors.some((a) => !a.affiliation) && t("missing affiliation")].filter(Boolean).join(", ")}</span></li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={ui.card}>
            <h2 className={ui.h2}>{t("Acceptance by topic")}</h2>
            {st.topics.length === 0 ? <p className={`${ui.hint} mt-3`}>{t("No submissions yet.")}</p> : (
              <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
                {st.topics.map((x) => (
                  <li key={x.topic} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3 text-[13px]">
                    <span className="truncate">{x.topic}</span>
                    <span className="relative h-3 rounded-full bg-[#EEF0EC]"><span className="absolute inset-y-0 left-0 rounded-full bg-[#B7BDC9]" style={{ width: `${pct(x.submitted, maxTopic)}%` }} /><span className="absolute inset-y-0 left-0 rounded-full bg-[#0E1B3D]" style={{ width: `${pct(x.accepted, maxTopic)}%` }} /></span>
                    <span className="font-mono text-[12px] text-[#4A5263]">{x.accepted}/{x.submitted} · {pct(x.accepted, x.submitted)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className={ui.card}>
            <h2 className={ui.h2}>{t("{name} in numbers", { name: ctx.label })}</h2>
            <dl className="m-0 mt-3 grid grid-cols-2 gap-3">
              {[[t("Submissions"), st.submissions], [t("Accepted"), `${st.accepted} · ${pct(st.accepted, st.submissions)}%`], [t("Reviews"), st.reviews], [t("Reviews on time"), st.on_time === null ? "—" : `${st.on_time}%`], [t("Countries"), st.countries], [t("Attendees"), `${st.attendees}/${st.registered}`]].map(([k, v]) => (
                <div key={String(k)} className="rounded-[6px] bg-[#F7F8F6] p-2.5"><dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#4A5263]">{k}</dt><dd className="m-0 font-serif text-[22px]">{v}</dd></div>
              ))}
            </dl>
          </section>
          <section className={ui.card}>
            <h2 className={ui.h2}>{t("Reports")}</h2>
            <details className="mt-3"><summary className="cursor-pointer text-[14px]">{t("Reviewer timeliness by AE")}</summary>
              <table className={`${ui.table} mt-2 text-[12px]`}><thead><tr><th className={ui.th}>{t("AE")}</th><th className={ui.th}>{t("Done")}</th><th className={ui.th}>{t("On time")}</th><th className={ui.th}>{t("Overdue")}</th></tr></thead>
                <tbody>{st.by_ae.length ? st.by_ae.map((a) => <tr key={a.ae}><td className={ui.td}>{a.ae}</td><td className={ui.td}>{a.done}</td><td className={ui.td}>{a.on_time}</td><td className={ui.td}>{a.overdue}</td></tr>) : <tr><td colSpan={4} className={ui.td}>—</td></tr>}</tbody></table>
            </details>
            <details className="mt-2"><summary className="cursor-pointer text-[14px]">{t("Submissions by country")}</summary>
              <ul className="m-0 mt-2 list-none p-0 text-[12px]">{st.by_country.length ? st.by_country.map((c) => <li key={c.country} className="flex justify-between border-b border-[#EEF0EC] py-1"><span>{c.country}</span><span className="font-mono">{c.n}</span></li>) : <li>—</li>}</ul>
            </details>
            <p className="m-0 mt-2 text-[14px] text-[#4A5263]">{t("Finance summary")} · <span className="text-[12px]">{t("comes from your registration system")}</span></p>
            <p className="m-0 mt-1 text-[14px] text-[#4A5263]">{t("Diversity (opt-in, groups ≥10, J5)")} · <span className="text-[12px]">{t("not enough opt-in data yet")}</span></p>
          </section>
          <section className={ui.card}>
            <h2 className={ui.h2}>{t("Archive")}</h2>
            <p className={`${ui.hint} mb-3 mt-2`}>{t("Archiving locks the event read-only. Records are kept 7 years (J1). Next year’s event can copy its settings (K1).")}</p>
            <ArchiveForm slug={slug} archived={archived} canArchive={ctx.isOwner || ctx.roles.includes("chair")} />
          </section>
        </aside>
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<ProceedingsSkeleton />}><Inner {...props} /></Reveal>;
}
