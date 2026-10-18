"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useT } from "@/lib/i18n/client";
import { INTL } from "@/lib/i18n/config";
import { ui } from "@/components/manage/ui";
import { logOrganizerEvent } from "@/lib/manage/setup2-actions";
import { csv, download } from "@/components/manage/setup2/people";

export type AuditRow = { id: string; at: string; action: string; actor: string; actedAs: string | null; rule: string | null; details: Record<string, unknown> | null };
type Type = "role" | "coi" | "date" | "dec" | "view" | "mail" | "exp" | "other";

export function auditType(action: string): Type {
  if (action.startsWith("role.") || action.startsWith("member.") || action.startsWith("invitation.")) return "role";
  if (action.includes("conflict") || action.includes("override")) return "coi";
  if (action.startsWith("deadline.") || action.startsWith("date")) return "date";
  if (action.startsWith("decision.")) return "dec";
  if (action.startsWith("view_as.")) return "view";
  if (action.includes("email") || action.includes("campaign") || action.includes("message")) return "mail";
  if (action === "data.export") return "exp";
  return "other";
}
const TAG: Record<Type, [string, string, string]> = {
  role: ["ROLE CHANGE", "#E6EDFC", "#1F47A8"], coi: ["CONFLICT", "#FBE4E2", "#B3261E"], date: ["DEADLINE", "#FBEFDD", "#7A4508"],
  dec: ["DECISION", "#E1F3EA", "#14603F"], view: ["VIEW AS", "#EEF0EC", "#4A5263"], mail: ["BULK EMAIL", "#E6EDFC", "#1F47A8"],
  exp: ["DATA EXPORT", "#FBEFDD", "#7A4508"], other: ["OTHER", "#EEF0EC", "#4A5263"],
};
const FILTERS: [Type | "all", string][] = [["all", "All"], ["role", "Roles"], ["coi", "Conflicts"], ["date", "Deadlines"], ["dec", "Decisions"], ["view", "View as"], ["mail", "Bulk email"], ["exp", "Exports"]];

function describe(r: AuditRow) {
  const d = r.details ?? {};
  const bits = Object.entries(d).filter(([, v]) => v != null && typeof v !== "object").slice(0, 4).map(([k, v]) => `${k}: ${String(v)}`);
  return bits.length ? `${r.action} — ${bits.join(", ")}` : r.action;
}

export function AuditTable({ slug, rows, roleLabels }: { slug: string; rows: AuditRow[]; roleLabels: Record<string, string> }) {
  const t = useT();
  const locale = useLocale();
  const [f, setF] = useState<Type | "all">("all");
  const [, start] = useTransition();
  const typed = useMemo(() => rows.map((r) => ({ ...r, type: auditType(r.action) })), [rows]);
  const shown = typed.filter((r) => f === "all" || r.type === f);
  const fmt = new Intl.DateTimeFormat(INTL[locale], { dateStyle: "medium", timeStyle: "short" });
  const exportCsv = () => {
    download(`${slug}-audit.csv`, csv([["When (UTC)", "Type", "Who", "Acting as", "What", "Rule"], ...shown.map((r) => [r.at, TAG[r.type][0], r.actor, r.actedAs, describe(r), r.rule])]));
    start(async () => { await logOrganizerEvent(slug, "data.export", { what: "audit", rows: shown.length, filter: f }); });
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t("Filter")} className="flex flex-wrap gap-2">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)} className="h-8 rounded-full px-3 text-[13px] font-medium"
              style={{ background: f === k ? "#0E1B3D" : "#fff", color: f === k ? "#F5F6F3" : "#4A5263", border: `1px solid ${f === k ? "#0E1B3D" : "#DADDE3"}` }}>
              {t(l)} · {k === "all" ? typed.length : typed.filter((r) => r.type === k).length}
            </button>
          ))}
        </div>
        <button type="button" onClick={exportCsv} className={`${ui.ghost} ml-auto`}>{t("Export CSV")}</button>
      </div>
      <section className={`${ui.card} mt-4`}>
        <div className="overflow-x-auto">
          <table className={`${ui.table} min-w-[760px]`}>
            <thead><tr><th className={ui.th}>{t("When (local time)")}</th><th className={ui.th}>{t("Type")}</th><th className={ui.th}>{t("Who · as role")}</th><th className={ui.th}>{t("What")}</th><th className={ui.th}>{t("Rule")}</th></tr></thead>
            <tbody>
              {shown.map((r) => {
                const [label, bg, ink] = TAG[r.type];
                return (
                  <tr key={r.id}>
                    <td className={`${ui.td} whitespace-nowrap font-mono text-[13px]`}><time dateTime={r.at}>{fmt.format(new Date(r.at))}</time></td>
                    <td className={ui.td}><span className={ui.tag} style={{ background: bg, color: ink }}>{t(label)}</span></td>
                    <td className={ui.td}>{r.actor}{r.actedAs ? <span className="text-[#4A5263]"> · {t(roleLabels[r.actedAs] ?? r.actedAs)}</span> : null}</td>
                    <td className={`${ui.td} text-[14px]`}>{describe(r)}</td>
                    <td className={`${ui.td} font-mono text-[13px] text-[#2F5FD0]`}>{r.rule ?? "—"}</td>
                  </tr>
                );
              })}
              {!shown.length ? <tr><td colSpan={5} className={`${ui.td} text-[#4A5263]`}>{t("Nothing logged yet.")}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <p className={`${ui.hint} mt-3`}>{t("Kept for 7 years with the event records (J1). Only owners can read this log.")}</p>
    </>
  );
}
