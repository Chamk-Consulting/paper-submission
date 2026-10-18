import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { SubmitForm } from "@/components/submission/submit-form";
import { DeadlineBig } from "@/components/submission/live";
import { asideCard, card, h2 } from "@/components/submission/shell";
import { STEPS } from "@/lib/submission/data";

export const metadata: Metadata = { title: "Review & submit" };
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "review");
  const { sub, venue, authors, files, conflicts, done } = ctx;
  const paper = files.find((f) => f.role === "paper" && f.current);
  const extras = files.filter((f) => f.role !== "paper");
  const words = sub.abstract?.trim() ? sub.abstract.trim().split(/\s+/).length : 0;
  const invites = authors.filter((a) => !a.hasAccount).length;
  const missing = STEPS.filter((s) => s.key !== "review" && !done[s.key]);
  const autoInst = new Set(authors.map((a) => a.institution).filter(Boolean)).size;
  const base = `/submissions/${id}`;
  const rows: [string, string, React.ReactNode][] = [
    ["Venue & type", "type", <span key="v"><strong>{venue.acr}</strong> · {sub.paperType}{sub.track ? ` · ${sub.track}` : ""}</span>],
    ["Title", "details", <span key="t" className="font-serif text-[18px] leading-[1.3]">{sub.title}</span>],
    ["Abstract", "details", <span key="a" className="text-[#4A5263]">{(sub.abstract ?? "—").slice(0, 220)}{(sub.abstract?.length ?? 0) > 220 ? "…" : ""} <span className="font-mono text-[12px]">{words} words</span></span>],
    ["Authors", "authors", <ol key="au" className="m-0 list-none p-0">{authors.map((a) => <li key={a.personId}>{a.position}. {a.name}{a.corresponding ? <span className="text-[#4A5263]"> (corresponding)</span> : null}{!a.hasAccount ? <span className="ml-1.5 font-mono text-[11px] text-[#7A4508]">INVITE ON SUBMIT</span> : null}</li>)}</ol>],
    ["Keywords", "keywords", sub.keywords.length ? <span key="k">{sub.keywords.map((k, i) => <span key={k}>{i ? " · " : ""}{i === 0 ? <strong>{k} (main)</strong> : k}</span>)}</span> : <span key="k0" className="text-[#B3261E]">None yet</span>],
    ["Files", "files", paper ? <span key="f">{paper.name}{paper.pages != null ? ` · ${paper.pages} pages` : ""} <span className="ml-1 rounded-[2px] px-1.5 font-mono text-[11px]" style={{ background: paper.check.status === "failed" ? "#FDECEA" : "#E1F3EA", color: paper.check.status === "failed" ? "#B3261E" : "#14603F" }}>{paper.check.status === "failed" ? "× PROBLEMS" : "✓ PASSED"}</span>{extras.length ? <span className="block text-[#4A5263]">+ {extras.map((e) => e.name).join(" · ")}</span> : null}</span> : <span key="f0" className="text-[#B3261E]">No PDF yet</span>],
    ["Conflicts", "conflicts", `${autoInst + conflicts.length} — ${autoInst} institution${autoInst === 1 ? "" : "s"}, ${conflicts.length} ${conflicts.length === 1 ? "person" : "people"}`],
  ];
  return (
    <SubmissionFrame ctx={ctx} step="review" aside={
      <>
        <DeadlineBig deadline={venue.deadline} generatedAt={new Date(sub.updatedAt).toISOString()} />
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{missing.length ? `${missing.length} step${missing.length === 1 ? "" : "s"} to finish` : "All checks passed"}</h3>
          <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0 text-[15px]">
            {missing.length ? missing.map((m) => <li key={m.key} className="text-[#B3261E]">× <Link href={`${base}/${m.key}`} className="text-[#B3261E] underline">{m.label}</Link></li>) : (
              <>
                <li><span className="text-[#18744F]">✓</span> Required fields complete</li>
                <li><span className="text-[#18744F]">✓</span> PDF meets the template</li>
                <li><span className="text-[#18744F]">✓</span> Conflicts reviewed</li>
              </>
            )}
            {invites ? <li className="text-[#7A4508]">! {invites} co-author{invites === 1 ? "" : "s"} will be invited by email</li> : null}
          </ul>
        </section>
      </>
    }>
      <section className={card}>
        <h2 className={h2}>Check everything once</h2>
        <dl className="m-0 mt-3">
          {rows.map(([label, step, value]) => (
            <div key={label} className="grid grid-cols-[110px_1fr_auto] gap-3 border-b border-[#EEF0EC] py-3.5 last:border-b-0 sm:grid-cols-[150px_1fr_auto]">
              <dt className="text-[14px] font-medium text-[#4A5263]">{label}</dt>
              <dd className="m-0 min-w-0 text-[15px]">{value}</dd>
              <dd className="m-0"><Link href={`${base}/${step}`} className="text-[14px] text-[#2F5FD0] underline">Edit</Link></dd>
            </div>
          ))}
        </dl>
      </section>
      <SubmitForm id={id} ready={missing.length === 0} resubmit={sub.stage === "submitted"} />
    </SubmissionFrame>
  );
}

/** Canvas SB07-Review. */
export default function Page(props: P) {
  return <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}><Inner {...props} /></Suspense>;
}
