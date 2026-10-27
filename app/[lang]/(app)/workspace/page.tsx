import Link from "@/components/site/link";
import { getMe } from "@/lib/auth/me";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { getMyPapers, getWorkspaceCtx, type MyPaper, type Stage } from "@/lib/workspace/data";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { WorkspaceBodySkeleton, WorkspaceHomeSkeleton } from "@/components/skeletons/site1";
import { getDirectory } from "@/lib/venues/data";
import { nextDeadline } from "@/lib/venues/time";
import { FIELD_LABEL, KIND_LABEL, type Field } from "@/lib/venues/types";
import { requestNow, buildDueItems, getMyChairedSessions, getMyCoauthorRequests, getMyInbox, getMyReviews, getMyTopics, getVenueDates } from "@/lib/site/data";
import { DueNext } from "@/components/site/due-next";
import { Greeting, OpenCalls, RelTime, type OpenCall } from "@/components/site/workspace-home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("My workspace") };
}

const STEP: Record<Stage, number> = { draft: 1, submitted: 2, review: 3, decision: 4, revise: 4, final: 5, done: 6, rejected: 4, withdrawn: 1 };
const STEP_LABEL = ["", "Draft", "Submitted", "Under review", "Decision", "Final version", "Published"];
const PILL: Record<Stage, [string, string, string]> = {
  draft: ["DRAFT", "#EEF0EC", "#4A5263"], submitted: ["SUBMITTED", "#E6EDFC", "#1F47A8"], review: ["UNDER REVIEW", "#E6EDFC", "#1F47A8"],
  decision: ["DECISION", "#E6EDFC", "#1F47A8"], revise: ["REVISE", "#FBEFDD", "#7A4508"], final: ["ACCEPTED", "#E1F3EA", "#14603F"],
  done: ["ACCEPTED", "#E1F3EA", "#14603F"], rejected: ["NOT ACCEPTED", "#FDECEA", "#B3261E"], withdrawn: ["WITHDRAWN", "#EEF0EC", "#4A5263"],
};
const FIELD_WORDS: Record<Field, RegExp> = { control: /control|estimation|optimi[sz]ation/i, robotics: /robot|autonom|manipulat/i, ocean: /ocean|marine|underwater|maritime/i, systems: /system|decision|network/i };

function profileScore(me: NonNullable<Awaited<ReturnType<typeof getWorkspaceCtx>>>["me"], topics: string[]) {
  const checks = [!!me.person?.given_name && !!me.person?.family_name, !!me.affiliation?.institution, !!(me.person?.country ?? me.affiliation?.country), !!me.person?.orcid, topics.length > 0];
  return { pct: Math.round((checks.filter(Boolean).length / checks.length) * 100), needTopics: topics.length === 0, needOrcid: !me.person?.orcid };
}

async function Inner({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  // one round of queries: the shell summary, the page data and the deadline dates all start together
  const pidP = getMe().then((m) => m?.person?.id);
  const papersP = pidP.then(getMyPapers);
  const [ctx, t, { notice }, { papers }, reviews, coauthor, sessions, inbox, topics, dir, now, dates] = await Promise.all([
    getWorkspaceCtx(), getT(), searchParams,
    papersP, getMyReviews(), getMyCoauthorRequests(), getMyChairedSessions(), getMyInbox(4),
    pidP.then((pid) => (pid ? getMyTopics(pid) : [])), getDirectory(), requestNow(),
    papersP.then(({ papers: ps }) => getVenueDates([...new Set(ps.map((p) => p.venue.id))])),
  ]);
  if (!ctx) redirect("/sign-in?next=/workspace");
  const items = buildDueItems({ papers, reviews, coauthor, sessions, dates, now });
  const soon = items.filter((i) => i.at && Date.parse(i.at) - now <= 14 * 864e5);
  const nRev = soon.filter((i) => i.tag === "REVIEW" || i.tag === "INVITATION").length;
  const nFinal = soon.filter((i) => i.tag === "FINAL VERSION").length;
  const nCo = items.filter((i) => i.tag === "CO-AUTHOR").length;

  const myFields = (Object.keys(FIELD_WORDS) as Field[]).filter((f) => topics.some((x) => FIELD_WORDS[f].test(x)));
  const open = dir.venues.map((v) => ({ v, d: nextDeadline(v, now) })).filter((x) => x.d && x.d.kind === "submission");
  const mine = myFields.length ? open.filter((x) => x.v.field && myFields.includes(x.v.field)) : [];
  const calls: OpenCall[] = (mine.length ? mine : open).sort((a, b) => (a.d!.startsAt < b.d!.startsAt ? -1 : 1)).slice(0, 4)
    .map(({ v, d }) => ({ slug: v.slug, name: v.acr, kind: v.field ? FIELD_LABEL[v.field] : KIND_LABEL[v.kind], at: d!.startsAt }));
  const prof = profileScore(ctx.me, topics);
  const first = ctx.me.person?.given_name?.trim() || null;
  const b = (n: number, one: string, many: string) => <strong className="text-[#121826]">{t(n === 1 ? one : many, { n })}</strong>;

  return (
    <WorkspaceShell ctx={ctx} active="home">
      {notice === "password-changed" ? (
        <p role="status" className="mb-5 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3.5 py-2.5 text-[14px] text-[#14603F]">✓ {t("Password changed. Other devices were signed out.")}</p>
      ) : null}
      <Greeting first={first} />
      <p className="mt-1.5 text-[#4A5263]">
        {nRev + nFinal + nCo ? <>{t("You have")} {b(nRev, "{n} review", "{n} reviews")}, {b(nFinal, "{n} final version", "{n} final versions")} {t("and")} {b(nCo, "{n} co-author request", "{n} co-author requests")} {t("in the next 14 days.")}</> : t("Nothing is due in the next 14 days.")}
        {" "}<Link href="/workspace/settings/calendar" className="whitespace-nowrap text-[#2F5FD0]">{t("Add deadlines to my calendar →")}</Link>
      </p>

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <DueNext items={items} now={now} />
          <MySubmissions papers={papers} t={t} />
        </div>
        <aside className="flex flex-col gap-4">
          <OpenCalls calls={calls} mine={mine.length > 0} now={now} />
          <section className="rounded-[8px] border border-[#DADDE3] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="m-0 font-serif text-[20px] font-normal">{t("Latest messages")}</h2>
              <Link href="/workspace/inbox" className="text-[13px] font-semibold text-[#2F5FD0]">{t("Inbox →")}</Link>
            </div>
            {inbox.length ? (
              <ul className="m-0 mt-2 list-none p-0">
                {inbox.map((m) => (
                  <li key={m.thread_id} className="flex gap-2.5 border-b border-[#EEF0EC] py-2.5 last:border-b-0">
                    <span aria-hidden className={`mt-2 size-2 flex-none rounded-full ${m.unread ? "bg-[#2F5FD0]" : "bg-transparent"}`} />
                    <Link href={`/workspace/inbox/${m.thread_id}`} className="min-w-0 flex-auto text-[#121826] no-underline hover:underline">
                      <span className={`block truncate text-[14px] ${m.unread ? "font-semibold" : ""}`}>{m.subject}</span>
                      <span className="flex justify-between gap-2 text-[12px] text-[#4A5263]"><span className="truncate">{[m.last_from, m.venue].filter(Boolean).join(" · ")}</span><RelTime iso={m.last_at} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="mb-0 mt-2 text-[14px] text-[#4A5263]">{t("No messages yet.")}</p>}
          </section>
          {prof.pct < 100 ? (
            <section className="rounded-[8px] border border-[#F1D29A] bg-[#FFF6E6] p-5 text-[#3B2A07]">
              <h2 className="m-0 flex items-center justify-between font-serif text-[20px] font-normal">{t("Finish your profile")}<span className="font-mono text-[13px]">{prof.pct}%</span></h2>
              <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-[#F1D29A]"><span className="block h-full bg-[#A8600F]" style={{ width: `${prof.pct}%` }} /></span>
              <p className="mb-0 mt-2.5 text-[14px]">{prof.needTopics ? t("Add your topics so chairs can match you to papers you’re qualified to review.") : prof.needOrcid ? t("Connect ORCID so your papers and reviews follow you.") : t("Add your affiliation and country so co-authors can find you.")}</p>
              <Link href="/workspace/account/profile" className="mt-2.5 inline-block text-[14px] font-semibold text-[#7A4508]">{t("Complete profile →")}</Link>
            </section>
          ) : null}
        </aside>
      </div>
    </WorkspaceShell>
  );
}

function MySubmissions({ papers, t }: { papers: MyPaper[]; t: Awaited<ReturnType<typeof getT>> }) {
  return (
    <section className="rounded-[8px] border border-[#DADDE3] bg-white" aria-labelledby="mysub-h">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 id="mysub-h" className="m-0 font-serif text-[22px] font-normal">{t("My submissions")}</h2>
        <Link href="/workspace/submissions" className="text-[13px] font-semibold text-[#2F5FD0]">{t("View all {n} →", { n: papers.length })}</Link>
      </div>
      {papers.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
            <thead>
              <tr>{[t("Paper"), t("Venue"), t("Progress"), t("Status")].map((h) => <th key={h} scope="col" className="border-y border-[#DADDE3] bg-[#F7F8F6] px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{h}</th>)}</tr>
            </thead>
            <tbody>
              {papers.slice(0, 5).map((p) => {
                const step = STEP[p.stage];
                const [pill, bg, ink] = PILL[p.stage];
                return (
                  <tr key={p.id}>
                    <td className="border-b border-[#EEF0EC] px-5 py-3 align-top">
                      <Link href={p.href} className="font-medium text-[#121826] no-underline hover:underline">{p.title || t("Untitled draft")}</Link>
                      <span className="block font-mono text-[12px] text-[#4A5263]">{p.number ? `#${p.number}` : t("No ID yet")}</span>
                    </td>
                    <td className="border-b border-[#EEF0EC] px-5 py-3 align-top">{p.venue.shortName ?? p.venue.name}</td>
                    <td className="border-b border-[#EEF0EC] px-5 py-3 align-top">
                      <span className="flex gap-1" aria-hidden>{[1, 2, 3, 4, 5, 6].map((i) => <span key={i} className={`h-1.5 w-5 rounded-full ${i <= step ? (p.stage === "rejected" || p.stage === "withdrawn" ? "bg-[#9AA3B5]" : "bg-[#18744F]") : "bg-[#DADDE3]"}`} />)}</span>
                      <span className="mt-1 block text-[12px] text-[#4A5263]">{t("Stage {n} of 6 · {label}", { n: step, label: t(STEP_LABEL[step]) })}</span>
                    </td>
                    <td className="border-b border-[#EEF0EC] px-5 py-3 align-top"><span className="inline-flex rounded-[3px] px-1.5 py-px font-mono text-[11px] font-medium uppercase tracking-[0.04em]" style={{ background: bg, color: ink }}>{t(pill)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="m-0 border-t border-[#EEF0EC] px-5 py-8 text-center text-[#4A5263]">{t("No papers yet.")} <Link href="/events" className="text-[#2F5FD0]">{t("Find a call for papers")}</Link></p>
      )}
    </section>
  );
}

/** WS01 — Workspace home. */
export default function Page(props: { searchParams: Promise<{ notice?: string }> }) {
  return (
    <Reveal fallback={<WorkspaceBodySkeleton active="home"><WorkspaceHomeSkeleton /></WorkspaceBodySkeleton>}>
      <Inner {...props} />
    </Reveal>
  );
}
