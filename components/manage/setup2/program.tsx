"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { SaveBar } from "@/components/manage/save-bar";
import { saveProgramSetup } from "@/lib/manage/setup2-actions";
import type { ManageState } from "@/lib/manage/actions-util";
import { Stepper, Toggle } from "@/components/manage/setup2/committee";

export type Room = { id: string | null; name: string; seats: number | null; equipment: string };
export type Day = { date: string; label: string; note: string };
type Status = "not_started" | "in_progress" | "ready";

export function ProgramForm({ slug, rooms: r0, days: d0, fmt, status, last, canEdit }: {
  slug: string; rooms: Room[]; days: Day[];
  fmt: { minutes_per_paper: number; papers_per_session: number; parallel_sessions: number; poster_sessions: boolean; allow_remote: boolean };
  status: Status; last: { at: string | null; by: string | null }; canEdit: boolean;
}) {
  const t = useT();
  const [state, action] = useActionState<ManageState, FormData>(saveProgramSetup, {});
  const [rooms, setRooms] = useState(r0);
  const [days, setDays] = useState(d0);
  const [min, setMin] = useState(fmt.minutes_per_paper);
  const [per, setPer] = useState(fmt.papers_per_session);
  const [par, setPar] = useState(fmt.parallel_sessions);
  const setRoom = (i: number, p: Partial<Room>) => setRooms((x) => x.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const setDay = (i: number, p: Partial<Day>) => setDays((x) => x.map((d, j) => (j === i ? { ...d, ...p } : d)));
  const nextDay = () => {
    const last = days.at(-1)?.date;
    if (!last) return new Date().toISOString().slice(0, 10);
    const d = new Date(`${last}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rooms" value={JSON.stringify(rooms)} />
      <input type="hidden" name="days" value={JSON.stringify(days.filter((d) => d.date))} />
      <fieldset disabled={!canEdit} className="m-0 flex flex-col gap-5 border-0 p-0">
        <section className={ui.card}>
          <h2 className={ui.h2}>{t("Rooms")}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className={`${ui.table} min-w-[520px]`}>
              <thead><tr><th className={ui.th}>{t("Room")}</th><th className={ui.th}>{t("Seats")}</th><th className={ui.th}>{t("Equipment")}</th><th className={ui.th}><span className="sr-only">{t("Remove")}</span></th></tr></thead>
              <tbody>
                {rooms.map((r, i) => (
                  <tr key={r.id ?? `new-${i}`}>
                    <td className={ui.td}><input aria-label={t("Room")} value={r.name} onChange={(e) => setRoom(i, { name: e.target.value })} className={`${ui.input} mt-0!`} maxLength={80} /></td>
                    <td className={ui.td}><input aria-label={t("Seats")} type="number" min={1} value={r.seats ?? ""} onChange={(e) => setRoom(i, { seats: e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : null })} className={`${ui.input} mt-0! w-24`} /></td>
                    <td className={ui.td}><input aria-label={t("Equipment")} value={r.equipment} onChange={(e) => setRoom(i, { equipment: e.target.value })} className={`${ui.input} mt-0!`} maxLength={200} /></td>
                    <td className={`${ui.td} text-right`}><button type="button" onClick={() => setRooms((x) => x.filter((_, j) => j !== i))} className="border-0 bg-transparent p-0 text-[13px] text-[#B3261E] underline">{t("Remove")}</button></td>
                  </tr>
                ))}
                {!rooms.length ? <tr><td colSpan={4} className={`${ui.td} text-[#4A5263]`}>{t("No rooms yet.")}</td></tr> : null}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => setRooms((x) => [...x, { id: null, name: t("New room"), seats: 80, equipment: t("Projector") }])} className={`${ui.ghost} mt-3`}>+ {t("Add room")}</button>
        </section>

        <section className={ui.card}>
          <h2 className={ui.h2}>{t("Session format")}</h2>
          <div className="mt-2">
            <Stepper name="minutes_per_paper" value={min} onChange={setMin} min={10} max={40} disabled={!canEdit} label="Minutes per paper" hint="Talk + questions" />
            <Stepper name="papers_per_session" value={per} onChange={setPer} min={3} max={8} disabled={!canEdit} label="Papers per session" />
            <Stepper name="parallel_sessions" value={par} onChange={setPar} min={1} max={12} disabled={!canEdit} label="Parallel sessions" hint="At most one per room" />
            <Toggle name="poster_sessions" on={fmt.poster_sessions} label="Poster sessions" />
            <Toggle name="allow_remote" on={fmt.allow_remote} label="Allow remote presentations" />
          </div>
          {par > rooms.length && rooms.length ? <p className={`${ui.warn} mt-3`}>{t("More parallel sessions than rooms.")}</p> : null}
        </section>

        <section className={ui.card}>
          <h2 className={ui.h2}>{t("Days")}</h2>
          <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
            {days.map((d, i) => (
              <li key={i} className="grid gap-3 sm:grid-cols-[170px_1fr_1fr_auto] sm:items-end">
                <label className={ui.label}>{t("Date")}<input type="date" value={d.date} onChange={(e) => setDay(i, { date: e.target.value })} className={ui.input} /></label>
                <label className={ui.label}>{t("Label")}<input value={d.label} placeholder={t("e.g. Workshops")} onChange={(e) => setDay(i, { label: e.target.value })} className={ui.input} maxLength={80} /></label>
                <label className={ui.label}>{t("Note")}<input value={d.note} onChange={(e) => setDay(i, { note: e.target.value })} className={ui.input} maxLength={120} /></label>
                <button type="button" onClick={() => setDays((x) => x.filter((_, j) => j !== i))} className="h-11 border-0 bg-transparent p-0 text-[13px] text-[#B3261E] underline">{t("Remove")}</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setDays((x) => [...x, { date: nextDay(), label: "", note: "" }])} className={`${ui.ghost} mt-3`}>+ {t("Add day")}</button>
          <p className={`${ui.hint} mt-4`}>{t("The program builder opens after decisions. It checks clashes automatically (H2).")}</p>
        </section>
      </fieldset>
      <SaveBar state={state} status={status} last={last} readOnly={!canEdit} />
    </form>
  );
}
