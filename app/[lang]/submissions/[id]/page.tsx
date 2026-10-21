import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { StepMark } from "@/components/motion/step-transition";
import { initialsOf, requireCtx } from "@/components/submission/frame";
import { WizardHeader } from "@/components/submission/shell";
import { OpenFile } from "@/components/submission/status-bits";
import { DeleteDraftButton } from "@/components/submission/delete-draft";
import { OpenViewer } from "@/components/submission/followup/open-viewer";
import { loadDecision, loadInfo, loadRevision } from "@/lib/submission/followup-data";
import { createClient } from "@/lib/supabase/server";
import { fmtMonth } from "@/lib/venues/time";
import { Reveal } from "@/components/motion/reveal";
import { StatusSkeleton } from "@/components/skeletons";
import { TestBanner } from "@/components/submission/test-banner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Paper status") };
}
const isFuture = (iso: string) => Date.parse(iso) > Date.now();
type P = { params: Promise<{ id: string }> };

const STAGE: Record<string, [string, string, string, string]> = {
  draft: ["DRAFT", "#EEF0EC", "#4A5263", "Not submitted yet. Finish the steps and submit before the deadline."],
  submitted: ["SUBMITTED", "#E6EDFC", "#1F47A8", "Submitted. You can edit it until the deadline; then it's locked for review."],
  review: ["UNDER REVIEW", "#E6EDFC", "#1F47A8", "Reviewers are reading your paper. Nothing to do now."],
  decision: ["ACCEPTED", "#E1F3EA", "#14603F", "Accepted. Prepare the final version."],
  revise: ["REVISE", "#FBEFDD", "#7A4508", "Revisions requested."],
  final: ["FINAL DUE", "#FBEFDD", "#7A4508", "Upload the final version and sign the copyright form."],
  done: ["COMPLETE", "#E1F3EA", "#14603F", "All done."],
  rejected: ["NOT ACCEPTED", "#FDECEA", "#B3261E", "This paper was not accepted."],
  withdrawn: ["WITHDRAWN", "#EEF0EC", "#4A5263", "You withdrew this paper."],
};
const ACTION: Record<string, string> = {
  "submission.draft_created": "Draft started.",
  "submission.submitted": "Submitted. Receipt recorded for all authors.",
  "submission.updated": "Submission updated before the deadline.",
  "submission.withdrawn": "Withdrawn by the authors.",
};
const shortAt = (iso: string, intl: string) => new Date(iso).toLocaleDateString(intl, { day: "numeric", month: "short", timeZone: "UTC" });

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "status");
  const t = await getT();
  const { sub, venue, authors, files, editable } = ctx;
  const short = (iso: string) => shortAt(iso, t.intl);
  const supabase = await createClient();
  const [{ data: hist }, decision, info, revision] = await Promise.all([
    supabase.rpc("submission_history", { p_submission: id }),
    loadDecision(id),
    sub.stage === "draft" ? Promise.resolve(null) : loadInfo(id),
    sub.stage === "revise" ? loadRevision(id) : Promise.resolve(null),
  ]);
  const myConfirmation = info?.authors.find((a) => a.isMe)?.confirmation;
  const rebuttalClose = info?.rebuttal ? info.dates.rebuttal_close ?? null : null;
  const rebuttalOpen = !!rebuttalClose && isFuture(rebuttalClose) && ["review", "decision", "submitted"].includes(sub.stage);
  const viewerFiles = files.filter((f) => f.current && f.mime === "application/pdf");
  const base = `/submissions/${id}`;
  const nextStep: { title: string; text: string; cta: string; href: string } | null =
    sub.stage === "final" ? { title: t("Final version"), text: t("Upload the camera-ready PDF, lock the title and authors, sign the copyright form and register one author."), cta: t("Start final version"), href: `${base}/final` }
    : sub.stage === "revise" ? (revision && revision.status !== "draft"
        ? { title: t("Revision submitted"), text: t("The associate editor is checking your revision."), cta: t("View revision"), href: `${base}/revision/done` }
        : { title: t("Revision"), text: t("Answer the reviewers' comments and upload the revised paper."), cta: t("Start revision"), href: `${base}/revision` })
    : rebuttalOpen ? { title: t("Rebuttal"), text: t("The reviews are in. You can correct misunderstandings before the decision."), cta: t("Respond to the reviews"), href: `${base}/rebuttal` }
    : null;
  const [label, bg, ink, line] = STAGE[sub.stage] ?? STAGE.submitted;
  const paper = files.find((f) => f.role === "paper" && f.current);
  const me = authors.find((a) => a.isYou);
  const no = sub.number ? `#${String(sub.number).padStart(4, "0")}` : t("Draft");
  const name = ctx.me.person ? `${ctx.me.person.given_name} ${ctx.me.person.family_name}` : ctx.me.email;
  const notif = venue.dates.find((d) => d.kind === "notification");
  const final = venue.dates.find((d) => d.kind === "final");
  const order = ["submitted", "review", "decision", "final", "done"];
  const at = Math.max(0, order.indexOf(sub.stage === "revise" ? "decision" : sub.stage));
  const deadlinePassed = !venue.deadline && venue.kind !== "journal";
  const pipe = [
    { title: t("Submitted"), d: sub.submittedAt ? short(sub.submittedAt) : "—", done: sub.stage !== "draft" },
    { title: t("Deadline"), d: venue.deadline ? short(venue.deadline) : t("passed"), done: deadlinePassed && sub.stage !== "draft" },
    { title: t("Review"), d: "", done: at >= 2 },
    { title: t("Decision"), d: notif ? short(notif.startsAt) : "", done: at >= 2 && sub.stage !== "review" },
    { title: t("Final version"), d: final ? short(final.startsAt) : "", done: at >= 4 },
    { title: t("Copyright & reg."), d: "", done: sub.copyrightCheck === "ok" && sub.registrationCheck === "ok" },
    { title: t("Conference"), d: fmtMonth(venue.startsOn, t.intl) ?? "", done: sub.stage === "done" },
  ];
  const current = sub.stage === "withdrawn" ? -1 : pipe.findIndex((p) => !p.done);
  const tile = (k: string, v: string, s: string, color: string) => (
    <div className="rounded-[8px] border border-[#DADDE3] border-t-4 bg-white px-3.5 py-3" style={{ borderTopColor: color }}>
      <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t(k)}</div>
      <div className="mt-1 text-[17px] font-semibold" style={{ color: color === "#DADDE3" ? "#121826" : color }}>{t(v)}</div>
      <div className="text-[13px] text-[#4A5263]">{s ? t(s) : ""}</div>
    </div>
  );
  const box = "rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5";
  const kicker = "m-0 mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]";

  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <WizardHeader initials={initialsOf(name, ctx.me.email)} />
      <StepMark n={0} />
      <div className="border-b border-[#DADDE3] bg-white">
        <div className="flex flex-col gap-4 px-5 pb-5 pt-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            {sub.isTest ? <TestBanner venueSlug={venue.slug} passed={!!sub.testSubmittedAt} /> : null}
            <p className="m-0 text-[14px] text-[#4A5263]"><Link href="/workspace/submissions" className="text-[#121826] underline">{t("My workspace")}</Link> / {venue.acr} / {no}</p>
            <h1 className="mt-2 font-serif text-[26px] font-normal leading-[1.2] sm:text-[32px]">{sub.title}</h1>
            <p className="mt-1 text-[15px] text-[#4A5263]">{no} · {venue.acr} · {t(sub.paperType)}{me?.corresponding ? ` · ${t("you are the corresponding author")}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {decision
              ? <Link href={`${base}/decision`} className="inline-flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[15px] text-[#121826] no-underline hover:bg-[#F7F8F6]">{t("Decision & reviews")}</Link>
              : <span title={t("Available after the decision")} className="inline-flex h-11 items-center rounded-[4px] border border-[#DADDE3] bg-white px-4 text-[15px] text-[#9AA3B5]">{t("Decision & reviews")}</span>}
            {viewerFiles.length ? <OpenViewer id={id} files={viewerFiles} label={t("Open paper")} className="h-11 rounded-[4px] bg-[#0E1B3D] px-4 text-[15px] font-semibold text-white" /> : null}
          </div>
        </div>
      </div>

      <div className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-6 px-5 pb-16 pt-7 sm:px-8 lg:flex-row lg:items-start">
        <main className="flex min-w-0 flex-auto flex-col gap-4">
          {myConfirmation === "pending" && sub.stage !== "draft" ? (
            <section role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#BCCDF5] bg-[#E6EDFC] px-[22px] py-4 text-[#1F2E5C]">
              <span><strong>{t("Confirm you are a co-author")}</strong> · {t("Every author confirms before review starts.")}</span>
              <Link href={`${base}/confirm`} className="inline-flex h-10 items-center rounded-[4px] bg-[#0E1B3D] px-4 text-[15px] font-semibold text-white no-underline">{t("Confirm authorship")}</Link>
            </section>
          ) : null}
          {nextStep ? (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] bg-[#0E1B3D] px-[22px] py-4 text-[#F5F6F3]">
              <span className="min-w-0"><span className="block font-mono text-[11px] uppercase tracking-[0.06em] text-[#F2A93B]">{t("Next step")} · {nextStep.title}</span><span className="mt-1 block text-[15px]">{nextStep.text}</span></span>
              <Link href={nextStep.href} className="inline-flex h-11 flex-none items-center rounded-[4px] bg-[#F2A93B] px-4 font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{nextStep.cta} →</Link>
            </section>
          ) : null}
          <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[22px] py-5">
            <div className="flex flex-wrap items-center gap-3"><span className="rounded-[2px] px-2.5 py-1 font-mono text-[12px] font-medium tracking-[0.04em]" style={{ background: bg, color: ink }}>{t(label)}</span>{sub.stageDetail ? <span className="text-[15px] text-[#4A5263]">{/^Step (\d+) of 7$/.test(sub.stageDetail) ? t("Step {n} of 7", { n: sub.stageDetail.split(" ")[1] }) : t(sub.stageDetail)}</span> : null}</div>
            <p className="mt-3 text-[16px]">{t(line)}{notif && sub.stage !== "withdrawn" ? ` ${t("Decisions are expected on {date}.", { date: short(notif.startsAt) })}` : ""}</p>
            {sub.stage === "draft" ? <Link href={`/submissions/${id}/review`} className="mt-3 inline-flex h-11 items-center rounded-[4px] bg-[#F2A93B] px-4 font-semibold text-[#0E1B3D] no-underline">{t("Continue the submission →")}</Link> : null}
            {sub.stage !== "withdrawn" && sub.stage !== "draft" ? (
              <ol className="m-0 mt-5 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-7">
                {pipe.map((p, i) => (
                  <li key={p.title} className="flex flex-col items-center text-center">
                    <span className="flex size-7 items-center justify-center rounded-full text-[12px] font-semibold" style={p.done ? { background: "#18744F", color: "#fff" } : i === current ? { background: "#F2A93B", color: "#0E1B3D" } : { border: "1.5px solid #B7BDC9", color: "#4A5263", background: "#fff" }}>{p.done ? "✓" : i + 1}</span>
                    <span className="mt-1.5 text-[13px] font-semibold">{p.title}</span>
                    <span className="text-[12px] text-[#4A5263]">{p.d}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {info && info.reviews.submitted > 0
              ? tile("Reviews", decision ? "Released" : "In progress", decision ? "" : "shown after the decision", decision ? "#18744F" : "#2F5FD0")
              : tile("Reviews", "Not yet", "after the deadline", "#DADDE3")}
            {tile("PDF check", paper ? (paper.check.status === "failed" ? "Problems" : "Passed") : "No PDF", paper?.pages != null ? t("{n} pages", { n: paper.pages }) : "", paper ? (paper.check.status === "failed" ? "#B3261E" : "#18744F") : "#DADDE3")}
            {tile("Copyright", sub.copyrightCheck === "ok" ? "Signed" : "Not yet", "after acceptance", sub.copyrightCheck === "ok" ? "#18744F" : "#DADDE3")}
            {tile("Registration", sub.registrationCheck === "ok" ? "Done" : "Not yet", "after acceptance", sub.registrationCheck === "ok" ? "#18744F" : "#DADDE3")}
          </div>
          <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[22px] py-5">
            <h2 className="m-0 font-serif text-[22px] font-normal">{t("History")}</h2>
            <ul className="m-0 mt-3 list-none p-0">
              {((hist ?? []) as { at: string; action: string; details: { number?: number } }[]).map((h, i) => (
                <li key={i} className="grid grid-cols-[110px_14px_1fr] items-center gap-3 border-b border-[#EEF0EC] py-3 last:border-b-0">
                  <span className="font-mono text-[12px] text-[#4A5263]">{new Date(h.at).toLocaleString(t.intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}</span>
                  <span className="size-2 rounded-full" style={{ background: h.action.includes("withdrawn") ? "#B3261E" : "#18744F" }} />
                  <span>{ACTION[h.action] ? t(ACTION[h.action]) : h.action}{h.details?.number ? ` ${t("Paper ID {no}.", { no: `#${String(h.details.number).padStart(4, "0")}` })}` : ""}</span>
                </li>
              ))}
            </ul>
            <p className="mb-0 mt-2 text-[12px] text-[#4A5263]">{t("Times in UTC.")}</p>
          </section>
        </main>

        <aside className="flex w-full flex-col gap-4 lg:w-[320px] lg:flex-none">
          <section className={box}>
            <p className={kicker}>{t("Paper")}</p>
            <dl className="m-0 grid grid-cols-[84px_1fr] gap-y-1.5 text-[14px]">
              <dt className="text-[#4A5263]">ID</dt><dd className="m-0">{no}</dd>
              <dt className="text-[#4A5263]">{t("Venue")}</dt><dd className="m-0"><Link href={`/venues/${venue.slug}`} className="text-[#2F5FD0] underline">{venue.acr}</Link></dd>
              <dt className="text-[#4A5263]">{t("Type")}</dt><dd className="m-0">{t(sub.paperType)}{venue.reviewMode ? ` · ${t(venue.reviewMode).toLowerCase()}` : ""}</dd>
              <dt className="text-[#4A5263]">{t("Track")}</dt><dd className="m-0">{sub.track ? t(sub.track) : "—"}</dd>
              <dt className="text-[#4A5263]">{t("Keywords")}</dt><dd className="m-0">{sub.keywords.map((k) => t(k)).join(", ") || "—"}</dd>
            </dl>
          </section>
          <section className={box}>
            <p className={kicker}>{t("Files")}</p>
            {files.filter((f) => f.current || f.role !== "paper").map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 border-b border-[#EEF0EC] py-2 text-[14px] last:border-b-0">
                <span className="min-w-0 truncate"><strong className="font-mono text-[12px]">{(f.name.split(".").pop() ?? "").toUpperCase()}</strong> {f.name}</span>
                <OpenFile path={f.path} className="flex-none border-0 bg-transparent p-0 text-[14px] text-[#2F5FD0]">{t("Open")}</OpenFile>
              </div>
            ))}
            {files.length === 0 ? <p className="m-0 text-[14px] text-[#4A5263]">{t("No files yet.")}</p> : null}
          </section>
          <section className={box}>
            <p className={kicker}>{t("Authors")}</p>
            <ol className="m-0 list-none p-0 text-[14px]">
              {authors.map((a) => (
                <li key={a.personId} className="flex justify-between gap-2 py-1"><span>{a.position}. {a.name}{a.isYou ? <span className="text-[#4A5263]"> {t("(you)")}</span> : null}</span><span className={a.hasAccount ? "text-[#14603F]" : "text-[#7A4508]"}>{a.hasAccount ? "✓" : t("invited")}</span></li>
              ))}
            </ol>
          </section>
          <section className={box}>
            <p className={kicker}>{t("Actions")}</p>
            <div className="flex flex-col gap-2">
              {editable ? <Link href={sub.stage === "draft" ? `${base}/details` : `${base}/edit`} className="flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[15px] text-[#121826] no-underline hover:bg-[#F7F8F6]">{sub.stage === "draft" ? t("Continue editing") : t("Edit submission (until the deadline)")}</Link> : null}
              {decision ? <Link href={`${base}/decision`} className="flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[15px] text-[#121826] no-underline hover:bg-[#F7F8F6]">{t("Decision & reviews")}</Link> : null}
              {rebuttalOpen ? <Link href={`${base}/rebuttal`} className="flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[15px] text-[#121826] no-underline hover:bg-[#F7F8F6]">{t("Respond to the reviews")}</Link> : null}
              {sub.stage === "final" || sub.stage === "done" ? <Link href={`${base}/final`} className="flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[15px] text-[#121826] no-underline hover:bg-[#F7F8F6]">{t("Final version")}</Link> : null}
              {sub.stage !== "draft" ? <Link href={`${base}/message`} className="flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[15px] text-[#121826] no-underline hover:bg-[#F7F8F6]">{t("Message the program chair")}</Link> : null}
              {sub.number ? <a href={`/submissions/${id}/receipt.pdf`} className="flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[15px] text-[#121826] no-underline hover:bg-[#F7F8F6]">{t("Download receipt")}</a> : null}
              {!["withdrawn", "done", "rejected", "draft"].includes(sub.stage) ? <Link href={`${base}/withdraw`} className="flex h-11 items-center rounded-[4px] border border-[#F3C3BE] bg-white px-3.5 text-[15px] text-[#B3261E] no-underline hover:bg-[#FDECEA]">{t("Withdraw paper")}</Link> : null}
              {/* Drafts have no paper number to type, so they keep the inline confirm. */}
              {sub.stage === "draft" ? <DeleteDraftButton id={id} /> : null}
              {sub.stage === "withdrawn" ? <Link href={`${base}/withdraw/done`} className="flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[15px] text-[#121826] no-underline hover:bg-[#F7F8F6]">{t("Withdrawal details")}</Link> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Canvas SB09-Status. */
export default function Page(props: P) {
  return <Reveal fallback={<StatusSkeleton />}><Inner {...props} /></Reveal>;
}
