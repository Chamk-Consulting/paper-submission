"use client";

import { RowMenu } from "@/components/manage/row-menu";
import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { FieldError } from "@/components/manage/save-bar";
import { logOrganizerEvent, messagePerson } from "@/lib/manage/setup2-actions";
import type { ManageState } from "@/lib/manage/actions-util";
import { RoleTag } from "@/components/manage/setup2/committee";

export type PersonRow = { id: string; name: string; plenaryId: string | null; email: string | null; institution: string | null; roles: string[]; papers: number; reviews: number; you: boolean };
type F = "all" | "aes" | "reviewers" | "authors" | "session" | "staff";
const TEST: Record<F, (p: PersonRow) => boolean> = {
  all: () => true,
  aes: (p) => p.roles.includes("associate_editor"),
  reviewers: (p) => p.roles.includes("reviewer") || p.reviews > 0,
  authors: (p) => p.roles.includes("author") || p.papers > 0,
  session: (p) => p.roles.includes("session_chair"),
  staff: (p) => p.roles.includes("staff"),
};

export function csv(rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}
export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PeopleTable({ slug, rows, canMessage, canViewAs }: { slug: string; label?: string; rows: PersonRow[]; canMessage: boolean; canViewAs: boolean }) {
  const t = useT();
  const [f, setF] = useState<F>("all");
  const [q, setQ] = useState("");
  const [msgTo, setMsgTo] = useState<PersonRow | null>(null);
  const [, start] = useTransition();
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(TEST[f]).filter((p) => !needle || [p.name, p.email, p.institution, p.plenaryId].some((x) => x?.toLowerCase().includes(needle)));
  }, [rows, f, q]);
  const filters: [F, string][] = [["all", "Everyone"], ["aes", "AEs"], ["reviewers", "Reviewers"], ["authors", "Authors"], ["session", "Session chairs"], ["staff", "Staff"]];
  const exportCsv = () => {
    download(`${slug}-people.csv`, csv([["Name", t("Plenary ID"), "Email", "Institution", "Roles", "Papers", "Reviews"], ...shown.map((p) => [p.name, p.plenaryId, p.email, p.institution, p.roles.join(" "), p.papers, p.reviews])]));
    start(async () => { await logOrganizerEvent(slug, "data.export", { what: "people", rows: shown.length, filter: f }); });
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t("Filter")} className="flex flex-wrap gap-2">
          {filters.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)} className="h-8 rounded-full px-3 text-[13px] font-medium"
              style={{ background: f === k ? "#0E1B3D" : "#fff", color: f === k ? "#F5F6F3" : "#4A5263", border: `1px solid ${f === k ? "#0E1B3D" : "#DADDE3"}` }}>
              {t(l)} · {rows.filter(TEST[k]).length}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <input type="search" aria-label={t("Search people")} placeholder={t("Name, email, institution")} value={q} onChange={(e) => setQ(e.target.value)} className={`${ui.input} mt-0! h-9! w-[240px]`} />
          <Link href={`/manage/${slug}/setup/committee#invite`} className={ui.ghost}>+ {t("Invite")}</Link>
          <button type="button" onClick={exportCsv} className={ui.ghost}>{t("Export")}</button>
        </div>
      </div>


      <section className={`${ui.card} mt-4`}>
        <div className="overflow-x-auto">
          <table className={`${ui.table} min-w-[680px]`}>
            <thead><tr><th className={ui.th}>{t("Person")}</th><th className={ui.th}>{t("Roles at this event")}</th><th className={ui.th}>{t("Activity")}</th><th className={ui.th}><span className="sr-only">{t("Actions")}</span></th></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td className={ui.td}>
                    <div className="font-semibold">{p.name}{p.you ? ` (${t("you")})` : ""}</div>
                    <div className="text-[13px] text-[#4A5263]">{[p.institution, p.email].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td className={ui.td}><div className="flex flex-wrap gap-1">{p.roles.map((r) => <RoleTag key={r} role={r} />)}</div></td>
                  <td className={`${ui.td} text-[13px] text-[#4A5263]`}>
                    {[p.papers ? t("{n} papers", { n: p.papers }) : null, p.reviews ? t("{n} reviews", { n: p.reviews }) : null].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className={`${ui.td} whitespace-nowrap text-right`}>
                    {p.you ? null : (
                      <RowMenu label={p.name} actions={[
                        ...(canViewAs ? [{ label: t("View as"), href: `/manage/${slug}/people/${p.id}/view` }] : []),
                        ...(canMessage ? [{ label: t("Message"), onClick: () => setMsgTo(p) }] : []),
                      ]} />
                    )}
                  </td>
                </tr>
              ))}
              {!shown.length ? <tr><td colSpan={4} className={`${ui.td} text-[#4A5263]`}>{t("Nobody matches.")}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <p className={`${ui.hint} mt-3`}>{t("Removing a role keeps the person's work (A7). Exports are logged (J3).")}</p>
      {msgTo ? <MessageDialog slug={slug} to={msgTo} onClose={() => setMsgTo(null)} /> : null}
    </>
  );
}

function MessageDialog({ slug, to, onClose }: { slug: string; to: PersonRow; onClose: () => void }) {
  const t = useT();
  const [state, action, pending] = useActionState<ManageState, FormData>(messagePerson, {});
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <dialog ref={(el) => { ref.current = el; if (el && !el.open) el.showModal(); }} onClose={onClose} aria-labelledby="msg-title"
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-[10px] border border-[#DADDE3] p-0 backdrop:bg-[#0E1B3D]/40">
      <form action={action} className="p-6">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="person" value={to.id} />
        <h2 id="msg-title" className={ui.h2}>{t("Message {name}", { name: to.name })}</h2>
        <p className={`${ui.hint} mt-1`}>{t("Goes to their Plenary inbox and by email.")}</p>
        {state.ok ? (
          <p role="status" className={`${ui.ok} mt-4`}>{t(state.info ?? "Message sent.")}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <label className={ui.label}>{t("Subject")}<input name="subject" className={ui.input} maxLength={200} autoFocus /><FieldError state={state} name="subject" /></label>
            <label className={ui.label}>{t("Message")}<textarea name="body" rows={6} className={ui.textarea} maxLength={8000} /><FieldError state={state} name="body" /></label>
            {state.error ? <p role="alert" className={ui.bad}>{t(state.error)}</p> : null}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => ref.current?.close()} className={ui.ghost}>{state.ok ? t("Close") : t("Cancel")}</button>
          {!state.ok ? <button type="submit" disabled={pending} className={ui.navy}>{t("Send")}</button> : null}
        </div>
      </form>
    </dialog>
  );
}
