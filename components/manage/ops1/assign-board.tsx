"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { assignAE, suggestAll } from "@/lib/manage/ops1-actions";
import { paperId, topicMatch } from "@/lib/manage/ops1-shared";

/* EM22 — assign associate editors: unassigned papers on the left, AEs for the selected paper by topic match (E1, E2, B4). */

export type AssignPaper = { id: string; number: number | null; title: string; topic: string | null; aeId: string | null };
export type AssignAE = { personId: string; name: string; topics: string[]; load: number; cap: number };

export function AssignBoard({ slug, papers, aes, conflicts, canOverLimit }: { slug: string; papers: AssignPaper[]; aes: AssignAE[]; conflicts: string[]; canOverLimit: boolean }) {
  const t = useT();
  const router = useRouter();
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const list = papers.filter((p) => !p.aeId || touched.has(p.id));
  const [selId, setSel] = useState<string | null>(list[0]?.id ?? null);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad" | "warn"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const coi = new Set(conflicts);
  const sel = list.find((p) => p.id === selId) ?? list[0] ?? null;
  const left = list.filter((p) => !p.aeId).length;
  const aeName = (id: string | null) => aes.find((a) => a.personId === id)?.name ?? null;

  function assign(p: AssignPaper, a: AssignAE) {
    const over = a.load >= a.cap;
    start(async () => {
      const r = await assignAE({ slug, submission: p.id, ae: a.personId });
      if (r.error) { setMsg({ tone: "bad", text: t(r.error) }); return; }
      setTouched((s) => new Set(s).add(p.id));
      setMsg(over ? { tone: "warn", text: t("{name} is now over {cap} papers. This needs program-chair approval (E2) — you are PC, so it’s recorded in the audit log.", { name: a.name, cap: a.cap }) } : null);
      if (!over) { const nx = list.find((x) => !x.aeId && x.id !== p.id); if (nx) setSel(nx.id); }
      router.refresh();
    });
  }
  function auto() {
    start(async () => {
      const r = await suggestAll({ slug });
      if (r.error) { setMsg({ tone: "bad", text: t(r.error) }); return; }
      setTouched((s) => { const n = new Set(s); list.forEach((p) => n.add(p.id)); return n; });
      setMsg({ tone: r.info ? "warn" : "ok", text: [t("{n} papers assigned by topic match. Conflicts and full AEs were skipped.", { n: r.count ?? 0 }), r.info ? t(r.info) : ""].filter(Boolean).join(" ") });
      router.refresh();
    });
  }

  const ranked = sel ? aes.map((a) => ({ a, m: topicMatch(sel.topic, a.topics), c: coi.has(`${sel.id}:${a.personId}`) })).sort((x, y) => Number(x.c) - Number(y.c) || y.m - x.m || x.a.load - y.a.load) : [];

  return (
    <div className="flex flex-col gap-3">
      {msg ? <p role="status" className={`${msg.tone === "ok" ? ui.ok : msg.tone === "warn" ? ui.warn : ui.bad} m-0`}>{msg.text}</p> : null}
      <div className="grid items-start gap-4 lg:grid-cols-[400px_1fr]">
        <section className="overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-[#DADDE3] px-4 py-3">
            <h2 className="m-0 text-[16px] font-semibold">{t("Unassigned papers · {n}", { n: left })}</h2>
            <button type="button" disabled={pending || !left || !aes.length} onClick={auto} className={`${ui.navy} h-9! text-[13px]!`}>{t("Suggest all")}</button>
          </div>
          <ul className="m-0 max-h-[640px] list-none overflow-y-auto p-0">
            {list.map((p) => {
              const on = sel?.id === p.id;
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => { setSel(p.id); setMsg(null); }} aria-current={on ? "true" : undefined}
                    className="flex w-full flex-col gap-0.5 border-0 border-b border-l-[3px] border-solid border-b-[#EEF0EC] px-4 py-3 text-left"
                    style={{ background: on ? "#F3F6FD" : "#FFFFFF", borderLeftColor: on ? "#2F5FD0" : "transparent" }}>
                    <span className="font-mono text-[12px] text-[#4A5263]">{paperId(p.number)}</span>
                    <span className="text-[14px] font-semibold">{p.title}</span>
                    <span className="flex justify-between gap-2 text-[12px]"><span className="text-[#4A5263]">{p.topic ?? t("No topic")}</span>
                      <span style={{ color: p.aeId ? "#14603F" : "#A8600F" }}>{p.aeId ? aeName(p.aeId) ?? t("Assigned") : t("Unassigned")}</span></span>
                  </button>
                </li>
              );
            })}
            {!list.length ? <li className="px-4 py-8 text-center text-[14px] text-[#14603F]">✓ {t("Every paper has an associate editor.")}</li> : null}
          </ul>
        </section>

        <section className={ui.card}>
          {sel ? (
            <>
              <h2 className={ui.h2}>{t("Associate editors for {id}", { id: paperId(sel.number) })}</h2>
              <p className="m-0 mt-1 text-[13px] text-[#4A5263]">{sel.title} · {t("sorted by topic match")}</p>
              <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
                {ranked.map(({ a, m, c }) => {
                  const mine = sel.aeId === a.personId;
                  const full = a.load >= a.cap;
                  return (
                    <li key={a.personId} className="grid grid-cols-1 items-center gap-3 rounded-[6px] border border-[#EEF0EC] px-3.5 py-3 sm:grid-cols-[1fr_70px_170px_110px]" style={{ opacity: c ? 0.6 : 1 }}>
                      <div className="min-w-0"><p className="m-0 font-semibold">{a.name}</p><p className="m-0 truncate text-[12px] text-[#4A5263]">{a.topics.join(" · ") || t("No topics listed")}</p></div>
                      <span className="font-mono text-[14px] font-semibold" style={{ color: m >= 80 ? "#14603F" : m >= 50 ? "#121826" : "#9AA3B5" }}>{m}%</span>
                      <div>
                        <span className="block h-1.5 rounded-full bg-[#EEF0EC]"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (a.load / Math.max(1, a.cap)) * 100)}%`, background: full ? "#B3261E" : a.load >= a.cap * 0.8 ? "#F2A93B" : "#18744F" }} /></span>
                        <span className="text-[12px]" style={{ color: full ? "#B3261E" : "#4A5263" }}>{t("{a} / {b} papers", { a: a.load, b: a.cap })}</span>
                      </div>
                      {c ? <span className={ui.tag} style={{ background: "#FDECEA", color: "#B3261E" }}>{t("CONFLICT · B4")}</span> : (
                        <button type="button" disabled={pending || mine || (full && !canOverLimit)} onClick={() => assign(sel, a)}
                          className={`h-8 rounded-[4px] border px-3 text-[13px] font-semibold ${mine ? "border-[#B9E0CB] bg-[#E1F3EA] text-[#14603F]" : "border-[#B7BDC9] bg-white text-[#0E1B3D]"} disabled:cursor-default`}>
                          {mine ? t("Assigned ✓") : full && !canOverLimit ? t("At limit") : t("Assign")}
                        </button>
                      )}
                    </li>
                  );
                })}
                {!ranked.length ? <li className="text-[14px] text-[#4A5263]">{t("No associate editors yet. Invite them from Committee.")}</li> : null}
              </ul>
            </>
          ) : <p className="m-0 text-[14px] text-[#4A5263]">{t("Select a paper.")}</p>}
        </section>
      </div>
    </div>
  );
}
