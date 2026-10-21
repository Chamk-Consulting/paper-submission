import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requireEvent, SETUP_GROUPS, groupStatus } from "@/lib/manage/data";
import { ManagePage } from "@/components/manage/chrome";
import { ui } from "@/components/manage/ui";
import { KpiRow, Tag, type Kpi } from "@/components/manage/ops1/kit";
import { Reveal } from "@/components/motion/reveal";
import { OpsDashboardSkeleton } from "@/components/skeletons/ops1";
import { loadDashCounts, loadExtensions, loadGoLive, loadMilestones, loadPapers, loadSlots, type Milestone } from "@/lib/manage/ops1-data";
import { countdown, fmtAoE, fmtRange, DAY } from "@/lib/venues/time";
import { DECISION_LABEL } from "@/lib/manage/ops1-shared";

/* EM20 — event dashboard: phase stepper, KPIs and alerts for the current phase, next deadline, B2 notice. */

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Event dashboard") };
}

type Phase = { key: string; label: string; end: string | null };
const PHASES: [string, string, string[]][] = [
  ["setup", "Setup", ["submissions_open"]], ["subs", "Submissions", ["paper_deadline", "submission_deadline"]], ["assign", "Assignment", ["reviewer_assignment", "ae_assignment"]],
  ["review", "Reviewing", ["reviews_due"]], ["dec", "Decisions", ["decisions"]], ["final", "Final versions", ["finals", "final_versions"]], ["prog", "Program", ["program", "registration"]],
  ["event", "Event", ["conference"]], ["proc", "Proceedings", ["proceedings"]],
];

function phasesOf(ms: Milestone[], endsOn: string | null): Phase[] {
  return PHASES.map(([key, label, keys]) => {
    const m = keys.map((k) => ms.find((x) => x.key === k)).find(Boolean);
    let end = m?.at ?? null;
    if (key === "event") end = endsOn ? `${endsOn}T23:59:59Z` : end;
    return { key, label, end };
  });
}

function currentPhase(phases: Phase[], status: string, now: number): number {
  if (status === "draft" || status === "setup") return 0;
  for (let i = 0; i < phases.length; i++) if (phases[i].end && Date.parse(phases[i].end!) > now) return i;
  return phases.length - 1;
}

const nowMs = () => Date.now();
const fmtShort = (iso: string, intl: string) => new Date(iso).toLocaleDateString(intl, { day: "numeric", month: "short", timeZone: "UTC" });

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const v = ctx.venue;
  const now = nowMs();
  const [ms, counts, papers, goLive, slots, ext] = await Promise.all([
    loadMilestones(v.id), loadDashCounts(v.id), loadPapers(v.id), loadGoLive(v.id), loadSlots(v.id), loadExtensions(v.id),
  ]);
  const phases = phasesOf(ms, v.ends_on);
  const cur = currentPhase(phases, v.status, now);
  const ph = phases[cur].key;
  const base = `/manage/${slug}`;
  const n = (x: number) => x.toLocaleString(t.intl);

  let kpis: Kpi[] = [];
  let alerts: { tag: string; bg: string; ink: string; t: string; d: string; cta: string; h: string }[] = [];
  let chart: { title: string; note: string; bars: { t: string; v: number; label: string }[] } = { title: "", note: "", bars: [] };

  if (ph === "setup") {
    const ready = ctx.sections.filter((s) => s.status === "ready").length;
    const opens = phases[0].end;
    const deputy = goLive.find((g) => g.key === "deputy");
    kpis = [
      { l: t("Setup sections ready"), v: `${ready} / ${ctx.sections.length || SETUP_GROUPS.length}`, s: t("Required before opening"), c: ready === ctx.sections.length ? "#14603F" : "#A8600F" },
      { l: t("Committee"), v: `${counts.committeeAccepted} / ${counts.committeeTotal}`, s: t("Accepted invitations") },
      { l: t("Deputy chair"), v: deputy?.ok ? t("Named") : t("Not named"), s: t("For chairs’ own papers (B2)"), c: deputy?.ok ? "#14603F" : "#B3261E" },
      { l: t("Opens"), v: opens ? fmtShort(opens, t.intl) : "—", s: opens ? t("In {n} days", { n: Math.max(0, Math.ceil((Date.parse(opens) - now) / DAY)) }) : t("No date yet") },
    ];
    const SETUP_LINK: Record<string, string> = { basics: "/setup/basics", dates: "/setup/dates", submission_types: "/setup/submission-types", review: "/setup/review", deputy: "/setup/committee", committee: "/setup/committee", emails: "/setup/emails", sections: "/setup" };
    alerts = goLive.filter((g) => !g.ok).slice(0, 5).map((g) => ({ tag: g.key === "committee" || g.key === "deputy" ? t("COMMITTEE") : g.key === "emails" ? t("EMAILS") : t("SETUP"), bg: "#FBEFDD", ink: "#7A4508", t: t(g.note), d: t("Needed before submissions open"), cta: t("Fix"), h: `${base}${SETUP_LINK[g.key] ?? "/setup"}` }));
    const pending = counts.committeeTotal - counts.committeeAccepted;
    if (pending > 0) alerts.push({ tag: t("COMMITTEE"), bg: "#E6EDFC", ink: "#1F47A8", t: t("{n} committee members haven’t replied", { n: pending }), d: t("Invitations are still open"), cta: t("Remind"), h: `${base}/setup/committee` });
    if (!goLive.some((g) => !g.ok)) alerts.push({ tag: t("GO-LIVE"), bg: "#EEF0EC", ink: "#4A5263", t: t("Go-live review"), d: t("Run a test submission before opening"), cta: t("Review"), h: `${base}/setup/go-live` });
    chart = { title: t("Setup progress by section"), note: "%", bars: SETUP_GROUPS.map((g) => { const st = groupStatus(ctx, g.sections); const val = st === "ready" ? 100 : st === "in_progress" ? 50 : 0; return { t: t(g.label), v: val, label: `${val}%` }; }) };
  } else if (ph === "subs" || ph === "assign") {
    const unassigned = papers.filter((p) => !p.aeId && ["submitted", "review"].includes(p.stage)).length;
    kpis = [
      { l: t("Submitted"), v: n(counts.submitted), s: t("Papers in review") },
      ph === "assign" ? { l: t("Unassigned"), v: n(unassigned), s: t("Need an associate editor"), c: unassigned ? "#A8600F" : "#14603F" } : { l: t("Drafts"), v: n(counts.drafts), s: t("Not yet submitted"), c: "#4A5263" },
      { l: t("Failed PDF check"), v: n(counts.pdfFailed), s: t("Authors told"), c: counts.pdfFailed ? "#A8600F" : "#121826" },
      { l: t("Similarity flags"), v: n(counts.similarityFlags), s: t("Over 30% (D9)"), c: counts.similarityFlags ? "#B3261E" : "#121826" },
    ];
    if (counts.similarityFlags) alerts.push({ tag: t("SIMILARITY"), bg: "#FDECEA", ink: "#B3261E", t: t("{n} papers over the similarity threshold", { n: counts.similarityFlags }), d: t("Review before assignment — nothing is rejected automatically (D9)"), cta: t("Review"), h: `${base}/papers?f=flag` });
    if (counts.pdfFailed) alerts.push({ tag: t("PDF"), bg: "#FBEFDD", ink: "#7A4508", t: t("{n} papers failed the PDF check", { n: counts.pdfFailed }), d: t("Authors were told and can upload again"), cta: t("Open"), h: `${base}/papers?f=pdf` });
    if (counts.unconfirmedCoauthorPapers) alerts.push({ tag: t("AUTHORS"), bg: "#E6EDFC", ink: "#1F47A8", t: t("{n} papers with unconfirmed co-authors", { n: counts.unconfirmedCoauthorPapers }), d: t("Not blocking (D5)"), cta: t("Open"), h: `${base}/papers?f=coauth` });
    if (unassigned) alerts.push({ tag: t("ASSIGNMENT"), bg: "#FBEFDD", ink: "#7A4508", t: t("{n} papers without an associate editor", { n: unassigned }), d: t("Assign by topic, conflicts are skipped (B4)"), cta: t("Assign"), h: `${base}/assignment` });
    const byTopic = new Map<string, number>();
    for (const p of papers) byTopic.set(p.topic ?? t("No topic"), (byTopic.get(p.topic ?? t("No topic")) ?? 0) + 1);
    chart = { title: t("Submissions by topic"), note: t("top 6"), bars: [...byTopic.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, c]) => ({ t: k, v: c, label: n(c) })) };
  } else if (ph === "review" || ph === "dec") {
    const need = papers.reduce((a, p) => a + Math.max(p.reviewsNeeded, p.reviewsIn), 0);
    const got = papers.reduce((a, p) => a + p.reviewsIn, 0);
    const overdue = papers.reduce((a, p) => a + p.overdue, 0);
    const short = papers.filter((p) => p.reviewsIn < p.reviewsNeeded && p.stage !== "rejected").length;
    const pendingExt = ext.filter((e) => e.status === "pending").length;
    const undecided = papers.filter((p) => !p.decision && p.reviewsIn >= p.reviewsNeeded).length;
    kpis = [
      { l: t("Reviews in"), v: need ? `${Math.round((got / need) * 100)}%` : "—", s: t("{a} of {b}", { a: n(got), b: n(need) }) },
      { l: t("Overdue"), v: n(overdue), s: t("Reminded every 2 days (E10)"), c: overdue ? "#B3261E" : "#121826" },
      { l: t("Papers short of reviews"), v: n(short), s: t("Can’t be decided yet (F2)"), c: short ? "#A8600F" : "#121826" },
      ph === "dec" ? { l: t("Ready to decide"), v: n(undecided), s: t("Enough reviews, no decision"), c: "#1F47A8" } : { l: t("Extension requests"), v: n(pendingExt), s: t("From reviewers"), c: pendingExt ? "#1F47A8" : "#121826" },
    ];
    if (overdue) alerts.push({ tag: t("OVERDUE"), bg: "#FDECEA", ink: "#B3261E", t: t("{n} reviews overdue", { n: overdue }), d: t("Overdue reminders can’t be turned off (E10)"), cta: t("See list"), h: `${base}/reviews` });
    if (counts.aesOverLoad) alerts.push({ tag: "AE", bg: "#FBEFDD", ink: "#7A4508", t: t("{n} AEs over their limit", { n: counts.aesOverLoad }), d: t("Needs program-chair approval (E2)"), cta: t("Rebalance"), h: `${base}/assignment` });
    if (pendingExt) alerts.push({ tag: t("EXTENSIONS"), bg: "#E6EDFC", ink: "#1F47A8", t: t("{n} extension requests", { n: pendingExt }), d: t("Must end before decisions start (C7)"), cta: t("Decide"), h: `${base}/reviews` });
    if (undecided) alerts.push({ tag: t("DECISIONS"), bg: "#E6EDFC", ink: "#1F47A8", t: t("{n} papers ready for a decision", { n: undecided }), d: t("Drafts stay hidden until you release them (F4)"), cta: t("Decide"), h: `${base}/decisions` });
    const weeks = Array.from({ length: 6 }, (_, i) => ({ start: now - (6 - i) * 7 * DAY, label: i === 5 ? t("This week") : t("{n} weeks ago", { n: 5 - i }), c: 0 }));
    for (const s of slots) if (s.submittedAt) { const at = Date.parse(s.submittedAt); const w = weeks.findLastIndex((x) => at >= x.start); if (w >= 0) weeks[w].c++; }
    chart = { title: t("Reviews submitted by week"), note: t("reviews"), bars: weeks.map((w) => ({ t: w.label, v: w.c, label: n(w.c) })) };
  } else {
    const dec = papers.filter((p) => p.decision);
    const acc = dec.filter((p) => p.decision!.startsWith("accept")).length;
    const released = dec.filter((p) => p.released).length;
    kpis = [
      { l: t("Decided"), v: n(dec.length), s: t("of {n} papers", { n: n(papers.length) }) },
      { l: t("Accepted"), v: n(acc), s: dec.length ? t("{n}% acceptance", { n: Math.round((acc / dec.length) * 100) }) : "—", c: "#14603F" },
      { l: t("Released"), v: n(released), s: t("Letters sent") },
      { l: t("Undecided"), v: n(papers.length - dec.length), s: t("Block release (F4)"), c: papers.length - dec.length ? "#B3261E" : "#121826" },
    ];
    if (dec.length > released) alerts.push({ tag: t("LETTERS"), bg: "#E6EDFC", ink: "#1F47A8", t: t("{n} decisions not yet released", { n: dec.length - released }), d: t("Authors see nothing until release (F4)"), cta: t("Review letters"), h: `${base}/decisions/letters` });
    const groups = new Map<string, number>();
    for (const p of dec) groups.set(p.decision!, (groups.get(p.decision!) ?? 0) + 1);
    chart = { title: t("Decisions"), note: t("papers"), bars: [...groups.entries()].map(([k, c]) => ({ t: t(DECISION_LABEL[k] ?? k), v: c, label: n(c) })) };
  }
  const mx = Math.max(1, ...chart.bars.map((b) => b.v));
  const next = ms.find((m) => Date.parse(m.at) > now);
  const sub = [fmtRange(v.starts_on, v.ends_on, t.intl, t, v.kind === "journal"), [v.city, v.country].filter(Boolean).join(", "), v.society].filter(Boolean).join(" · ");

  return (
    <ManagePage ctx={ctx} active="dashboard" crumb={<>{t("Organizer")} · {ctx.label}</>} title={t("Event dashboard")} sub={sub || undefined}
      actions={v.is_published ? <Link href={`/venues/${slug}`} className={`${ui.ghost} h-[34px]! text-[13px]!`}>{t("Public page")}</Link> : null}>
      <div className="flex flex-col gap-4">
        <section className={`${ui.card} overflow-x-auto`} aria-label={t("Event phases")}>
          <ol className="m-0 flex min-w-[820px] list-none p-0">
            {phases.map((p, i) => {
              const done = i < cur, on = i === cur;
              return (
                <li key={p.key} aria-current={on ? "step" : undefined} className="relative flex flex-1 flex-col items-center text-center">
                  {i > 0 ? <span aria-hidden className="absolute right-1/2 top-[13px] h-0.5 w-full" style={{ background: i <= cur ? "#18744F" : "#E3E6E0" }} /> : null}
                  <span className="relative z-10 grid size-7 place-items-center rounded-full text-[12px] font-semibold"
                    style={{ background: done ? "#18744F" : on ? "#F2A93B" : "#FFFFFF", color: done ? "#FFFFFF" : on ? "#0E1B3D" : "#4A5263", border: done || on ? "none" : "1.5px solid #B7BDC9" }}>
                    {done ? "✓" : i + 1}
                  </span>
                  <span className="mt-1.5 text-[13px]" style={{ fontWeight: on ? 700 : 500 }}>{t(p.label)}</span>
                  <span className="font-mono text-[11px] text-[#4A5263]">{on ? t("now") : p.end ? `${done ? "" : "→ "}${fmtShort(p.end, t.intl)}` : "—"}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <KpiRow items={kpis} />

        <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
            <section className={ui.card}>
              <h2 className={ui.h2}>{t("Needs attention")}</h2>
              {alerts.length ? (
                <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                  {alerts.map((a) => (
                    <li key={a.t} className="flex flex-wrap items-center gap-3 rounded-[6px] border border-[#EEF0EC] px-3.5 py-3">
                      <Tag bg={a.bg} ink={a.ink}>{a.tag}</Tag>
                      <div className="min-w-0 flex-auto"><p className="m-0 text-[15px] font-semibold">{a.t}</p><p className="m-0 text-[13px] text-[#4A5263]">{a.d}</p></div>
                      <Link href={a.h} className={`${ui.ghost} h-9! text-[13px]!`}>{a.cta}</Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="m-0 mt-3 text-[14px] text-[#14603F]">✓ {t("Nothing needs your attention right now.")}</p>}
            </section>
            {chart.bars.length ? (
              <section className={ui.card}>
                <div className="flex items-baseline justify-between gap-3"><h2 className={ui.h2}>{chart.title}</h2><span className={ui.hint}>{chart.note}</span></div>
                <div className="mt-4 flex flex-col gap-2.5">
                  {chart.bars.map((b) => (
                    <div key={b.t} className="grid grid-cols-[minmax(120px,200px)_1fr_56px] items-center gap-3 text-[13px]">
                      <span className="truncate">{b.t}</span>
                      <span className="h-2.5 rounded-full bg-[#EEF0EC]"><span className="block h-full rounded-full bg-[#2F5FD0]" style={{ width: `${Math.round((b.v / mx) * 100)}%` }} /></span>
                      <span className="text-right font-mono">{b.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <section className="rounded-[8px] bg-[#0E1B3D] p-[22px] text-white">
              <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#C9D3EA]">{t("Next deadline")}</p>
              {next ? (
                <>
                  <p className="m-0 mt-2 text-[15px]">{next.label}</p>
                  <p className="m-0 font-serif text-[40px] leading-[1.1] text-[#F2A93B]">{countdown(Date.parse(next.at) - now)}</p>
                  <p className="m-0 mt-1 font-mono text-[12px] text-[#C9D3EA]">{fmtAoE(next.at, t.intl)} · {next.hard ? t("hard") : t("soft")}</p>
                </>
              ) : <p className="m-0 mt-2 text-[15px]">{t("No upcoming dates.")}</p>}
              <Link href={`${base}/setup/dates`} className="mt-3 inline-block text-[13px] text-white">{t("Manage dates")} →</Link>
            </section>
            <nav className={ui.card} aria-label={t("Organizer tools")}>
              <p className={ui.kicker}>{t("Organizer tools")}</p>
              <ul className="m-0 mt-2 flex list-none flex-col p-0 text-[14px]">
                {[["Setup checklist", `${base}/setup`], ["Committee & conflicts", `${base}/setup/committee`], ["Email templates", `${base}/setup/emails`], ["Audit log", `${base}/audit`], ["My roles & conflicts", "/manage/roles"]].map(([l, h]) => (
                  <li key={h} className="border-b border-[#EEF0EC] py-2 last:border-0"><Link href={h}>{t(l)}</Link></li>
                ))}
              </ul>
            </nav>
            {counts.myPapers > 0 ? (
              <p className={`${ui.warn} m-0`}>
                {t("You have {n} paper(s) at this event. They’re handled by {deputy} — you can’t see their reviews or scores (rule B2).", { n: counts.myPapers, deputy: counts.deputyName ? t("deputy chair {name}", { name: counts.deputyName }) : t("the deputy chair") })}{" "}
                <Link href="/manage/roles">{t("Details")}</Link>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<OpsDashboardSkeleton />}><Inner {...props} /></Reveal>;
}
