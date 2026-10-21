"use client";

import { useActionState, useMemo, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { saveDates } from "@/lib/manage/setup1-actions";
import { MILESTONES, aoeInstant, dateProblems, type MilestoneKey } from "@/lib/manage/setup1-shared";
import { ui } from "@/components/manage/ui";
import { SaveBar } from "@/components/manage/save-bar";
import { Rules } from "@/components/manage/setup1/bits";
import type { ManageState } from "@/lib/manage/actions-util";
import { weekdayDate } from "@/lib/venues/time";

/* EM04 — nine milestones stored as AoE; local time shown next to each; C6 order checked as you type and again on the server. */

const noop = () => () => {};
const useZone = () => useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);

export function DatesForm({ slug, initial, status, last, canEdit, opened }: {
  slug: string; initial: Partial<Record<MilestoneKey, { date: string; hard: boolean }>>;
  status: "not_started" | "in_progress" | "ready"; last: { at: string | null; by: string | null }; canEdit: boolean; opened: boolean;
}) {
  const t = useT();
  const zone = useZone();
  const [state, action] = useActionState<ManageState, FormData>(saveDates, {});
  const [values, setValues] = useState<Partial<Record<MilestoneKey, string>>>(() => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v!.date])));
  const problems = useMemo(() => dateProblems(values), [values]);
  const bad = new Set(problems.flatMap((p) => [p.a, p.b]));
  const name = (k: MilestoneKey) => t(MILESTONES.find((m) => m.key === k)!.label);
  const local = (k: MilestoneKey) => {
    const d = values[k];
    if (!d || !zone) return "—";
    const m = MILESTONES.find((x) => x.key === k)!;
    const x = new Date(aoeInstant(d, m.startOfDay));
    return `${weekdayDate(x, t.intl, { timeZone: zone })}, ${x.toLocaleTimeString(t.intl, { timeZone: zone, hour: "2-digit", minute: "2-digit" })}`;
  };
  const city = zone?.split("/").pop()?.replace(/_/g, " ");
  const timeline = MILESTONES.filter((m) => values[m.key]).sort((a, b) => (values[a.key]! < values[b.key]! ? -1 : 1));
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col items-start gap-6 xl:flex-row">
        <div className="flex w-full min-w-0 flex-auto flex-col gap-5">
          <section className={ui.card}>
            <h2 className={ui.h2}>{t("Deadlines")}</h2>
            <p className="mb-0 mt-1 text-[14px] text-[#4A5263]">{t("Stored in AoE (UTC−12). Everyone also sees their own time (C1). Hard deadlines close the system at that minute (C2).")}</p>
            <div className="mt-4 overflow-x-auto">
              <table className={ui.table}>
                <thead><tr>
                  <th className={ui.th}>{t("Milestone")}</th><th className={ui.th}>{t("Date (AoE, 23:59)")}</th><th className={ui.th}>{t("Hard?")}</th>
                  <th className={`${ui.th} hidden md:table-cell`}>{city ? t("Your time ({city})", { city }) : t("Your time")}</th>
                </tr></thead>
                <tbody>
                  {MILESTONES.map((m) => (
                    <tr key={m.key} className={bad.has(m.key) ? "bg-[#FDECEA]" : undefined}>
                      <td className={ui.td}><label htmlFor={`d_${m.key}`} className="font-semibold">{t(m.label)}</label><span className="block text-[13px] text-[#4A5263]">{t(m.note)}{m.startOfDay ? ` · ${t("00:00 AoE")}` : ""}</span></td>
                      <td className={ui.td}>
                        <input id={`d_${m.key}`} name={`d_${m.key}`} type="date" disabled={!canEdit} value={values[m.key] ?? ""} aria-invalid={bad.has(m.key) || !!fe[m.key]}
                          onChange={(e) => setValues((v) => ({ ...v, [m.key]: e.target.value }))} className={`${ui.input} w-[170px] ${bad.has(m.key) ? "border-[#B3261E]" : ""}`} />
                        {fe[m.key] ? <span className="block text-[13px] text-[#B3261E]">{t(fe[m.key])}</span> : null}
                      </td>
                      <td className={ui.td}>
                        <label className="inline-flex cursor-pointer items-center gap-2 text-[14px]">
                          <input type="checkbox" role="switch" name={`h_${m.key}`} defaultChecked={initial[m.key]?.hard ?? m.hard} disabled={!canEdit} className="peer sr-only" />
                          <span aria-hidden className="relative h-6 w-[42px] rounded-full bg-[#B7BDC9] transition-colors after:absolute after:left-[3px] after:top-[3px] after:size-[18px] after:rounded-full after:bg-white after:shadow after:transition-[left] peer-checked:bg-[#18744F] peer-checked:after:left-[21px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[#2F5FD0]" />
                          <span className="peer-checked:hidden">{t("Soft")}</span><span className="hidden peer-checked:inline">{t("Hard")}</span>
                        </label>
                      </td>
                      <td className={`${ui.td} hidden whitespace-nowrap text-[13px] text-[#4A5263] md:table-cell`}>{local(m.key)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4" aria-live="polite">
              {problems.length ? (
                <div className={ui.bad}>
                  <strong>{t("{n} date problem(s).", { n: problems.length })}</strong>{" "}
                  {problems.map((p) => t("{a} must be before {b}.", { a: name(p.a), b: name(p.b) })).join(" ")}
                </div>
              ) : <div className={ui.ok}>{t("All dates are in order (C6).")}</div>}
            </div>
          </section>

          {timeline.length ? (
            <section className={ui.card}>
              <h2 className={ui.h2}>{t("Timeline")}</h2>
              <ol className="m-0 mt-4 flex list-none flex-col gap-0 border-l-2 border-[#DADDE3] p-0 pl-5">
                {timeline.map((m) => (
                  <li key={m.key} className="relative py-1.5">
                    <span aria-hidden className={`absolute -left-[27px] top-[11px] size-3 rounded-full border-2 border-white ${bad.has(m.key) ? "bg-[#B3261E]" : m.key === "paper_deadline" || m.key === "conference" ? "bg-[#F2A93B]" : "bg-[#0E1B3D]"}`} />
                    <span className="font-mono text-[12px] text-[#4A5263]">{new Date(`${values[m.key]}T12:00:00Z`).toLocaleDateString(t.intl, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>
                    <span className="ml-3 text-[14px] font-medium">{t(m.label)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className={ui.card}>
            <h2 className={ui.h2}>{t("Changing a date later")}</h2>
            <p className="mb-0 mt-2 text-[14px]">{t("After submissions open, moving a deadline notifies everyone it affects, updates calendar feeds, and shows the old date crossed out on the public page (C4). Deadlines can't move earlier once work has started (C5).")}</p>
            {opened ? <p className={`mb-0 mt-3 ${ui.warn}`}>{t("Submissions are open — use Deadlines & extensions on the dashboard to move a public date.")}</p> : null}
          </section>
        </div>
        <Rules rules={[["C1", "Stored in AoE; everyone sees local time too."], ["C2", "Hard closes the system; soft is shown only."], ["C3", "Phases run in a fixed order."], ["C4", "Extensions notify, update feeds, show old date."], ["C5", "No moving earlier once work started."], ["C6", "Dependent deadlines must stay in order."], ["C7", "Personal extensions never change public dates."]]} />
      </div>
      <SaveBar state={state} status={status} last={last} readOnly={!canEdit} />
    </form>
  );
}
