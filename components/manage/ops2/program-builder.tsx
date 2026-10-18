"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { Act, FieldErr, StateLine, Submit } from "@/components/manage/ops2/act";
import { deleteSession, placeTalk, publishProgram, saveSession, unplaceTalk, type Ops2State } from "@/lib/manage/ops2-actions";
import { fmtDayLabel, paperNo, utcToZoned } from "@/lib/manage/ops2-time";

export type Room = { id: string; name: string; seats: number | null };
export type Talk = { id: string; submission_id: string | null; position: number; starts_at: string | null; talk_min: number; qa_min: number; presenter_id: string | null; presenter: string | null; number: number | null; title: string | null; attendance?: string; noshow_note?: string | null; noshow_decision?: string | null };
export type Session = { id: string; code: string; title: string; kind: string; room_id: string | null; starts_at: string; ends_at: string; chair_id: string | null; cochair_id: string | null; chair: string | null; live_status?: string; delay_min?: number; live_note?: string | null; talks: Talk[] };
export type PoolPaper = { submission_id: string; number: number; title: string; topic: string | null; decision: string | null; presenter_id: string | null; presenter: string | null; complete: boolean };
export type Clash = { kind: string; person_id: string | null; person: string | null; session_a: string; session_b: string };
export type Person = { person_id: string; display_name: string; roles: string[] };

const KINDS = ["oral", "poster", "keynote", "workshop", "break"] as const;
const KIND_LABEL: Record<string, string> = { oral: "Oral", poster: "Poster", keynote: "Keynote", workshop: "Workshop", break: "Break" };

function SessionForm({ slug, day, rooms, people, edit, onDone }: { slug: string; day: string; rooms: Room[]; people: Person[]; edit: (Session & { day: string; start: string; end: string }) | null; onDone: () => void }) {
  const t = useT();
  const [state, run] = useActionState<Ops2State, FormData>(async (p, fd) => { const r = await saveSession(p, fd); if (r.ok) onDone(); return r; }, {});
  const chairs = [...people].sort((a, b) => Number(b.roles.includes("session_chair")) - Number(a.roles.includes("session_chair")) || a.display_name.localeCompare(b.display_name));
  return (
    <form action={run} key={edit?.id ?? `new-${day}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={edit?.id ?? ""} />
      <label className={ui.label}>{t("Code")}<input name="code" defaultValue={edit?.code ?? ""} required placeholder="TuA1" className={ui.input} /><FieldErr state={state} name="code" /></label>
      <label className={`${ui.label} sm:col-span-2`}>{t("Session name")}<input name="title" defaultValue={edit?.title ?? ""} required placeholder={t("Robust control I")} className={ui.input} /><FieldErr state={state} name="title" /></label>
      <label className={ui.label}>{t("Kind")}<select name="kind" defaultValue={edit?.kind ?? "oral"} className={ui.input}>{KINDS.map((k) => <option key={k} value={k}>{t(KIND_LABEL[k])}</option>)}</select></label>
      <label className={ui.label}>{t("Room")}<select name="room" defaultValue={edit?.room_id ?? rooms[0]?.id ?? ""} className={ui.input}><option value="">{t("No room")}</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label className={ui.label}>{t("Day")}<input name="day" type="date" defaultValue={edit?.day ?? day} required className={ui.input} /><FieldErr state={state} name="day" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className={ui.label}>{t("Starts")}<input name="start" type="time" defaultValue={edit?.start ?? "10:30"} required className={ui.input} /></label>
        <label className={ui.label}>{t("Ends")}<input name="end" type="time" defaultValue={edit?.end ?? "12:30"} required className={ui.input} /><FieldErr state={state} name="end" /></label>
      </div>
      <label className={ui.label}>{t("Chair")}<select name="chair" defaultValue={edit?.chair_id ?? ""} className={ui.input}><option value="">{t("Not yet")}</option>{chairs.map((p) => <option key={p.person_id} value={p.person_id}>{p.display_name}</option>)}</select></label>
      <label className={ui.label}>{t("Co-chair")}<select name="cochair" defaultValue={edit?.cochair_id ?? ""} className={ui.input}><option value="">{t("None")}</option>{chairs.map((p) => <option key={p.person_id} value={p.person_id}>{p.display_name}</option>)}</select></label>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
        <Submit className={ui.navy} pendingLabel={t("Saving…")}>{edit ? t("Save session") : t("Add session")}</Submit>
        <button type="button" onClick={onDone} className={ui.ghost}>{t("Cancel")}</button>
        <StateLine state={state} />
      </div>
    </form>
  );
}

export function ProgramBuilder({ slug, tz, days, rooms, sessions, pool, clashes, people, perSession, publishedAt, canEdit }: {
  slug: string; tz: string; days: string[]; rooms: Room[]; sessions: Session[]; pool: PoolPaper[]; clashes: Clash[]; people: Person[];
  perSession: number; publishedAt: string | null; canEdit: boolean;
}) {
  const t = useT();
  const zoned = useMemo(() => sessions.map((s) => {
    const a = utcToZoned(s.starts_at, tz), b = utcToZoned(s.ends_at, tz);
    return { ...s, day: a.day, start: a.time, end: b.time, talks: s.talks.map((x) => ({ ...x, at: x.starts_at ? utcToZoned(x.starts_at, tz).time : "" })) };
  }), [sessions, tz]);
  const allDays = useMemo(() => [...new Set([...days, ...zoned.map((s) => s.day)])].sort(), [days, zoned]);
  const [day, setDay] = useState(allDays[0] ?? new Date().toISOString().slice(0, 10));
  const [pick, setPick] = useState<PoolPaper | null>(null);
  const [form, setForm] = useState<"closed" | "new" | string>("closed");
  const [pub, runPub] = useActionState<Ops2State, FormData>(publishProgram, {});
  const cur = pick && pool.some((p) => p.submission_id === pick.submission_id) ? pick : null;

  const today = zoned.filter((s) => s.day === day);
  const blocks = [...new Set(today.map((s) => `${s.start}–${s.end}`))].sort();
  const hasNoRoom = today.some((s) => !s.room_id);
  const cols = [...rooms.map((r) => ({ id: r.id as string | null, name: r.name, seats: r.seats })), ...(hasNoRoom ? [{ id: null, name: t("No room"), seats: null }] : [])];
  const clashSessions = new Set(clashes.flatMap((c) => [c.session_a, c.session_b]));
  const clashPeople = new Set(clashes.map((c) => c.person_id).filter(Boolean));
  const editing = form !== "closed" && form !== "new" ? zoned.find((s) => s.id === form) ?? null : null;
  const published = pub.ok || !!publishedAt;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t("Days")} className="flex flex-wrap gap-1.5">
          {allDays.map((d) => (
            <button key={d} role="tab" aria-selected={day === d} onClick={() => setDay(d)}
              className={`h-[34px] rounded-full border px-3.5 text-[13px] ${day === d ? "border-[#0E1B3D] bg-[#0E1B3D] text-white" : "border-[#B7BDC9] bg-white text-[#121826]"}`}>
              {fmtDayLabel(d, t.intl)} <span className="opacity-70">· {zoned.filter((s) => s.day === d).length}</span>
            </button>
          ))}
          {canEdit ? <button onClick={() => setForm("new")} className="h-[34px] rounded-full border border-dashed border-[#B7BDC9] bg-white px-3.5 text-[13px]">+ {t("Session")}</button> : null}
        </div>
        <form action={runPub} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="slug" value={slug} />
          {clashes.length ? <span className="text-[13px] text-[#8C1D18]">{t("{n} clash(es) to resolve", { n: clashes.length })}</span> : <span className="text-[13px] text-[#14603F]">{t("No clashes")}</span>}
          {canEdit ? <Submit className={published && !pub.error ? ui.ghost : ui.primary} disabled={!!clashes.length || !sessions.length} pendingLabel={t("Publishing…")}>{published ? t("Publish again") : t("Publish program")}</Submit> : null}
        </form>
      </div>

      {clashes.map((c, i) => (
        <p key={i} role="alert" className={`${ui.bad} m-0`}>{t("Clash: {who} is in {a} and {b} at the same time (H2). Move one of the papers before publishing.", { who: c.person ?? t("someone"), a: c.session_a, b: c.session_b })}</p>
      ))}
      {pub.error ? <p role="alert" className={`${ui.bad} m-0`}>{t(pub.error)}</p> : null}
      {published && !pub.error ? <p role="status" className={`${ui.ok} m-0`}>{t("Program published. Presenters got their slot by email and in their calendar feed; later changes notify them automatically (H4).")}</p> : null}

      {form !== "closed" && canEdit ? (
        <section className={ui.card}>
          <h2 className={ui.h2}>{editing ? t("Edit {code}", { code: editing.code }) : t("New session")}</h2>
          <div className="mt-4"><SessionForm slug={slug} day={day} rooms={rooms} people={people} edit={editing} onDone={() => setForm("closed")} /></div>
          {editing ? <div className="mt-3"><Act action={deleteSession} fields={{ slug, id: editing.id }} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#B3261E] underline" confirm={t("Delete session {code}? Its papers go back to the pool.", { code: editing.code })}>{t("Delete session")}</Act></div> : null}
        </section>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[270px_1fr]">
        <aside className={`${ui.card} p-4! lg:sticky lg:top-4`}>
          <p className={ui.kicker}>{t("Unscheduled · {n}", { n: pool.length })}</p>
          {pool.length === 0 ? <p className="m-0 mt-3 text-[14px] text-[#14603F]">{t("All papers placed ✓")}</p> : (
            <>
              <p className={`${ui.hint} m-0 mt-1`}>{t("Pick a paper, then click an empty slot.")}</p>
              <ul className="m-0 mt-3 flex max-h-[60vh] list-none flex-col gap-2 overflow-y-auto p-0">
                {pool.map((p) => (
                  <li key={p.submission_id}>
                    <button type="button" disabled={!canEdit} onClick={() => setPick(pick?.submission_id === p.submission_id ? null : p)} aria-pressed={pick?.submission_id === p.submission_id}
                      className={`w-full cursor-pointer rounded-[6px] border p-2.5 text-left text-[13px] ${pick?.submission_id === p.submission_id ? "border-[#F2A93B] bg-[#FFF6E6] ring-2 ring-[#F2A93B]" : "border-[#DADDE3] bg-white hover:bg-[#F7F8F6]"}`}>
                      <span className="font-mono text-[11px] text-[#4A5263]">{paperNo(p.number)}{p.topic ? ` · ${p.topic}` : ""}</span>
                      <span className="block font-medium leading-snug">{p.title}</span>
                      <span className="block text-[11px] text-[#4A5263]">{p.presenter ?? t("no presenter yet")}{p.complete ? "" : ` · ${t("final version incomplete")}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        <div className="overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
          {today.length === 0 ? (
            <div className="p-8 text-center text-[#4A5263]">
              <p className="m-0">{t("No sessions on this day yet.")}</p>
              {canEdit ? <button onClick={() => setForm("new")} className={`${ui.ghost} mt-3`}>+ {t("Add a session")}</button> : null}
              {rooms.length === 0 ? <p className={`${ui.hint} mt-3`}><Link href={`/manage/${slug}/setup/program`}>{t("Add rooms in Setup → Program & rooms")}</Link></p> : null}
            </div>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead><tr>
                <th className={`${ui.th} w-[92px]`}>{t("Time")}</th>
                {cols.map((c) => <th key={c.id ?? "none"} className={ui.th}>{c.name}{c.seats ? <span className="ml-1 normal-case tracking-normal opacity-70">· {t("{n} seats", { n: c.seats })}</span> : null}</th>)}
              </tr></thead>
              <tbody>
                {blocks.map((b) => (
                  <tr key={b}>
                    <td className={`${ui.td} font-mono text-[12px]`}>{b}</td>
                    {cols.map((c) => {
                      const here = today.filter((s) => `${s.start}–${s.end}` === b && s.room_id === c.id);
                      return (
                        <td key={c.id ?? "none"} className={`${ui.td} min-w-[220px]`}>
                          {here.map((s) => {
                            const placeable = canEdit && cur && s.kind !== "break" && s.kind !== "keynote" && s.talks.length < perSession;
                            return (
                              <div key={s.id} className={`mb-2 rounded-[6px] border p-2.5 ${clashSessions.has(s.code) ? "border-[#F3C3BE] bg-[#FDECEA]/40" : s.kind === "break" ? "border-[#EEF0EC] bg-[#F7F8F6]" : "border-[#DADDE3]"}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <p className="m-0 font-medium"><span className="font-mono text-[11px] text-[#4A5263]">{s.code}</span> · {s.title}</p>
                                  {canEdit ? <button onClick={() => setForm(s.id)} className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#2F5FD0] underline">{t("Edit")}</button> : null}
                                </div>
                                {s.kind !== "break" ? <p className="m-0 text-[12px] text-[#4A5263]">{t(KIND_LABEL[s.kind])} · {t("Chair:")} {s.chair ?? <span className="text-[#8C1D18]">{t("not yet")}</span>}</p> : null}
                                {s.kind !== "break" ? (
                                  <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                                    {s.talks.map((x) => (
                                      <li key={x.id} className="flex items-start gap-2 rounded-[4px] bg-[#F7F8F6] px-2 py-1.5">
                                        <span className="w-[40px] flex-none font-mono text-[11px] text-[#4A5263]">{x.at}</span>
                                        <span className="min-w-0 flex-auto">
                                          <span className="font-mono text-[11px]">{x.number ? paperNo(x.number) : ""}</span> {x.title}
                                          <span className="block text-[11px] text-[#4A5263]">{x.presenter ?? ""}</span>
                                          {x.presenter_id && clashPeople.has(x.presenter_id) && clashSessions.has(s.code) ? <span className={`${ui.tag} bg-[#FDECEA] text-[#8C1D18]`}>{t("CLASH")}</span> : null}
                                          {x.presenter_id && (x.presenter_id === s.chair_id || x.presenter_id === s.cochair_id) ? <span className={`${ui.tag} ml-1 bg-[#FFF6E6] text-[#7A5410]`}>{t("CHAIR PRESENTS")}</span> : null}
                                        </span>
                                        {canEdit ? <Act action={unplaceTalk} fields={{ slug, talk: x.id }} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#4A5263]">×</Act> : null}
                                      </li>
                                    ))}
                                    {placeable ? (
                                      <li><Act action={placeTalk} fields={{ slug, session: s.id, submission: cur.submission_id, presenter: cur.presenter_id ?? "" }}
                                        className="w-full cursor-pointer rounded-[4px] border border-dashed border-[#F2A93B] bg-[#FFF6E6] px-2 py-1.5 text-left text-[12px] font-medium text-[#7A5410]">
                                        + {t("Place {id} here", { id: paperNo(cur.number) })}
                                      </Act></li>
                                    ) : null}
                                    {Array.from({ length: Math.max(0, perSession - s.talks.length - (placeable ? 1 : 0)) }, (_, i) => (
                                      <li key={`e${i}`} className="rounded-[4px] border border-dashed border-[#DADDE3] px-2 py-1.5 text-[11px] text-[#B7BDC9]">{t("Empty")}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
