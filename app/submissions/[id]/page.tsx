import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { initialsOf, requireCtx } from "@/components/submission/frame";
import { WizardHeader } from "@/components/submission/shell";
import { OpenFile, WithdrawBox } from "@/components/submission/status-bits";
import { createClient } from "@/lib/supabase/server";
import { fmtMonth } from "@/lib/venues/time";

export const metadata: Metadata = { title: "Paper status" };
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
const short = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "status");
  const { sub, venue, authors, files, editable } = ctx;
  const supabase = await createClient();
  const { data: hist } = await supabase.rpc("submission_history", { p_submission: id });
  const [label, bg, ink, line] = STAGE[sub.stage] ?? STAGE.submitted;
  const paper = files.find((f) => f.role === "paper" && f.current);
  const me = authors.find((a) => a.isYou);
  const no = sub.number ? `#${String(sub.number).padStart(4, "0")}` : "Draft";
  const name = ctx.me.person ? `${ctx.me.person.given_name} ${ctx.me.person.family_name}` : ctx.me.email;
  const notif = venue.dates.find((d) => d.kind === "notification");
  const final = venue.dates.find((d) => d.kind === "final");
  const order = ["submitted", "review", "decision", "final", "done"];
  const at = Math.max(0, order.indexOf(sub.stage === "revise" ? "decision" : sub.stage));
  const deadlinePassed = !venue.deadline && venue.kind !== "journal";
  const pipe = [
    { t: "Submitted", d: sub.submittedAt ? short(sub.submittedAt) : "—", done: sub.stage !== "draft" },
    { t: "Deadline", d: venue.deadline ? short(venue.deadline) : "passed", done: deadlinePassed && sub.stage !== "draft" },
    { t: "Review", d: "", done: at >= 2 },
    { t: "Decision", d: notif ? short(notif.startsAt) : "", done: at >= 2 && sub.stage !== "review" },
    { t: "Final version", d: final ? short(final.startsAt) : "", done: at >= 4 },
    { t: "Copyright & reg.", d: "", done: sub.copyrightCheck === "ok" && sub.registrationCheck === "ok" },
    { t: "Conference", d: fmtMonth(venue.startsOn), done: sub.stage === "done" },
  ];
  const current = sub.stage === "withdrawn" ? -1 : pipe.findIndex((p) => !p.done);
  const tile = (t: string, v: string, s: string, color: string) => (
    <div className="rounded-[8px] border border-[#DADDE3] border-t-4 bg-white px-3.5 py-3" style={{ borderTopColor: color }}>
      <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t}</div>
      <div className="mt-1 text-[17px] font-semibold" style={{ color: color === "#DADDE3" ? "#121826" : color }}>{v}</div>
      <div className="text-[13px] text-[#4A5263]">{s}</div>
    </div>
  );
  const box = "rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5";
  const kicker = "m-0 mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]";

  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <WizardHeader initials={initialsOf(name, ctx.me.email)} />
      <div className="border-b border-[#DADDE3] bg-white">
        <div className="flex flex-col gap-4 px-5 pb-5 pt-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-[14px] text-[#4A5263]"><Link href="/workspace/submissions" className="text-[#121826] underline">My workspace</Link> / {venue.acr} / {no}</p>
            <h1 className="mt-2 font-serif text-[26px] font-normal leading-[1.2] sm:text-[32px]">{sub.title}</h1>
            <p className="mt-1 text-[15px] text-[#4A5263]">{no} · {venue.acr} · {sub.paperType}{me?.corresponding ? " · you are the corresponding author" : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* TODO(review): decision & reviews page (SB13). */}
            <span title="Available after the decision" className="inline-flex h-11 items-center rounded-[4px] border border-[#DADDE3] bg-white px-4 text-[15px] text-[#9AA3B5]">Decision &amp; reviews</span>
            {paper ? <OpenFile path={paper.path} className="h-11 rounded-[4px] bg-[#0E1B3D] px-4 text-[15px] font-semibold text-white">Open paper</OpenFile> : null}
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-[1340px] flex-col gap-6 px-5 pb-16 pt-7 sm:px-8 lg:flex-row lg:items-start">
        <main className="flex min-w-0 flex-auto flex-col gap-4">
          <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[22px] py-5">
            <div className="flex flex-wrap items-center gap-3"><span className="rounded-[2px] px-2.5 py-1 font-mono text-[12px] font-medium tracking-[0.04em]" style={{ background: bg, color: ink }}>{label}</span>{sub.stageDetail ? <span className="text-[15px] text-[#4A5263]">{sub.stageDetail}</span> : null}</div>
            <p className="mt-3 text-[16px]">{line}{notif && sub.stage !== "withdrawn" ? ` Decisions are expected on ${short(notif.startsAt)}.` : ""}</p>
            {sub.stage === "draft" ? <Link href={`/submissions/${id}/review`} className="mt-3 inline-flex h-11 items-center rounded-[4px] bg-[#F2A93B] px-4 font-semibold text-[#0E1B3D] no-underline">Continue the submission →</Link> : null}
            {sub.stage !== "withdrawn" && sub.stage !== "draft" ? (
              <ol className="m-0 mt-5 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-7">
                {pipe.map((p, i) => (
                  <li key={p.t} className="flex flex-col items-center text-center">
                    <span className="flex size-7 items-center justify-center rounded-full text-[12px] font-semibold" style={p.done ? { background: "#18744F", color: "#fff" } : i === current ? { background: "#F2A93B", color: "#0E1B3D" } : { border: "1.5px solid #B7BDC9", color: "#4A5263", background: "#fff" }}>{p.done ? "✓" : i + 1}</span>
                    <span className="mt-1.5 text-[13px] font-semibold">{p.t}</span>
                    <span className="text-[12px] text-[#4A5263]">{p.d}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tile("Reviews", "Not yet", "after the deadline", "#DADDE3")}
            {tile("PDF check", paper ? (paper.check.status === "failed" ? "Problems" : "Passed") : "No PDF", paper?.pages != null ? `${paper.pages} pages` : "", paper ? (paper.check.status === "failed" ? "#B3261E" : "#18744F") : "#DADDE3")}
            {tile("Copyright", sub.copyrightCheck === "ok" ? "Signed" : "Not yet", "after acceptance", sub.copyrightCheck === "ok" ? "#18744F" : "#DADDE3")}
            {tile("Registration", sub.registrationCheck === "ok" ? "Done" : "Not yet", "after acceptance", sub.registrationCheck === "ok" ? "#18744F" : "#DADDE3")}
          </div>
          <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[22px] py-5">
            <h2 className="m-0 font-serif text-[22px] font-normal">History</h2>
            <ul className="m-0 mt-3 list-none p-0">
              {((hist ?? []) as { at: string; action: string; details: { number?: number } }[]).map((h, i) => (
                <li key={i} className="grid grid-cols-[110px_14px_1fr] items-center gap-3 border-b border-[#EEF0EC] py-3 last:border-b-0">
                  <span className="font-mono text-[12px] text-[#4A5263]">{new Date(h.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}</span>
                  <span className="size-2 rounded-full" style={{ background: h.action.includes("withdrawn") ? "#B3261E" : "#18744F" }} />
                  <span>{ACTION[h.action] ?? h.action}{h.details?.number ? ` Paper ID #${String(h.details.number).padStart(4, "0")}.` : ""}</span>
                </li>
              ))}
            </ul>
            <p className="mb-0 mt-2 text-[12px] text-[#4A5263]">Times in UTC.</p>
          </section>
        </main>

        <aside className="flex w-full flex-col gap-4 lg:w-[320px] lg:flex-none">
          <section className={box}>
            <p className={kicker}>Paper</p>
            <dl className="m-0 grid grid-cols-[84px_1fr] gap-y-1.5 text-[14px]">
              <dt className="text-[#4A5263]">ID</dt><dd className="m-0">{no}</dd>
              <dt className="text-[#4A5263]">Venue</dt><dd className="m-0"><Link href={`/venues/${venue.slug}`} className="text-[#2F5FD0] underline">{venue.acr}</Link></dd>
              <dt className="text-[#4A5263]">Type</dt><dd className="m-0">{sub.paperType}{venue.reviewMode ? ` · ${venue.reviewMode.toLowerCase()}` : ""}</dd>
              <dt className="text-[#4A5263]">Track</dt><dd className="m-0">{sub.track ?? "—"}</dd>
              <dt className="text-[#4A5263]">Keywords</dt><dd className="m-0">{sub.keywords.join(", ") || "—"}</dd>
            </dl>
          </section>
          <section className={box}>
            <p className={kicker}>Files</p>
            {files.filter((f) => f.current || f.role !== "paper").map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 border-b border-[#EEF0EC] py-2 text-[14px] last:border-b-0">
                <span className="min-w-0 truncate"><strong className="font-mono text-[12px]">{(f.name.split(".").pop() ?? "").toUpperCase()}</strong> {f.name}</span>
                <OpenFile path={f.path} className="flex-none border-0 bg-transparent p-0 text-[14px] text-[#2F5FD0]">Open</OpenFile>
              </div>
            ))}
            {files.length === 0 ? <p className="m-0 text-[14px] text-[#4A5263]">No files yet.</p> : null}
          </section>
          <section className={box}>
            <p className={kicker}>Authors</p>
            <ol className="m-0 list-none p-0 text-[14px]">
              {authors.map((a) => (
                <li key={a.personId} className="flex justify-between gap-2 py-1"><span>{a.position}. {a.name}{a.isYou ? <span className="text-[#4A5263]"> (you)</span> : null}</span><span className={a.hasAccount ? "text-[#14603F]" : "text-[#7A4508]"}>{a.hasAccount ? "✓" : "invited"}</span></li>
              ))}
            </ol>
          </section>
          <section className={box}>
            <p className={kicker}>Actions</p>
            <div className="flex flex-col gap-2">
              {editable ? <Link href={`/submissions/${id}/details`} className="flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[15px] text-[#121826] no-underline hover:bg-[#F7F8F6]">{sub.stage === "draft" ? "Continue editing" : "Edit submission (until the deadline)"}</Link> : null}
              {/* TODO(inbox): message the program chair (IN01). */}
              <span title="Coming soon" className="flex h-11 items-center rounded-[4px] border border-[#DADDE3] px-3.5 text-[15px] text-[#9AA3B5]">Message the program chair</span>
              {sub.number ? <a href={`/submissions/${id}/receipt.pdf`} className="flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[15px] text-[#121826] no-underline hover:bg-[#F7F8F6]">Download receipt</a> : null}
              {!["withdrawn", "done", "rejected"].includes(sub.stage) ? <WithdrawBox id={id} /> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Canvas SB09-Status. */
export default function Page(props: P) {
  return <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}><Inner {...props} /></Suspense>;
}
