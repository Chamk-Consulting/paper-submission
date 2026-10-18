"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { lookupPerson, saveAuthors, type ActionState } from "@/lib/submission/actions";
import { card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { useT } from "@/lib/i18n/client";

export type Row = { key: string; personId?: string; email?: string; givenName?: string; familyName?: string; name: string; institution: string | null; sub: string; corresponding: boolean; isYou: boolean; invite: boolean };

const initials = (n: string) => n.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

/** SB03: ordered author list + add a co-author. */
export function AuthorsForm({ id, initial }: { id: string; initial: Row[] }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAuthors, {});
  const [rows, setRows] = useState<Row[]>(initial);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [newPerson, setNewPerson] = useState<{ email: string; givenName: string; familyName: string; institution: string } | null>(null);
  const [looking, startLook] = useTransition();

  const move = (i: number, d: -1 | 1) => setRows((r) => { const n = r.slice(); [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const remove = (i: number) => setRows((r) => { const n = r.filter((_, k) => k !== i); if (!n.some((x) => x.corresponding) && n[0]) n[0] = { ...n[0], corresponding: true }; return n; });
  const setCorr = (i: number) => setRows((r) => r.map((x, k) => ({ ...x, corresponding: k === i })));

  function find() {
    const query = q.trim();
    setMsg(null);
    if (!query) return;
    startLook(async () => {
      const r = await lookupPerson(query);
      if (r.error) { setMsg(t(r.error)); return; }
      if (r.found) {
        if (rows.some((x) => x.personId === r.found!.personId)) { setMsg(t("{name} is already on the list.", { name: r.found.name })); return; }
        setRows((rs) => [...rs, { key: r.found!.personId, personId: r.found!.personId, name: r.found!.name, institution: r.found!.institution, sub: [r.found!.institution, r.found!.plenaryId].filter(Boolean).join(" · "), corresponding: false, isYou: false, invite: false }]);
        setQ("");
        return;
      }
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(query)) setNewPerson({ email: query.toLowerCase(), givenName: "", familyName: "", institution: "" });
      else setMsg(t("No one with that Plenary ID. Check it, or add them by email."));
    });
  }

  function addNew() {
    if (!newPerson) return;
    if (!newPerson.familyName.trim() && !newPerson.givenName.trim()) { setMsg(t("Enter their name.")); return; }
    if (rows.some((x) => x.email === newPerson.email)) { setMsg(t("That email is already on the list.")); return; }
    const name = `${newPerson.givenName} ${newPerson.familyName}`.trim();
    setRows((rs) => [...rs, { key: newPerson.email, email: newPerson.email, givenName: newPerson.givenName.trim(), familyName: newPerson.familyName.trim(), name, institution: newPerson.institution.trim() || null, sub: [newPerson.institution.trim(), newPerson.email].filter(Boolean).join(" · "), corresponding: false, isYou: false, invite: true }]);
    setNewPerson(null); setQ(""); setMsg(null);
  }

  const payload = JSON.stringify(rows.map((r) => (r.personId ? { personId: r.personId, corresponding: r.corresponding } : { email: r.email, givenName: r.givenName ?? "", familyName: r.familyName ?? "", institution: r.institution ?? undefined, corresponding: r.corresponding })));
  const iconBtn = "flex size-8 items-center justify-center rounded-[4px] border border-[#B7BDC9] bg-white text-[14px] disabled:opacity-35";
  const field = "h-11 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[15px]";

  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      <input type="hidden" name="authors" value={payload} />
      <section className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={h2}>{t("Authors")}</h2>
          <span className="text-[14px] text-[#4A5263]">{t(rows.length === 1 ? "{n} author · in the order they appear on the paper" : "{n} authors · in the order they appear on the paper", { n: rows.length })}</span>
        </div>
        <ol className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
          {rows.map((r, i) => (
            <li key={r.key} className="flex flex-wrap items-center gap-3 rounded-[8px] sm:flex-nowrap border border-[#DADDE3] px-3.5 py-3" style={{ background: r.isYou ? "#F7F9FE" : "#FFFFFF" }}>
              <span className="w-4 font-mono text-[14px] text-[#4A5263]">{i + 1}</span>
              <span aria-hidden className="flex size-9 flex-none items-center justify-center rounded-full text-[13px] font-semibold" style={{ background: r.isYou ? "#E6EDFC" : "#FBEFDD", color: r.isYou ? "#1F47A8" : "#7A4508" }}>{initials(r.name)}</span>
              <span className="min-w-0 flex-auto">
                <span className="flex flex-wrap items-center gap-2 font-semibold">{r.name}
                  {r.isYou ? <span className="rounded-[2px] bg-[#E6EDFC] px-1.5 font-mono text-[11px] font-medium text-[#1F47A8]">{t("YOU")}</span> : null}
                  {r.invite ? <span className="rounded-[2px] bg-[#FBEFDD] px-1.5 font-mono text-[11px] font-medium text-[#7A4508]">{t("INVITE ON SUBMIT")}</span> : null}
                </span>
                <span className="block truncate text-[14px] text-[#4A5263]">{r.sub || "—"}</span>
              </span>
              <label className="flex flex-none items-center gap-2 whitespace-nowrap text-[14px]">
                <input type="radio" name="corr" checked={r.corresponding} onChange={() => setCorr(i)} className="size-[18px] accent-[#0E1B3D]" />{t("Corresponding")}
              </label>
              <span className="flex flex-none gap-1.5">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("Move {name} up", { name: r.name })} className={iconBtn}>↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={t("Move {name} down", { name: r.name })} className={iconBtn}>↓</button>
                <button type="button" onClick={() => remove(i)} disabled={r.isYou} aria-label={t("Remove {name}", { name: r.name })} className={`${iconBtn} text-[#B3261E]`}>×</button>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("Add a co-author")}</h2>
        <label htmlFor="sb3-q" className="mt-4 block font-medium">{t("Email or Plenary ID")}</label>
        <div className="mt-1.5 flex gap-2">
          <input id="sb3-q" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); find(); } }} placeholder="colleague@uni.edu · PL-1234-5678" className={`${field} h-12 flex-auto text-[16px]`} />
          <button type="button" onClick={find} disabled={looking} className="h-12 rounded-[4px] bg-[#0E1B3D] px-4 text-[15px] font-semibold text-white disabled:opacity-60">{looking ? t("Finding…") : t("Add")}</button>
        </div>
        {msg ? <p role="status" className="mt-2 text-[14px] text-[#7A4508]">{msg}</p> : <p className="mt-2 text-[14px] text-[#4A5263]">{t("People with a Plenary account are found by email or ID. Anyone else gets an invitation when you submit.")}</p>}
        {newPerson ? (
          <div className="mt-3 rounded-[8px] border border-[#F1D29A] bg-[#FFF6E6] p-4">
            <p className="m-0 text-[14px] text-[#3B2A07]"><strong>{newPerson.email}</strong> {t("isn't on Plenary yet. Add their name — they'll be invited to confirm when you submit.")}</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <label className="text-[14px] font-medium">{t("Given name")}<input value={newPerson.givenName} onChange={(e) => setNewPerson({ ...newPerson, givenName: e.target.value })} className={`${field} mt-1`} /></label>
              <label className="text-[14px] font-medium">{t("Family name")}<input value={newPerson.familyName} onChange={(e) => setNewPerson({ ...newPerson, familyName: e.target.value })} className={`${field} mt-1`} /></label>
              <label className="text-[14px] font-medium sm:col-span-2">{t("Institution")} <span className="font-normal text-[#4A5263]">{t("(used for conflicts)")}</span><input value={newPerson.institution} onChange={(e) => setNewPerson({ ...newPerson, institution: e.target.value })} className={`${field} mt-1`} /></label>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={addNew} className="h-10 rounded-[4px] bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white">{t("Add co-author")}</button>
              <button type="button" onClick={() => setNewPerson(null)} className="h-10 rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[14px]">{t("Cancel")}</button>
            </div>
          </div>
        ) : null}
      </section>

      {state.error ? <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{t(state.error)}</p> : null}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] pt-6">
        <div className="flex gap-2">
          <Link href={`/submissions/${id}/details`} className={ghostBtn}>{t("← Back")}</Link>
          <button type="submit" name="intent" value="exit" className={`${ghostBtn} hidden sm:inline-flex`}>{t("Save and exit")}</button>
        </div>
        <button type="submit" name="intent" value="next" disabled={pending || !rows.length} className={primaryBtn}>{pending ? t("Saving…") : t("Continue to keywords →")}</button>
      </div>
    </form>
  );
}
