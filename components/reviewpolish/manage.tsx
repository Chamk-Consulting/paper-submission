"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { inviteReviewer } from "@/lib/manage/ops1-actions";
import { ui } from "@/components/manage/ui";

type Vol = { personId: string; name: string; institution: string | null; topics: string[]; note: string | null; maxPapers: number; role: string | null };

/* ---------------------------------------------------------------- EM23/EM24: reviewers' annotated PDFs */
export function AnnotationsCard({ items }: { items: { assignmentId: string; n: number | null; reviewer: string | null; url: string | null }[] }) {
  const t = useT();
  return (
    <section className={ui.card}>
      <p className={ui.kicker}>{t("Annotated PDFs")}</p>
      <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0 text-[14px]">
        {items.map((a) => (
          <li key={a.assignmentId} className="flex items-center gap-2">
            <span aria-hidden className="rounded-[3px] bg-[#E6EDFC] px-1.5 py-px font-mono text-[11px] text-[#1F47A8]">PDF</span>
            {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="text-[#2F5FD0]">{t("Reviewer {n}", { n: a.n ?? "?" })}</a> : <span>{t("Reviewer {n}", { n: a.n ?? "?" })}</span>}
            {a.reviewer ? <span className="text-[13px] text-[#4A5263]">· {a.reviewer}</span> : null}
          </li>
        ))}
      </ul>
      <p className={`${ui.hint} mb-0 mt-2.5`}>{t("Only you and the chairs can open these. They are never sent to authors.")}</p>
    </section>
  );
}

/* ---------------------------------------------------------------- EM23: volunteers as candidates for one paper */
export function VolunteerCandidates({ slug, submission, volunteers }: { slug: string; submission: string; volunteers: (Vol & { matches: string[] })[] }) {
  const t = useT();
  const [sent, setSent] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  if (!volunteers.length) return null;
  const sorted = [...volunteers].sort((a, b) => b.matches.length - a.matches.length);
  const invite = (v: Vol) => start(async () => {
    setErr(null);
    const r = await inviteReviewer({ slug, submission, person: v.personId, email: null });
    if (r.error) { setErr(r.error); return; }
    setSent((s) => ({ ...s, [v.personId]: r.emailed ? t("Invited by email") : t("Invited in Plenary") }));
  });
  return (
    <section className={ui.card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={ui.h2}>{t("Volunteers")}</h2>
        <span className="text-[13px] text-[#4A5263]">{t("Offered to review for this venue")}</span>
      </div>
      <ul className="m-0 mt-3 flex list-none flex-col p-0">
        {sorted.map((v) => (
          <li key={v.personId} className="flex flex-wrap items-center gap-3 border-b border-[#EEF0EC] py-3 last:border-0">
            <span className="min-w-[200px] flex-auto">
              <span className="block font-semibold">{v.name}{v.role ? <span className="ml-2 font-mono text-[11px] font-normal uppercase text-[#4A5263]">{v.role.replace(/_/g, " ")}</span> : null}</span>
              <span className="block text-[13px] text-[#4A5263]">{[v.institution, t("up to {n} papers", { n: v.maxPapers })].filter(Boolean).join(" · ")}</span>
              {v.topics.length ? (
                <span className="mt-1 flex flex-wrap gap-1">
                  {v.topics.map((x) => <span key={x} className={`${ui.tag} ${v.matches.includes(x) ? "bg-[#E1F3EA] text-[#14603F]" : "bg-[#EEF0EC] text-[#4A5263]"}`}>{x}</span>)}
                </span>
              ) : null}
              {v.note ? <span className="mt-1 block text-[13px] italic text-[#4A5263]">“{v.note}”</span> : null}
            </span>
            {sent[v.personId] ? <span className="text-[13px] text-[#14603F]">✓ {sent[v.personId]}</span>
              : <button type="button" disabled={busy} onClick={() => invite(v)} className={`${ui.ghost} h-9! text-[14px]!`}>{t("Invite to review")}</button>}
          </li>
        ))}
      </ul>
      {err ? <p role="alert" className="mb-0 mt-2 text-[13px] text-[#B3261E]">{t(err)}</p> : null}
      <p className={`${ui.hint} mb-0 mt-2`}>{t("Conflicts are checked when you invite, as for anyone else (B6).")}</p>
    </section>
  );
}

/* ---------------------------------------------------------------- EM08: volunteers list on the committee page */
export function VolunteersList({ volunteers }: { volunteers: Vol[] }) {
  const t = useT();
  return (
    <section className={ui.card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={ui.h2}>{t("Reviewer volunteers")}</h2>
        <span className="text-[13px] text-[#4A5263]">{t("{n} people offered to review", { n: volunteers.length })}</span>
      </div>
      {volunteers.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className={ui.table}>
            <thead><tr><th className={ui.th}>{t("Name")}</th><th className={ui.th}>{t("Topics")}</th><th className={ui.th}>{t("Max")}</th><th className={ui.th}>{t("Role here")}</th></tr></thead>
            <tbody>
              {volunteers.map((v) => (
                <tr key={v.personId}>
                  <td className={ui.td}><span className="font-semibold">{v.name}</span><span className="block text-[13px] text-[#4A5263]">{v.institution ?? ""}</span>{v.note ? <span className="block text-[13px] italic text-[#4A5263]">“{v.note}”</span> : null}</td>
                  <td className={ui.td}>{v.topics.join(", ") || "—"}</td>
                  <td className={`${ui.td} font-mono`}>{v.maxPapers}</td>
                  <td className={ui.td}>{v.role ? v.role.replace(/_/g, " ") : <span className="text-[#4A5263]">{t("None yet")}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className={`${ui.hint} mb-0 mt-2`}>{t("Authors can offer to review after they submit. They show here and on each paper's Find reviewers page.")}</p>}
      {volunteers.length ? <p className={`${ui.hint} mb-0 mt-3`}>{t("Invite a volunteer to a paper from its Find reviewers page — no committee role is needed.")}</p> : null}
    </section>
  );
}
