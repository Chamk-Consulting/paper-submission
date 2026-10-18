"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/lib/i18n/client";
import { INTL } from "@/lib/i18n/config";
import { ui } from "@/components/manage/ui";
import { FieldError, SaveBar } from "@/components/manage/save-bar";
import { inviteCommittee, removeMember, revokeInvitation, saveConflictPolicy } from "@/lib/manage/setup2-actions";
import type { ManageState } from "@/lib/manage/actions-util";

export type CommitteeRow =
  | { kind: "member"; personId: string; name: string; institution: string | null; roles: string[]; load: string | null; papers: number; you: boolean }
  | { kind: "invite"; id: string; name: string; role: string; status: string; at: string };

export const ROLE_TAG: Record<string, [string, string, string]> = {
  owner: ["Owner", "#0E1B3D", "#F2A93B"],
  chair: ["General chair", "#E1F3EA", "#14603F"],
  program_chair: ["Program chair", "#E1F3EA", "#14603F"],
  deputy_chair: ["Deputy chair", "#FBEFDD", "#7A4508"],
  ceb_chair: ["CEB chair", "#E1F3EA", "#14603F"],
  associate_editor: ["Assoc. editor", "#E6EDFC", "#1F47A8"],
  publication_chair: ["Publication", "#EEF0EC", "#4A5263"],
  registration_chair: ["Registration", "#EEF0EC", "#4A5263"],
  staff: ["Staff", "#EEF0EC", "#4A5263"],
  session_chair: ["Session chair", "#E1F3EA", "#14603F"],
  reviewer: ["Reviewer", "#FBEFDD", "#7A4508"],
  author: ["Author", "#EEF0EC", "#4A5263"],
};
const CHAIRS = ["owner", "chair", "program_chair", "deputy_chair", "ceb_chair"];
const INVITE_OPTIONS: [string, string][] = [
  ["associate_editor", "Associate editor"], ["deputy_chair", "Deputy chair"], ["program_chair", "Program chair"], ["ceb_chair", "CEB chair"],
  ["publication_chair", "Publication chair"], ["registration_chair", "Registration chair"], ["staff", "Staff · check-in"],
  ["reviewer", "Reviewer"], ["session_chair", "Session chair"],
];
type Filter = "all" | "chairs" | "aes" | "waiting" | "other";

export function RoleTag({ role }: { role: string }) {
  const t = useT();
  const [label, bg, ink] = ROLE_TAG[role] ?? [role, "#EEF0EC", "#4A5263"];
  return <span className={ui.tag} style={{ background: bg, color: ink }}>{t(label)}</span>;
}

export function CommitteeList({ slug, rows, canGrant }: { slug: string; rows: CommitteeRow[]; canGrant: boolean }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [f, setF] = useState<Filter>("all");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const isChair = (r: CommitteeRow) => r.kind === "member" && r.roles.some((x) => CHAIRS.includes(x));
  const isAE = (r: CommitteeRow) => r.kind === "member" && r.roles.includes("associate_editor");
  const test: Record<Filter, (r: CommitteeRow) => boolean> = {
    all: () => true,
    chairs: isChair,
    aes: isAE,
    waiting: (r) => r.kind === "invite",
    other: (r) => r.kind === "member" && !isChair(r) && !isAE(r),
  };
  const members = rows.filter((r) => r.kind === "member").length;
  const waiting = rows.filter((r) => r.kind === "invite" && r.status === "pending").length;
  const filters: [Filter, string][] = [["all", "All"], ["chairs", "Chairs"], ["aes", "Associate editors"], ["waiting", "Waiting"], ["other", "Other"]];
  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (r.error) setErr(r.error);
      else router.refresh();
    });
  return (
    <section className={ui.card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={ui.h2}>{t("Committee")}</h2>
        <span className="text-[14px] text-[#4A5263]">{t("{a} of {b} accepted", { a: members, b: members + waiting })}</span>
      </div>
      <div role="group" aria-label={t("Filter")} className="mt-3.5 flex flex-wrap gap-2">
        {filters.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)} className="h-8 rounded-full px-3 text-[13px] font-medium"
            style={{ background: f === k ? "#0E1B3D" : "#fff", color: f === k ? "#F5F6F3" : "#4A5263", border: `1px solid ${f === k ? "#0E1B3D" : "#DADDE3"}` }}>
            {t(label)} · {rows.filter(test[k]).length}
          </button>
        ))}
      </div>
      {err ? <p role="alert" className={`${ui.bad} mt-3`}>{t(err)}</p> : null}
      <div className="mt-3.5 overflow-x-auto">
        <table className={`${ui.table} min-w-[640px]`}>
          <thead>
            <tr>
              <th className={ui.th}>{t("Person")}</th><th className={ui.th}>{t("Role")}</th><th className={ui.th}>{t("Load")}</th>
              <th className={ui.th}>{t("Status")}</th><th className={ui.th}><span className="sr-only">{t("Actions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.filter(test[f]).map((r) => r.kind === "member" ? (
              <tr key={`m-${r.personId}`}>
                <td className={ui.td}>
                  <div className="font-semibold">{r.name}{r.you ? ` (${t("you")})` : ""}</div>
                  <div className="text-[13px] text-[#4A5263]">{r.institution ?? "—"}</div>
                </td>
                <td className={ui.td}><div className="flex flex-wrap gap-1">{r.roles.map((x) => <RoleTag key={x} role={x} />)}</div></td>
                <td className={`${ui.td} font-mono text-[13px] text-[#4A5263]`}>
                  {r.load ?? (r.papers && isChair(r) ? t("{n} paper (B2)", { n: r.papers }) : r.roles.includes("staff") ? t("Check-in only (A5)") : "—")}
                </td>
                <td className={ui.td}><span className="text-[#14603F]">{t("Active")}</span></td>
                <td className={`${ui.td} text-right`}>
                  {canGrant && !r.you ? r.roles.map((x) => (
                    <button key={x} type="button" disabled={pending}
                      onClick={() => { if (confirm(t("Remove this role? Their work stays (A7)."))) act(() => removeMember(slug, r.personId, x)); }}
                      className="ml-2 border-0 bg-transparent p-0 text-[13px] text-[#B3261E] underline">
                      {t("Remove {role}", { role: t(ROLE_TAG[x]?.[0] ?? x) })}
                    </button>
                  )) : null}
                </td>
              </tr>
            ) : (
              <tr key={`i-${r.id}`}>
                <td className={ui.td}><div className="font-semibold">{r.name}</div></td>
                <td className={ui.td}><RoleTag role={r.role} /></td>
                <td className={`${ui.td} text-[#4A5263]`}>—</td>
                <td className={ui.td}>
                  {r.status === "pending"
                    ? <span className="text-[#7A4508]">{t("Invited {date}", { date: new Date(r.at).toLocaleDateString(INTL[locale], { day: "numeric", month: "short" }) })}</span>
                    : <span className="text-[#B3261E]">{t(r.status === "declined" ? "Declined" : "Expired")}</span>}
                </td>
                <td className={`${ui.td} text-right`}>
                  {canGrant && r.status === "pending" ? (
                    <button type="button" disabled={pending} onClick={() => act(() => revokeInvitation(slug, r.id))}
                      className="border-0 bg-transparent p-0 text-[13px] text-[#B3261E] underline">{t("Withdraw invitation")}</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function InviteForm({ slug, canGrant }: { slug: string; canGrant: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<ManageState, FormData>(inviteCommittee, {});
  return (
    <section id="invite" className={ui.card}>
      <h2 className={ui.h2}>{t("Invite people")}</h2>
      {!canGrant ? <p className={`${ui.hint} mt-2`}>{t("Only owners and program chairs grant roles (A3).")}</p> : (
        <form action={action} className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <input type="hidden" name="slug" value={slug} />
          <label className={ui.label}>{t("Emails or Plenary IDs")}
            <input name="recipients" placeholder={t("one or more, separated by commas")} className={ui.input} />
            <FieldError state={state} name="recipients" />
          </label>
          <label className={ui.label}>{t("Role")}
            <select name="role" defaultValue="associate_editor" className={ui.input}>
              {INVITE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
            </select>
          </label>
          <button type="submit" disabled={pending} className={ui.navy}>{pending ? t("Sending…") : t("Send invitation")}</button>
          <div className="sm:col-span-3" role="status">
            {state.error ? <p className={ui.bad}>{t(state.error)}</p> : state.ok ? (
              <p className={ui.ok}>{t("Invitation sent. The role starts when they accept (A3).")}{state.info ? <span className="text-[#4A5263]"> · {state.info}</span> : null}</p>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}

type Status = "not_started" | "in_progress" | "ready";
type Last = { at: string | null; by: string | null };

export function Stepper({ name, value, onChange, min, max, label, hint, disabled }: {
  name: string; value: number; onChange: (n: number) => void; min: number; max: number; label: string; hint?: string; disabled?: boolean;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#EEF0EC] py-3">
      <span><span className="block font-medium">{t(label)}</span>{hint ? <span className={ui.hint}>{t(hint)}</span> : null}</span>
      <span className="flex flex-none items-center gap-2">
        <input type="hidden" name={name} value={value} />
        <button type="button" aria-label={`${t("Decrease")} — ${t(label)}`} disabled={disabled || value <= min} onClick={() => onChange(value - 1)}
          className="size-9 rounded-[4px] border border-[#B7BDC9] bg-white text-[16px] disabled:opacity-40">−</button>
        <span className="w-8 text-center font-mono text-[16px]" aria-live="polite">{value}</span>
        <button type="button" aria-label={`${t("Increase")} — ${t(label)}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}
          className="size-9 rounded-[4px] border border-[#B7BDC9] bg-white text-[16px] disabled:opacity-40">+</button>
      </span>
    </div>
  );
}

export function Toggle({ name, on, label, hint, locked, disabled }: { name: string; on: boolean; label: string; hint?: string; locked?: boolean; disabled?: boolean }) {
  const t = useT();
  return (
    <label className="flex items-center justify-between gap-4 border-b border-[#EEF0EC] py-3 last:border-0">
      <span><span className="block font-medium">{t(label)}</span>{hint ? <span className={ui.hint}>{t(hint)}</span> : null}</span>
      <input type="checkbox" name={name} defaultChecked={on} disabled={locked || disabled} className="size-5 flex-none accent-[#18744F]" />
    </label>
  );
}

export function PolicyForm({ slug, v, status, last, canEdit }: {
  slug: string; v: { coauthor_years: number; institution_years: number; use_declared: boolean; override_second: boolean };
  status: Status; last: Last; canEdit: boolean;
}) {
  const t = useT();
  const [state, action] = useActionState<ManageState, FormData>(saveConflictPolicy, {});
  const [co, setCo] = useState(v.coauthor_years);
  const [inst, setInst] = useState(v.institution_years);
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <section className={ui.card}>
        <h2 className={ui.h2}>{t("Conflict policy")}</h2>
        <div className="mt-2">
          <Stepper name="coauthor_years" value={co} onChange={setCo} min={1} max={10} disabled={!canEdit}
            label="Co-authorship window (years)" hint="Co-authored papers in this many years = conflict" />
          <Stepper name="institution_years" value={inst} onChange={setInst} min={0} max={10} disabled={!canEdit}
            label="Institution window (years)" hint="Same or former institution in this many years" />
          <Toggle name="supervisor" on label="Supervisor ↔ student is always a conflict" locked />
          <Toggle name="use_declared" on={v.use_declared} disabled={!canEdit} label="Use declared conflicts from profiles" />
          <Toggle name="override_second" on={v.override_second} disabled={!canEdit} label="Overrides need a second approver" hint="Rule B5 — recommended" />
        </div>
      </section>
      <SaveBar state={state} status={status} last={last} readOnly={!canEdit} />
    </form>
  );
}
