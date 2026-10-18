import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { ReviewSkeleton } from "@/components/skeletons/review";
import { ExtensionPanel } from "@/components/review/extension-form";
import { Banner, Cols, Crumbs, Head, NotYours, asideLink, box, kick } from "@/components/review/parts";
import { loadReview } from "@/lib/review/page";
import { DAY_MS, fmtDayYear, words } from "@/lib/review/shared";
import { relDay, nowMs } from "@/lib/review/format";
import { getT } from "@/lib/i18n/server";
import { ui } from "@/components/manage/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Need more time?") };
}

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id, ctx, form, t, no, ae } = await loadReview(params, "/extension");
  if (!form) return <WorkspaceShell ctx={ctx} active="reviews"><NotYours t={t} /></WorkspaceShell>;
  const a = form.assignment;
  if (a.status === "invited") redirect(`/reviews/invitations/${id}`);
  const now = nowMs();
  const r = form.review;
  const scored = Object.keys(r?.scores ?? {}).length;
  const nWords = words(r?.to_authors ?? "");
  const summary = t("{a} of {b} scores · {rec} · {w} words", {
    a: scored, b: form.settings.criteria.length, rec: r?.recommendation ? t("recommendation set") : t("no recommendation"), w: nWords,
  });

  // Reminder timeline: sent reminders + the ones still planned.
  const due = new Date(a.due_at).getTime();
  const sent = new Map(form.reminders.map((m) => [m.kind, m.at]));
  const timeline: { t: string; d: string; when: string; state: "done" | "next" | "later" }[] = [];
  if (a.responded_at) timeline.push({ t: t("Invitation accepted"), d: t("You accepted on {d}", { d: fmtDayYear(a.responded_at, t.intl) }), when: fmtDayYear(a.responded_at, t.intl), state: "done" });
  const plan: [string, string, number][] = [["d7", t("Reminder · 7 days left"), -7], ["d3", t("Reminder · 3 days left"), -3], ["d1", t("Reminder · 1 day left"), -1], ["overdue", t("Overdue"), 1]];
  let nextMarked = false;
  for (const [k, label, off] of plan) {
    const at = sent.get(k) ?? new Date(due + off * DAY_MS).toISOString();
    const done = sent.has(k);
    const state: "done" | "next" | "later" = done ? "done" : nextMarked ? "later" : "next";
    if (state === "next") nextMarked = true;
    timeline.push({ t: label, d: done ? t("Email sent") : k === "overdue" ? t("The editor is told; you can still submit") : t("Email + inbox"), when: fmtDayYear(at, t.intl), state });
  }
  const dot = { done: "#18744F", next: "#F2A93B", later: "#B7BDC9" };

  return (
    <WorkspaceShell ctx={ctx} active="reviews">
      <Crumbs items={[[t("Reviews"), "/reviews"], [no, `/reviews/${id}`], [t("More time"), null]]} />
      <Head title={t("Need more time?")} sub={`${no} · ${form.venue.short} · ${t("currently due {d} ({rel})", { d: fmtDayYear(a.due_at, t.intl), rel: relDay(a.due_at, now, t.intl) })}`} />
      <Cols
        main={
          <>
            {a.status === "accepted" || a.status === "handed_back" ? (
              <ExtensionPanel id={id} no={no} ae={ae} dueAt={a.due_at} handedBack={a.status === "handed_back"} draftSummary={summary} ext={form.extension} />
            ) : a.status === "submitted" ? (
              <Banner tone="ok">{t("Your review is in — no extension needed.")}</Banner>
            ) : (
              <Banner tone="info">{t("This review is closed.")}</Banner>
            )}
            {a.status === "accepted" ? (
              <section className={ui.card}>
                <h2 className={ui.h2}>{t("Reminders for this review")}</h2>
                <ol className="m-0 mt-3 flex list-none flex-col p-0">
                  {timeline.map((x, i) => (
                    <li key={i} className="flex items-start gap-3 border-t border-[#EEF0EC] py-2.5 first:border-t-0">
                      <span aria-hidden className="mt-1.5 size-2.5 flex-none rounded-full" style={{ background: dot[x.state] }} />
                      <span className="flex-auto"><span className="block text-[15px] font-medium">{x.t}</span><span className="block text-[13px] text-[#4A5263]">{x.d}</span></span>
                      <span className="font-mono text-[13px] text-[#4A5263]">{x.when}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </>
        }
        aside={
          <>
            <section className={box}>
              <p className={kick}>{t("Decision deadline")}</p>
              <div className="mt-1 font-serif text-[26px] leading-none">{form.dates.decisions ? fmtDayYear(form.dates.decisions, t.intl) : "—"}</div>
              <p className="mb-0 mt-1.5 text-[13px] text-[#4A5263]">{t("The editor can't extend past this date.")}</p>
            </section>
            <section className={box}>
              <p className={kick}>{t("Your progress")}</p>
              <p className="mb-0 mt-1.5 text-[14px]">{summary}</p>
              <Link href={`/reviews/${id}`} className={asideLink}>{t("Open the draft")}</Link>
            </section>
          </>
        }
      />
    </WorkspaceShell>
  );
}

/** Canvas RV06-MoreTime. */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Reveal fallback={<ReviewSkeleton variant="form" />}>
      <Inner params={params} />
    </Reveal>
  );
}
