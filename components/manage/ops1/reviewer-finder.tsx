"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { inviteReviewer, requestOverride } from "@/lib/manage/ops1-actions";
import type { Invitation, Suggestion } from "@/lib/manage/ops1-data";

/* EM23 — invited list + suggested reviewers, invite by token link, conflict override request (E3–E5, B5, B6). */

const ST: Record<string, [string, string, string]> = {
  accepted: ["ACCEPTED", "#E1F3EA", "#14603F"], submitted: ["SUBMITTED", "#E1F3EA", "#14603F"], declined: ["DECLINED", "#FDECEA", "#B3261E"],
  expired: ["EXPIRED", "#EEF0EC", "#4A5263"], invited: ["WAITING", "#E6EDFC", "#1F47A8"], cancelled: ["CANCELLED", "#EEF0EC", "#4A5263"],
};
const REASON: Record<string, string> = { busy: "Too busy", expertise: "Outside my expertise", conflict: "Conflict of interest", other: "Other reason" };

export function ReviewerFinder({ slug, submission, invitations, suggestions, min, max, inviteDays }: {
  slug: string; submission: string; invitations: Invitation[]; suggestions: Suggestion[]; min: number; max: number; inviteDays: number;
}) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [ovr, setOvr] = useState<Suggestion | null>(null);
  const [why, setWhy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ovrErr, setOvrErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(t.intl, { day: "numeric", month: "short" });

  const acc = invitations.filter((i) => i.round === 1 && (i.status === "accepted" || i.status === "submitted")).length;
  const active = invitations.filter((i) => i.round === 1 && ["invited", "accepted", "submitted"].includes(i.status)).length;
  const maxed = active >= max;

  function done(r: { error?: string; emailed?: number; inbox?: number; skipped?: boolean }, who: string) {
    if (r.error) { setMsg({ ok: false, text: t(r.error) }); return; }
    setMsg({ ok: true, text: r.skipped
      ? t("{who} invited. Email sending isn’t configured yet, so no email went out{inbox}.", { who, inbox: r.inbox ? t(" — the invitation is in their Plenary inbox") : "" })
      : t("{who} invited by email{inbox}. The link expires in {n} days (E5).", { who, inbox: r.inbox ? t(" and in Plenary") : "", n: inviteDays }) });
    router.refresh();
  }
  function invite(s: Suggestion) {
    start(async () => done(await inviteReviewer({ slug, submission, person: s.personId, email: null }), s.name));
  }
  function inviteEmail() {
    const e = email.trim();
    start(async () => { const r = await inviteReviewer({ slug, submission, person: null, email: e }); done(r, e); if (!r.error) setEmail(""); });
  }
  function ask() {
    if (!ovr) return;
    start(async () => {
      const r = await requestOverride({ slug, submission, person: ovr.personId, reason: why });
      if (r.error) { setOvrErr(t(r.error)); return; }
      setMsg({ ok: true, text: t("Override for {name} sent for approval. You can invite once a second person approves (B5).", { name: ovr.name }) });
      setOvr(null); setWhy("");
      router.refresh();
    });
  }

  const s = q.trim().toLowerCase();
  const list = suggestions.filter((x) => !s || x.name.toLowerCase().includes(s) || x.topics.some((tp) => tp.toLowerCase().includes(s)) || (x.institution ?? "").toLowerCase().includes(s)).slice(0, 40);

  return (
    <div className="flex flex-col gap-4">
      {msg ? <p role="status" className={`${msg.ok ? ui.ok : ui.bad} m-0`}>{msg.text}</p> : null}
      <section className={ui.card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={ui.h2}>{t("Invited")}</h2>
          <span className="text-[14px]"><strong style={{ color: acc >= min ? "#14603F" : "#A8600F" }}>{t("{a} of {b} accepted", { a: acc, b: min })}</strong> <span className="text-[#4A5263]">· {t("max {n} (E3)", { n: max })}</span></span>
        </div>
        <ul className="m-0 mt-3 flex list-none flex-col p-0">
          {invitations.map((i) => {
            const [label, bg, ink] = ST[i.status] ?? [i.status.toUpperCase(), "#EEF0EC", "#4A5263"];
            const when = i.status === "invited" ? t("expires {d}", { d: fmt(i.replyBy) })
              : i.status === "declined" ? [t(REASON[i.declineReason ?? "other"] ?? i.declineReason ?? ""), i.suggestion ? t("suggested {who}", { who: i.suggestion }) : ""].filter(Boolean).join(" · ")
              : i.status === "expired" ? t("No reply in {n} days (E5)", { n: inviteDays })
              : i.respondedAt ? fmt(i.respondedAt) : "";
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-3 border-b border-[#EEF0EC] py-2.5 last:border-0">
                <div className="min-w-0 flex-auto"><p className="m-0 font-semibold">{i.name !== "—" ? i.name : i.email}</p><p className="m-0 text-[12px] text-[#4A5263]">{i.round > 1 ? t("Round {n}", { n: i.round }) + " · " : ""}{t("due {d}", { d: fmt(i.dueAt) })}</p></div>
                <span className={ui.tag} style={{ background: bg, color: ink }}>{t(label)}</span>
                <span className="w-full text-[12px] text-[#4A5263] sm:w-[220px] sm:text-right">{when}</span>
              </li>
            );
          })}
          {!invitations.length ? <li className="py-3 text-[14px] text-[#4A5263]">{t("Nobody invited yet. Invite until {n} accept.", { n: min })}</li> : null}
        </ul>
      </section>

      <section className={`${ui.card} p-0!`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-[22px] pt-[22px]">
          <h2 className={ui.h2}>{t("Suggested reviewers")}</h2>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find anyone by name or topic")} aria-label={t("Find anyone")} className={`${ui.input} h-9! w-full text-[14px]! sm:w-[280px]`} />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className={`${ui.table} min-w-[680px]`}>
            <thead><tr>{["Person", "Match", "Load", "On time", ""].map((h, k) => <th key={k} scope="col" className={ui.th}>{h ? t(h) : <span className="sr-only">{t("Action")}</span>}</th>)}</tr></thead>
            <tbody>
              {list.map((x) => {
                const coi = !!x.conflict && x.override !== "approved";
                const full = x.load >= x.cap;
                const cta = x.already ? t("Invited ✓") : coi ? (x.override === "pending" ? t("Awaiting approval") : t("Override…")) : full ? t("At limit") : maxed ? t("Max reached") : t("Invite");
                const en = !x.already && !(coi && x.override === "pending") && (coi || (!full && !maxed));
                return (
                  <tr key={x.personId} style={{ background: coi ? "#FFF8F7" : undefined }}>
                    <td className={ui.td}>
                      <span className="font-semibold">{x.name}</span>
                      <span className="block text-[12px]" style={{ color: coi ? "#B3261E" : "#4A5263" }}>{coi ? `⚠ ${x.conflict}` : [x.institution, x.topics.slice(0, 3).join(" · ")].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className={`${ui.td} font-mono font-semibold`} style={{ color: x.match >= 80 ? "#14603F" : x.match >= 50 ? "#121826" : "#9AA3B5" }}>{x.match}%</td>
                    <td className={`${ui.td} text-[13px]`} style={{ color: full ? "#B3261E" : "#4A5263" }}>{t("{a} / {b} this month", { a: x.load, b: x.cap })}{full ? ` · ${t("full")}` : ""}</td>
                    <td className={`${ui.td} text-[13px] text-[#4A5263]`}>{t("{n}% on time", { n: x.onTime })}</td>
                    <td className={`${ui.td} text-right`}>
                      <button type="button" disabled={!en || pending} onClick={() => (coi ? (setOvr(x), setWhy(""), setOvrErr(null)) : invite(x))}
                        className={`h-[30px] rounded-[4px] px-3 text-[12px] font-semibold ${!en ? "bg-[#EEF0EC] text-[#6B7385]" : coi ? "border border-[#F1D29A] bg-[#FFF6E6] text-[#7A4508]" : "bg-[#F2A93B] text-[#0E1B3D]"}`}>{cta}</button>
                    </td>
                  </tr>
                );
              })}
              {!list.length ? <tr><td colSpan={5} className="px-3.5 py-6 text-center text-[#4A5263]">{t("No one matches. Invite by email below.")}</td></tr> : null}
            </tbody>
          </table>
        </div>
        <form className="flex flex-wrap items-end gap-2 border-t border-[#EEF0EC] px-[22px] py-4" onSubmit={(e) => { e.preventDefault(); inviteEmail(); }}>
          <label className={`${ui.label} min-w-[240px] flex-auto`}>{t("Invite someone else by email")}
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@university.edu" className={ui.input} autoComplete="off" />
          </label>
          <button type="submit" disabled={pending || maxed || !email.trim()} className={ui.navy}>{maxed ? t("Max reached") : t("Send invitation")}</button>
          <p className={`${ui.hint} m-0 w-full`}>{t("They get a link to accept or decline without signing in. Conflicts are checked when they answer.")}</p>
        </form>
      </section>

      {ovr ? (
        <div role="dialog" aria-modal="true" aria-labelledby="ovr-title" className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,27,61,0.45)] p-4" onKeyDown={(e) => e.key === "Escape" && setOvr(null)}>
          <div className="w-full max-w-[520px] rounded-[8px] bg-white p-6 shadow-xl">
            <h2 id="ovr-title" className={ui.h2}>{t("Invite {name} despite a conflict?", { name: ovr.name })}</h2>
            <p className="mt-2 text-[14px] text-[#4A5263]">{t("{why}. An override needs a written reason and a second approver; it is recorded in the audit log (B5).", { why: ovr.conflict ?? "" })}</p>
            <textarea autoFocus value={why} onChange={(e) => setWhy(e.target.value)} rows={4} placeholder={t("Why is this not a real conflict?")} aria-label={t("Reason")} className={`${ui.textarea} mt-3 w-full`} />
            {ovrErr ? <p role="alert" className={`${ui.bad} mt-3`}>{ovrErr}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={pending || why.trim().length < 10} onClick={ask} className={ui.primary}>{t("Ask for approval")}</button>
              <button type="button" onClick={() => setOvr(null)} className={ui.ghost}>{t("Cancel")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
