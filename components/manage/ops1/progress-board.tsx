"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { decideExtension, sendReminders } from "@/lib/manage/ops1-actions";
import { paperId } from "@/lib/manage/ops1-shared";

/* EM25 — review progress table with bulk reminders (E10, I3) and extension requests (C7). */

export type ProgressSlot = { id: string; state: "done" | "late" | "waiting"; reviewer: string; due: string };
export type ProgressRow = { id: string; number: number | null; title: string; ae: string | null; inCount: number; slots: ProgressSlot[]; lateDays: number };
export type ExtRow = { id: string; reviewer: string; number: number | null; requestedUntil: string | null; dueAt: string; status: string; offeredUntil: string | null; message: string | null };

const COLOR = { done: "#18744F", late: "#B3261E", waiting: "#DADDE3" };

export function ProgressBoard({ slug, rows, min, ext, decisionsAt, template }: {
  slug: string; rows: ProgressRow[]; min: number; ext: ExtRow[]; decisionsAt: string | null; template: { subject: string; body: string };
}) {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState("late");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const day = (iso: string) => new Date(Date.parse(iso) - 12 * 3600e3).toLocaleDateString(t.intl, { day: "numeric", month: "short", timeZone: "UTC" });

  const list = rows.filter((r) => f === "all" || (f === "late" && r.lateDays > 0) || (f === "short" && r.inCount < min) || (f === "done" && r.inCount >= min));
  const chosen = rows.filter((r) => sel.has(r.id));
  const targets = chosen.flatMap((r) => r.slots.filter((s) => s.state !== "done").map((s) => ({ ...s, paper: r })));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = list.length > 0 && list.every((r) => sel.has(r.id));

  function send(test: boolean) {
    start(async () => {
      const r = await sendReminders({ slug, assignments: targets.map((x) => x.id), test });
      if (r.error) { setMsg({ ok: false, text: t(r.error) }); return; }
      if (test) { setMsg({ ok: !r.skipped, text: t(r.info ?? "Test sent.") }); return; }
      setMsg({ ok: true, text: t("{n} reminders logged · {e} emailed · {i} in Plenary inboxes.", { n: r.count ?? 0, e: r.emailed ?? 0, i: r.inbox ?? 0 }) + (r.skipped ? " " + t("Email sending isn’t configured yet, so only the inbox copies went out.") : " " + t("Overdue reminders also go out automatically every 2 days (E10).")) });
      setPanel(false); setSel(new Set());
      router.refresh();
    });
  }
  function decide(e: ExtRow, approve: boolean, offer: string | null) {
    start(async () => {
      const r = await decideExtension({ slug, request: e.id, approve, offer, message: null });
      if (r.error) { setMsg({ ok: false, text: t(r.error) }); return; }
      router.refresh();
    });
  }

  const first = targets[0];
  const fill = (s: string) => first ? s.replace(/\[reviewer\.first\]/g, first.reviewer.split(" ")[0]).replace(/\[paper\.id\]/g, paperId(first.paper.number)).replace(/\[paper\.title\]/g, first.paper.title).replace(/\[deadline\]/g, `${day(first.due)} 23:59 AoE`).replace(/\[link\]/g, "…") : s;
  const lastAllowed = decisionsAt ? new Date(Date.parse(decisionsAt) - 864e5).toISOString() : null;
  const FILTERS: [string, string][] = [["late", t("Overdue")], ["short", t("Short of {n}", { n: min })], ["done", t("Complete")], ["all", t("All")]];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setF(k)} aria-pressed={f === k}
              className={`h-8 rounded-full border px-3 text-[13px] ${f === k ? "border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#4A5263]"}`}>{l}</button>
          ))}
          <button type="button" disabled={!targets.length} onClick={() => { setPanel(true); setMsg(null); }} className={`${ui.primary} ml-auto h-9! text-[13px]!`}>{t("Remind {n} selected", { n: chosen.length })}</button>
        </div>
        {msg ? <p role="status" className={`${msg.ok ? ui.ok : ui.bad} m-0`}>{msg.text}</p> : null}
        {panel ? (
          <section className={`${ui.card} border-[#F1D29A]!`} aria-labelledby="rem-title">
            <h2 id="rem-title" className="m-0 text-[17px] font-semibold">{t("Send reminders to {n} reviewers", { n: targets.length })}</h2>
            <p className="m-0 mt-1 text-[13px] text-[#4A5263]">{t("Template: “Review reminder” · each reviewer gets their own due date. Preview, recipient count and a test send come first (I3).")}</p>
            <div className="mt-3 rounded-[6px] border border-[#DADDE3] bg-[#F7F8F6] p-3.5 text-[14px]">
              <p className="m-0 font-semibold">{fill(template.subject)}</p>
              <p className="m-0 mt-1.5 whitespace-pre-line text-[#4A5263]">{fill(template.body)}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => send(false)} className={ui.primary}>{t("Send {n} reminders", { n: targets.length })}</button>
              <button type="button" disabled={pending} onClick={() => send(true)} className={ui.ghost}>{t("Send test to me")}</button>
              <button type="button" onClick={() => setPanel(false)} className={ui.ghost}>{t("Cancel")}</button>
            </div>
          </section>
        ) : null}
        <div className="overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
          <table className={`${ui.table} min-w-[760px]`}>
            <thead><tr>
              <th scope="col" className={`${ui.th} w-10`}><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(list.map((r) => r.id)))} aria-label={t("Select all")} className="size-4 accent-[#0E1B3D]" /></th>
              {["ID", "Paper · AE", "Reviews", "Slots", "Oldest late"].map((h) => <th key={h} scope="col" className={ui.th}>{t(h)}</th>)}
            </tr></thead>
            <tbody>
              {list.map((r) => {
                const on = sel.has(r.id);
                return (
                  <tr key={r.id} style={{ background: on ? "#F3F6FD" : undefined }}>
                    <td className={ui.td}><input type="checkbox" checked={on} onChange={() => toggle(r.id)} aria-label={t("Select {id}", { id: paperId(r.number) })} className="size-4 accent-[#0E1B3D]" /></td>
                    <td className={`${ui.td} font-mono text-[13px]`}>{paperId(r.number)}</td>
                    <td className={ui.td}><span className="font-semibold">{r.title}</span><span className="block text-[12px] text-[#4A5263]">{r.ae ?? t("No AE yet")}</span></td>
                    <td className={`${ui.td} font-mono text-[13px] font-semibold`} style={{ color: r.inCount >= min ? "#14603F" : "#A8600F" }}>{r.inCount} / {min}</td>
                    <td className={ui.td}>
                      <span className="flex gap-1">
                        {r.slots.map((s) => <span key={s.id} title={`${s.reviewer} · ${s.state === "done" ? t("Submitted") : s.state === "late" ? t("Overdue") : t("Not yet / waiting")}`} className="h-2.5 w-6 rounded-full" style={{ background: COLOR[s.state] }} />)}
                        {Array.from({ length: Math.max(0, min - r.slots.length) }, (_, k) => <span key={k} title={t("Nobody yet")} className="h-2.5 w-6 rounded-full border border-dashed border-[#B7BDC9]" />)}
                      </span>
                    </td>
                    <td className={`${ui.td} text-[13px]`} style={{ color: r.lateDays ? "#B3261E" : "#9AA3B5" }}>{r.lateDays ? t("{n} days", { n: r.lateDays }) : "—"}</td>
                  </tr>
                );
              })}
              {!list.length ? <tr><td colSpan={6} className="px-3.5 py-8 text-center text-[#4A5263]">{t("Nothing in this view.")}</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p className="m-0 flex flex-wrap gap-4 text-[12px] text-[#4A5263]">
          {(["done", "late", "waiting"] as const).map((k) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full" style={{ background: COLOR[k] }} />{t(k === "done" ? "Submitted" : k === "late" ? "Overdue" : "Not yet / waiting")}</span>)}
        </p>
      </div>

      <section className={ui.card}>
        <h2 className="m-0 text-[17px] font-semibold">{t("Extension requests · {n}", { n: ext.filter((e) => e.status === "pending").length })}</h2>
        {decisionsAt ? <p className="m-0 mt-1 text-[12px] text-[#4A5263]">{t("Can’t end after decisions start {d} (C7)", { d: day(decisionsAt) })}</p> : null}
        <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
          {ext.map((e) => {
            const days = e.requestedUntil ? Math.round((Date.parse(e.requestedUntil) - Date.parse(e.dueAt)) / 864e5) : 0;
            const tooLate = !!(decisionsAt && e.requestedUntil && Date.parse(e.requestedUntil) >= Date.parse(decisionsAt));
            const offer = lastAllowed && (!e.requestedUntil || Date.parse(lastAllowed) < Date.parse(e.requestedUntil)) ? lastAllowed : null;
            return (
              <li key={e.id} className="rounded-[6px] border border-[#EEF0EC] p-3">
                <p className="m-0 flex justify-between gap-2 text-[14px]"><strong>{e.reviewer}</strong><span className="font-mono text-[12px] text-[#4A5263]">{paperId(e.number)}</span></p>
                <p className="m-0 mt-0.5 text-[13px] text-[#4A5263]">{e.requestedUntil ? t("Asks {n} days → {d}", { n: days, d: day(e.requestedUntil) }) : t("Asks for more time")}</p>
                {e.message ? <p className="m-0 mt-1 text-[12px] italic text-[#4A5263]">“{e.message}”</p> : null}
                {e.status === "pending" ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" disabled={pending || tooLate} onClick={() => decide(e, true, null)} className={`h-8 rounded-[4px] px-3 text-[12px] font-semibold ${tooLate ? "bg-[#EEF0EC] text-[#6B7280]" : "bg-[#18744F] text-white"}`}>{tooLate && decisionsAt ? t("Can’t — past {d}", { d: day(decisionsAt) }) : t("Approve")}</button>
                    {offer ? <button type="button" disabled={pending} onClick={() => decide(e, false, offer)} className="h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[12px] font-semibold">{t("Offer {d}", { d: day(offer) })}</button> : null}
                    <button type="button" disabled={pending} onClick={() => decide(e, false, null)} className="h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[12px] font-semibold text-[#8C1D18]">{t("Refuse")}</button>
                  </div>
                ) : (
                  <p className="m-0 mt-1.5 text-[12px] font-semibold" style={{ color: e.status === "refused" ? "#B3261E" : "#14603F" }}>
                    {e.status === "approved" ? t("Approved → {d}", { d: e.requestedUntil ? day(e.requestedUntil) : "" }) : e.status === "counter_offered" ? t("Offered {d} — waiting", { d: e.offeredUntil ? day(e.offeredUntil) : "" }) : e.status === "accepted_counter" ? t("Accepted {d}", { d: e.offeredUntil ? day(e.offeredUntil) : "" }) : t("Refused")}
                  </p>
                )}
              </li>
            );
          })}
          {!ext.length ? <li className="text-[13px] text-[#4A5263]">{t("No extension requests.")}</li> : null}
        </ul>
      </section>
    </div>
  );
}
