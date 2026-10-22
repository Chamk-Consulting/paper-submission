"use client";

import Link from "@/components/site/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { viewAsEvent } from "@/lib/manage/opspolish-actions";
import { ui } from "@/components/manage/ui";

/* EM40 "View as" — read-only. Start/stop are logged (A6); every write action is disabled. */

export type Snapshot = {
  person: { id: string; name: string; plenary_id: string | null; affiliation: string | null };
  roles: string[];
  papers: { id: string; number: number | null; title: string; stage: string; stage_detail: string | null; pdf: string; copyright: string; registration: string; corresponding: boolean; updated_at: string }[];
  reviews: { id: string; number: number | null; title: string; status: string; round: number; due_at: string | null; submitted_at: string | null }[];
  handling: number;
  sessions: { code: string; title: string; starts_at: string; role: string }[];
};

const no4 = (n: number | null) => (n ? `#${String(n).padStart(4, "0")}` : "—");
const STAGE: Record<string, [string, string, string]> = {
  submitted: ["Submitted", "#E6EDFC", "#1F47A8"], review: ["Under review", "#FBEFDD", "#7A4508"], decision: ["Decision", "#E6EDFC", "#1F47A8"],
  revise: ["Revise", "#FBEFDD", "#7A4508"], final: ["Final version", "#E1F3EA", "#14603F"], done: ["Complete", "#E1F3EA", "#14603F"],
  rejected: ["Not accepted", "#EEF0EC", "#4A5263"], withdrawn: ["Withdrawn", "#EEF0EC", "#4A5263"],
};
const REVIEW: Record<string, [string, string, string]> = {
  invited: ["Invited", "#E6EDFC", "#1F47A8"], accepted: ["To do", "#FBEFDD", "#7A4508"], submitted: ["Submitted", "#E1F3EA", "#14603F"],
  declined: ["Declined", "#EEF0EC", "#4A5263"], cancelled: ["Cancelled", "#EEF0EC", "#4A5263"], withdrawn: ["Withdrawn", "#EEF0EC", "#4A5263"],
};
const CHECK: Record<string, string> = { ok: "✓", need: "!", no: "–" };

/** A write action shown disabled, with the reason as a tooltip. */
function Locked({ children, why }: { children: ReactNode; why: string }) {
  return (
    <span title={why} className="inline-flex">
      <button type="button" disabled aria-disabled title={why} className={`${ui.ghost} h-8! cursor-not-allowed px-3! text-[13px]! opacity-60`}>{children}</button>
    </span>
  );
}

export function ViewAs({ slug, label, snap, back, nowIso }: { slug: string; label: string; snap: Snapshot; back: string; nowIso: string }) {
  const t = useT();
  const router = useRouter();
  const [tab, setTab] = useState<"home" | "reviews" | "papers">("home");
  const [leaving, start] = useTransition();
  const ended = useRef(false);
  const why = t("Read-only while viewing as {name}", { name: snap.person.name });

  useEffect(() => {
    ended.current = false;
    void viewAsEvent(slug, snap.person.id, "start");
    return () => { if (!ended.current) { ended.current = true; void viewAsEvent(slug, snap.person.id, "stop"); } };
  }, [slug, snap.person.id]);

  const exit = () => start(async () => {
    ended.current = true;
    await viewAsEvent(slug, snap.person.id, "stop");
    router.push(back);
  });

  const now = Date.parse(nowIso);
  const due = snap.reviews.filter((r) => r.status === "accepted" || r.status === "invited");
  const overdue = due.filter((r) => r.due_at && Date.parse(r.due_at) < now).length;
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(t.intl, { day: "numeric", month: "short", year: "numeric" }) : "—");
  const tabs: ["home" | "reviews" | "papers", string, number | null][] = [["home", t("Home"), null], ["reviews", t("Reviews"), snap.reviews.length], ["papers", t("Papers"), snap.papers.length]];

  return (
    <div className="flex flex-col gap-4">
      <section role="region" aria-label={t("View as")} className="sticky top-[68px] z-10 flex flex-wrap items-center gap-3 rounded-[8px] border border-[#F2A93B] bg-[#FFF8EC] px-4 py-3 shadow-[0_4px_16px_rgba(18,24,38,.08)]">
        <span aria-hidden className="flex size-9 flex-none items-center justify-center rounded-full bg-[#0E1B3D] text-[15px] text-[#F2A93B]">👁</span>
        <div className="min-w-0 flex-auto">
          <p className="m-0 text-[15px]"><strong>{t("Viewing as {name}", { name: snap.person.name })}</strong> · {label}</p>
          <p className="m-0 text-[13px] text-[#4A5263]">{t("Read-only, and recorded in the audit log (A6). You can't submit, review or decide for them.")}</p>
        </div>
        <button type="button" onClick={exit} disabled={leaving} className={ui.navy}>{leaving ? t("Leaving…") : t("Stop viewing")}</button>
      </section>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="m-0 font-serif text-[26px] font-normal">{snap.person.name}</h2>
        <span className="text-[14px] text-[#4A5263]">{[snap.person.affiliation, snap.person.plenary_id].filter(Boolean).join(" · ")}</span>
        <span className="flex flex-wrap gap-1">{snap.roles.map((r) => <span key={r} className={`${ui.tag} bg-[#EEF0EC] text-[#4A5263]`}>{t(r.replace(/_/g, " "))}</span>)}</span>
      </div>

      <div role="tablist" aria-label={t("Their screens")} className="flex gap-1 border-b border-[#DADDE3]">
        {tabs.map(([k, l, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px h-10 border-0 border-b-2 bg-transparent px-3 text-[14px] font-medium ${tab === k ? "border-[#F2A93B] text-[#121826]" : "border-transparent text-[#4A5263]"}`}>
            {l}{n !== null ? <span className="ml-1.5 font-mono text-[12px] text-[#4A5263]">{n}</span> : null}
          </button>
        ))}
      </div>

      {tab === "home" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <section className={ui.card}><p className={ui.kicker}>{t("Reviews due")}</p><p className="m-0 mt-2 font-mono text-[32px]">{due.length}</p><p className="m-0 text-[13px] text-[#4A5263]">{overdue ? t("{n} overdue", { n: overdue }) : t("None overdue")}</p></section>
          <section className={ui.card}><p className={ui.kicker}>{t("Papers at this event")}</p><p className="m-0 mt-2 font-mono text-[32px]">{snap.papers.length}</p><p className="m-0 text-[13px] text-[#4A5263]">{t("{n} need something", { n: snap.papers.filter((p) => p.pdf === "need" || p.copyright === "need" || p.registration === "need").length })}</p></section>
          <section className={ui.card}><p className={ui.kicker}>{t("Handling as AE")}</p><p className="m-0 mt-2 font-mono text-[32px]">{snap.handling}</p><p className="m-0 text-[13px] text-[#4A5263]">{snap.sessions.length ? t("Chairs {n} session(s)", { n: snap.sessions.length }) : t("No sessions to chair")}</p></section>
          <section className={`${ui.card} md:col-span-3`}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Due next")}</h3>
            {due.length || snap.sessions.length ? (
              <ul className="m-0 mt-2 list-none p-0">
                {due.slice(0, 5).map((r) => <li key={r.id} className="flex flex-wrap items-center gap-3 border-b border-[#EEF0EC] py-2.5 last:border-0"><span className="font-mono text-[12px] text-[#4A5263]">{no4(r.number)}</span><span className="min-w-0 flex-auto truncate">{r.title}</span><span className="text-[13px] text-[#4A5263]">{t("Review due {date}", { date: date(r.due_at) })}</span><Locked why={why}>{t("Open review")}</Locked></li>)}
                {snap.sessions.slice(0, 3).map((s) => <li key={s.code} className="flex flex-wrap items-center gap-3 border-b border-[#EEF0EC] py-2.5 last:border-0"><span className="font-mono text-[12px] text-[#4A5263]">{s.code}</span><span className="min-w-0 flex-auto truncate">{s.title}</span><span className="text-[13px] text-[#4A5263]">{t(s.role === "chair" ? "Chair" : "Co-chair")} · {date(s.starts_at)}</span><Locked why={why}>{t("Run sheet")}</Locked></li>)}
              </ul>
            ) : <p className="m-0 mt-2 text-[14px] text-[#4A5263]">{t("Nothing due at this event.")}</p>}
          </section>
        </div>
      ) : null}

      {tab === "reviews" ? (
        <section className={`${ui.card} overflow-x-auto p-0!`}>
          {snap.reviews.length ? (
            <table className={ui.table}>
              <thead><tr><th className={ui.th}>{t("Paper")}</th><th className={ui.th}>{t("Round")}</th><th className={ui.th}>{t("Status")}</th><th className={ui.th}>{t("Due")}</th><th className={ui.th}><span className="sr-only">{t("Actions")}</span></th></tr></thead>
              <tbody>
                {snap.reviews.map((r) => {
                  const [l, bg, ink] = REVIEW[r.status] ?? [r.status, "#EEF0EC", "#4A5263"];
                  return (
                    <tr key={r.id}>
                      <td className={ui.td}><span className="block font-mono text-[12px] text-[#4A5263]">{no4(r.number)}</span>{r.title}</td>
                      <td className={`${ui.td} font-mono`}>{r.round}</td>
                      <td className={ui.td}><span className={ui.tag} style={{ background: bg, color: ink }}>{t(l)}</span></td>
                      <td className={ui.td}>{r.submitted_at ? t("Sent {date}", { date: date(r.submitted_at) }) : date(r.due_at)}</td>
                      <td className={`${ui.td} text-right`}><Locked why={why}>{r.status === "invited" ? t("Accept") : t("Open review")}</Locked></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="m-0 p-5 text-[14px] text-[#4A5263]">{t("No reviews at this event.")}</p>}
        </section>
      ) : null}

      {tab === "papers" ? (
        <section className={`${ui.card} overflow-x-auto p-0!`}>
          {snap.papers.length ? (
            <table className={ui.table}>
              <thead><tr><th className={ui.th}>{t("Paper")}</th><th className={ui.th}>{t("Status")}</th><th className={ui.th}>{t("PDF")}</th><th className={ui.th}>{t("Copyright")}</th><th className={ui.th}>{t("Registration")}</th><th className={ui.th}><span className="sr-only">{t("Actions")}</span></th></tr></thead>
              <tbody>
                {snap.papers.map((p) => {
                  const [l, bg, ink] = STAGE[p.stage] ?? [p.stage, "#EEF0EC", "#4A5263"];
                  return (
                    <tr key={p.id}>
                      <td className={ui.td}><span className="block font-mono text-[12px] text-[#4A5263]">{no4(p.number)}{p.corresponding ? ` · ${t("corresponding")}` : ""}</span>{p.title}{p.stage_detail ? <span className="block text-[13px] text-[#4A5263]">{t(p.stage_detail)}</span> : null}</td>
                      <td className={ui.td}><span className={ui.tag} style={{ background: bg, color: ink }}>{t(l)}</span></td>
                      <td className={`${ui.td} font-mono`}>{CHECK[p.pdf] ?? "–"}</td>
                      <td className={`${ui.td} font-mono`}>{CHECK[p.copyright] ?? "–"}</td>
                      <td className={`${ui.td} font-mono`}>{CHECK[p.registration] ?? "–"}</td>
                      <td className={`${ui.td} whitespace-nowrap text-right`}><span className="inline-flex gap-1.5"><Locked why={why}>{t("Edit")}</Locked><Locked why={why}>{t("Withdraw")}</Locked></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="m-0 p-5 text-[14px] text-[#4A5263]">{t("No papers at this event — or only papers you can't see because of a conflict (B1).")}</p>}
          <p className="m-0 border-t border-[#EEF0EC] px-5 py-3 text-[13px] text-[#4A5263]">{t("✓ done · ! needed · – not needed yet.")} <Link href={`/manage/${slug}/papers`}>{t("Open the papers table")}</Link></p>
        </section>
      ) : null}
    </div>
  );
}
