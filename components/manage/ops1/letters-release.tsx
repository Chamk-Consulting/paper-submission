"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { releaseDecisions, sendTestLetters } from "@/lib/manage/ops1-actions";
import { DECISION_COLOR, DECISION_LABEL } from "@/lib/manage/ops1-shared";

/* EM27 — letters by decision with previews, test letters, release (F4–F6, I3, I4) and delivery stats. */

export type LetterPreview = { paper: string; to: string; subject: string; text: string; missing: string[] };
export type LetterGroup = { decision: string; template: string; count: number; byType: Record<string, number>; previews: LetterPreview[] };
export type BatchStat = { id: string; releasedAt: string | null; recipients: number; delivered: number; bounced: number; paperType: string | null };

function Check({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-[6px] border px-3 py-2.5 text-[14px]" style={{ background: on ? "#F3FAF6" : "#FFFFFF", borderColor: on ? "#B9E0CB" : "#DADDE3" }}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="mt-0.5 size-4 accent-[#18744F]" />
      <span>{children}</span>
    </label>
  );
}

export function LettersRelease({ slug, groups, undecided, undecidedByType, types, batch, emailOn }: {
  slug: string; groups: LetterGroup[]; undecided: number; undecidedByType: Record<string, number>; types: string[]; batch: BatchStat | null; emailOn: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [g, setG] = useState(0);
  const [pv, setPv] = useState(0);
  const [scope, setScope] = useState<"all" | "type">("all");
  const [type, setType] = useState(types[0] ?? "");
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<{ count: number; emailed: number; inbox: number; at: string } | null>(null);
  const [pending, start] = useTransition();

  const cur = groups[g];
  const p = cur?.previews[Math.min(pv, (cur?.previews.length ?? 1) - 1)];
  const total = scope === "all" ? groups.reduce((a, x) => a + x.count, 0) : groups.reduce((a, x) => a + (x.byType[type] ?? 0), 0);
  const und = scope === "all" ? undecided : undecidedByType[type] ?? 0;
  const large = total > 500;
  const missing = groups.some((x) => x.previews.some((y) => y.missing.length));
  const ok = und === 0 && total > 0 && c1 && (!large || c2);
  const status = und ? t("{n} papers are still undecided.", { n: und }) : !total ? t("Nothing to release in this scope.") : ok ? t("Ready.") : large ? t("Tick both boxes.") : t("Tick the box.");

  function release() {
    if (!ok) return;
    start(async () => {
      const r = await releaseDecisions({ slug, paperType: scope === "type" ? type : null, confirmLarge: large && c2, checked: true });
      if (r.error) { setMsg({ ok: false, text: t(r.error) }); return; }
      setResult({ count: r.count ?? 0, emailed: r.emailed ?? 0, inbox: r.inbox ?? 0, at: new Date().toISOString() });
      setMsg(r.skipped ? { ok: false, text: t("Email sending isn’t configured yet: letters were delivered to Plenary inboxes only.") } : null);
      setC1(false); setC2(false);
      router.refresh();
    });
  }
  function test() {
    start(async () => {
      const r = await sendTestLetters({ slug });
      setMsg(r.error ? { ok: false, text: t(r.error) } : { ok: !r.skipped, text: t(r.info ?? "Test letters sent.") });
    });
  }


  const shown = result ? { count: result.count, delivered: result.emailed, inbox: result.inbox, bounced: 0, at: result.at } : batch ? { count: batch.recipients, delivered: batch.delivered, inbox: null, bounced: batch.bounced, at: batch.releasedAt } : null;

  return (
    <div className="flex flex-col gap-4">
      {shown && (result || !groups.length) ? (
        <section className={`${ui.card} border-[#B9E0CB]!`} aria-live="polite">
          <p className={ui.kicker}>{t("Released {d}", { d: shown.at ? new Date(shown.at).toLocaleString(t.intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "" })}</p>
          <h2 className={`${ui.h2} mt-1`}>{t("{n} decisions released", { n: shown.count.toLocaleString(t.intl) })}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div><p className="m-0 text-[13px] text-[#4A5263]">{t("Emails delivered")}</p><p className="m-0 font-serif text-[26px]">{shown.delivered.toLocaleString(t.intl)}</p></div>
            <div><p className="m-0 text-[13px] text-[#4A5263]">{t("Failed / bounced")}</p><p className="m-0 font-serif text-[26px]" style={{ color: shown.bounced ? "#B3261E" : "#121826" }}>{shown.bounced}</p></div>
            <div><p className="m-0 text-[13px] text-[#4A5263]">{t("In Plenary inbox")}</p><p className="m-0 font-serif text-[26px]">{shown.inbox != null ? shown.inbox.toLocaleString(t.intl) : "100%"}</p></div>
          </div>
          {!emailOn ? <p className={`${ui.warn} mt-3`}>{t("Email sending isn’t configured, so letters went to Plenary inboxes only.")}</p> : null}
          <p className="m-0 mt-3 text-[13px] text-[#4A5263]">{t("Changing a decision now needs owner approval and sends a new letter explaining the change (F5). Final versions open for accepted papers.")}</p>
          <Link href={`/manage/${slug}`} className="mt-2 inline-block text-[14px]">{t("Dashboard")} →</Link>
        </section>
      ) : null}

      {groups.length ? (
        <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
          <section className="overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
            <h2 className="m-0 border-b border-[#DADDE3] px-4 py-3 text-[16px] font-semibold">{t("Letters by decision")}</h2>
            <ul className="m-0 list-none p-0">
              {groups.map((x, i) => {
                const on = g === i, bad = x.previews.some((y) => y.missing.length);
                return (
                  <li key={x.decision}>
                    <button type="button" onClick={() => { setG(i); setPv(0); }} aria-current={on ? "true" : undefined} className="flex w-full items-start gap-2.5 border-0 border-b border-l-[3px] border-solid border-b-[#EEF0EC] px-4 py-3 text-left"
                      style={{ background: on ? "#F3F6FD" : "#FFFFFF", borderLeftColor: on ? "#2F5FD0" : "transparent" }}>
                      <span aria-hidden className="mt-1.5 size-2.5 flex-none rounded-full" style={{ background: DECISION_COLOR[x.decision] }} />
                      <span className="min-w-0 flex-auto"><span className="block text-[14px] font-semibold">{t(DECISION_LABEL[x.decision])}</span><span className="block text-[12px] text-[#4A5263]">{t("Template: {name}", { name: x.template })}</span></span>
                      <span className="text-right"><span className="block font-mono text-[14px] font-semibold">{x.count}</span><span className="block text-[11px]" style={{ color: bad ? "#B3261E" : "#14603F" }}>{bad ? t("Placeholders missing") : t("Placeholders filled ✓")}</span></span>
                    </button>
                  </li>
                );
              })}
              <li className="flex items-center gap-2.5 px-4 py-3">
                <span aria-hidden className="size-2.5 rounded-full bg-[#B7BDC9]" />
                <span className="flex-auto text-[14px] font-semibold">{t("Undecided")}</span>
                <span className="text-right"><span className="block font-mono text-[14px] font-semibold">{undecided}</span><span className="block text-[11px]" style={{ color: undecided ? "#B3261E" : "#14603F" }}>{undecided ? t("Blocks release") : t("None left ✓")}</span></span>
              </li>
            </ul>
          </section>

          <section className={ui.card}>
            {cur && p ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={ui.kicker}>{t("Preview · {g} · paper {a} of {b}", { g: t(DECISION_LABEL[cur.decision]), a: Math.min(pv, cur.previews.length - 1) + 1, b: cur.count })}</p>
                  <span className="flex gap-1">
                    <button type="button" aria-label={t("Previous letter")} disabled={pv === 0} onClick={() => setPv(pv - 1)} className="size-8 rounded-[4px] border border-[#B7BDC9] bg-white disabled:opacity-40">‹</button>
                    <button type="button" aria-label={t("Next letter")} disabled={pv >= cur.previews.length - 1} onClick={() => setPv(pv + 1)} className="size-8 rounded-[4px] border border-[#B7BDC9] bg-white disabled:opacity-40">›</button>
                  </span>
                </div>
                <p className="m-0 mt-3 text-[12px] text-[#4A5263]">{t("To")}: {p.to} · {p.paper}</p>
                <p className="m-0 mt-1 text-[16px] font-semibold">{p.subject}</p>
                <div className="mt-3 max-h-[420px] overflow-y-auto whitespace-pre-line rounded-[6px] border border-[#EEF0EC] bg-[#FBFBFA] p-4 text-[14px] leading-[1.55]">{p.text}</div>
                {p.missing.length ? <p className={`${ui.bad} mt-3`}>{t("Placeholders without a value: {list}. Fix the template before releasing (I5).", { list: p.missing.map((m) => `[${m}]`).join(", ") })}</p> : null}
                <p className="m-0 mt-3 text-[12px] text-[#4A5263]">{t("Reviews are included with comments to authors only — confidential comments to the editor are never included (F6).")}</p>
                {cur.count > cur.previews.length ? <p className="m-0 mt-1 text-[12px] text-[#4A5263]">{t("Showing the first {n} letters of this group.", { n: cur.previews.length })}</p> : null}
              </>
            ) : null}
          </section>
        </div>
      ) : !shown ? <p className={`${ui.card} m-0 text-[14px] text-[#4A5263]`}>{t("No drafted decisions yet. Draft them in the decision table first.")}</p> : null}

      {groups.length ? (
        <section className={ui.card}>
          <h2 className={ui.h2}>{t("Release")}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("Scope")}>
            {([["all", t("All decisions at once"), t("Every submission type")], ["type", t("By submission type"), t("Others can follow later")]] as const).map(([k, l, d]) => (
              <label key={k} className="flex cursor-pointer items-start gap-2.5 rounded-[6px] border px-3 py-2.5" style={{ borderColor: scope === k ? "#2F5FD0" : "#DADDE3", background: scope === k ? "#FBFCFF" : "#FFFFFF" }}>
                <input type="radio" name="scope" checked={scope === k} onChange={() => setScope(k)} disabled={k === "type" && types.length < 2} className="mt-1 accent-[#2F5FD0]" />
                <span><span className="block text-[14px] font-semibold">{l}</span><span className="block text-[12px] text-[#4A5263]">{d}</span></span>
              </label>
            ))}
          </div>
          {scope === "type" ? (
            <label className={`${ui.label} mt-3 max-w-[320px]`}>{t("Submission type")}
              <select value={type} onChange={(e) => setType(e.target.value)} className={ui.input}>{types.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            </label>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            <Check on={c1} set={setC1}>{t("I checked the previews and the undecided count is zero for this scope")}</Check>
            {large ? <Check on={c2} set={setC2}>{t("Send {n} emails — I confirm this second time", { n: total.toLocaleString(t.intl) })} <span className="block text-[12px] text-[#4A5263]">{t("Required for sends over 500 recipients (I3)")}</span></Check> : null}
          </div>
          {missing ? <p className={`${ui.warn} mt-3`}>{t("Some letters have placeholders without a value. Check the previews.")}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" disabled={!ok || pending} onClick={release} className="inline-flex h-[46px] items-center rounded-[4px] px-[22px] text-[15px] font-semibold disabled:cursor-not-allowed"
              style={{ background: ok ? "#F2A93B" : "#E7E9EE", color: ok ? "#0E1B3D" : "#6B7280" }}>{pending ? t("Releasing…") : t("Release {n} decisions", { n: total.toLocaleString(t.intl) })}</button>
            <button type="button" disabled={pending} onClick={test} className={ui.ghost}>{t("Send test letters to me")}</button>
            <span className="text-[13px] font-semibold" style={{ color: ok ? "#14603F" : "#B3261E" }}>{status}</span>
          </div>
          {msg ? <p role="status" className={`${msg.ok ? ui.ok : ui.warn} mt-3`}>{msg.text}</p> : null}
        </section>
      ) : msg ? <p role="status" className={`${msg.ok ? ui.ok : ui.warn} m-0`}>{msg.text}</p> : null}
    </div>
  );
}
