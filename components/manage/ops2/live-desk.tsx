"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { Act, FieldErr, StateLine, Submit } from "@/components/manage/ops2/act";
import { checkIn, registerAtDesk, sendAnnouncement, setAttendance, setRoomStatus, type Ops2State } from "@/lib/manage/ops2-actions";

/* EM31 event day: room status cards, check-in desk, announcement and no-show panels. */

export type RoomNow = {
  room: string; sessionId: string | null; code: string | null; title: string | null; status: string; delay: number; note: string | null;
  range: string | null; nowTalk: string | null; progress: number; next: boolean;
};

const roomStatus: Record<string, [string, string]> = {
  on_time: ["ON TIME", "bg-[#E1F3EA] text-[#14603F]"], scheduled: ["ON TIME", "bg-[#E1F3EA] text-[#14603F]"], late: ["{n} MIN LATE", "bg-[#FFF6E6] text-[#7A5410]"],
  break: ["BREAK", "bg-[#EEF0EC] text-[#4A5263]"], open: ["OPEN", "bg-[#E8EEFB] text-[#1F3F8F]"], done: ["DONE", "bg-[#EEF0EC] text-[#4A5263]"],
};

function StatusForm({ slug, r, onDone }: { slug: string; r: RoomNow; onDone: () => void }) {
  const t = useT();
  const [state, run] = useActionState<Ops2State, FormData>(async (p, fd) => { const x = await setRoomStatus(p, fd); if (x.ok) onDone(); return x; }, {});
  return (
    <form action={run} className="mt-2 flex flex-col gap-2 border-t border-[#EEF0EC] pt-2">
      <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={r.sessionId ?? ""} />
      <div className="flex gap-2">
        <select name="live_status" defaultValue={r.status === "scheduled" ? "on_time" : r.status} className={`${ui.input} h-9! flex-auto text-[13px]!`}>
          <option value="on_time">{t("On time")}</option><option value="late">{t("Running late")}</option><option value="break">{t("Break")}</option><option value="open">{t("Open")}</option><option value="done">{t("Done")}</option>
        </select>
        <input name="delay_min" type="number" min={0} max={240} defaultValue={r.delay || ""} placeholder={t("min")} aria-label={t("Minutes late")} className={`${ui.input} h-9! w-[70px] text-[13px]!`} />
      </div>
      <input name="live_note" defaultValue={r.note ?? ""} placeholder={t("Note shown to attendees (optional)")} className={`${ui.input} h-9! text-[13px]!`} />
      <StateLine state={state} />
      <Submit className={`${ui.navy} h-9! text-[13px]!`} pendingLabel={t("Saving…")}>{t("Update room")}</Submit>
    </form>
  );
}

export function RoomCards({ slug, rooms, canEdit }: { slug: string; rooms: RoomNow[]; canEdit: boolean }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  if (!rooms.length) return <p className={`${ui.hint} m-0`}>{t("No sessions on this day.")}</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {rooms.map((r) => {
        const [label, cls] = roomStatus[r.sessionId ? r.status : "open"] ?? roomStatus.on_time;
        return (
          <div key={r.room} className={`${ui.card} p-4!`}>
            <div className="flex items-start justify-between gap-2">
              <p className="m-0 font-medium">{r.room}</p>
              <span className={`${ui.tag} ${cls}`}>{t(label, { n: r.delay })}</span>
            </div>
            {r.sessionId ? (
              <>
                <p className="m-0 mt-1 text-[13px]"><span className="font-mono text-[11px] text-[#4A5263]">{r.code}</span> · {r.title}</p>
                <p className="m-0 font-mono text-[11px] text-[#4A5263]">{r.next ? t("Next") : ""} {r.range}</p>
                {r.nowTalk ? <p className="m-0 mt-1 text-[12px]"><span className="text-[#4A5263]">{t("Now:")}</span> {r.nowTalk}</p> : null}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EEF0EC]"><div className="h-full bg-[#0E1B3D]" style={{ width: `${Math.round(r.progress * 100)}%` }} /></div>
                {r.note ? <p className="m-0 mt-1.5 text-[12px] text-[#7A5410]">{r.note}</p> : null}
                {canEdit ? (open === r.room ? <StatusForm slug={slug} r={r} onDone={() => setOpen(null)} /> : <button onClick={() => setOpen(r.room)} className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#2F5FD0] underline">{t("Change status")}</button>) : null}
              </>
            ) : <p className="m-0 mt-1 text-[13px] text-[#4A5263]">{t("Nothing scheduled")}</p>}
          </div>
        );
      })}
    </div>
  );
}

export type DeskRow = { id: string; number: string; full_name: string | null; email: string | null; affiliation: string | null; reg_type: string; paid: boolean; checked_in_at: string | null; badges: number; papers: string[]; presents: string | null };

function DeskRegister({ slug }: { slug: string }) {
  const t = useT();
  const [state, run] = useActionState<Ops2State, FormData>(registerAtDesk, {});
  if (state.ok) return <p role="status" className={`${ui.ok} m-0`}>{t("Registered at desk as {n} and checked in ✓", { n: state.info ?? "" })}</p>;
  return (
    <form action={run} className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
      <input type="hidden" name="slug" value={slug} />
      <label className="flex flex-col gap-1"><input name="full_name" required placeholder={t("Full name")} aria-label={t("Full name")} className={ui.input} /><FieldErr state={state} name="full_name" /></label>
      <input name="email" type="email" placeholder={t("Email")} aria-label={t("Email")} className={ui.input} />
      <select name="reg_type" defaultValue="One day" aria-label={t("Type")} className={ui.input}><option value="Full">{t("Full")}</option><option value="One day">{t("One day")}</option><option value="Student">{t("Student")}</option></select>
      <Submit className={ui.navy} pendingLabel={t("Saving…")}>{t("Register at desk")}</Submit>
      <div className="sm:col-span-4"><StateLine state={state} /></div>
    </form>
  );
}

export function CheckInDesk({ slug, q, rows }: { slug: string; q: string; rows: DeskRow[] }) {
  const t = useT();
  const [desk, setDesk] = useState(false);
  return (
    <section className={ui.card}>
      <h2 className={ui.h2}>{t("Check-in desk")}</h2>
      <form method="get" className="mt-3 flex gap-2" role="search">
        <input type="search" name="q" defaultValue={q} autoFocus placeholder={t("Name, email, registration # or scan QR")} aria-label={t("Search registrations")} className={`${ui.input} flex-auto`} />
        <button type="submit" className={ui.ghost}>{t("Search")}</button>
      </form>
      <ul className="m-0 mt-3 flex list-none flex-col p-0">
        {q && rows.length === 0 ? <li className="py-3 text-[14px] text-[#4A5263]">{t("No registration found for “{q}”.", { q })}</li> : null}
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0EC] py-3">
            <div className="min-w-0">
              <p className="m-0 font-medium">{r.full_name ?? "—"} <span className="font-mono text-[11px] text-[#4A5263]">{r.number}</span></p>
              <p className="m-0 text-[12px] text-[#4A5263]">{[r.reg_type, r.affiliation, r.email].filter(Boolean).join(" · ")}{r.paid ? "" : ` · ${t("UNPAID")}`}</p>
              {r.papers.length ? <p className="m-0 text-[12px]">{t("Papers")}: <span className="font-mono">{r.papers.join(", ")}</span></p> : null}
              {r.presents ? <p className="m-0 text-[12px] text-[#7A5410]">{t("Presents")} {r.presents}</p> : null}
            </div>
            {r.checked_in_at
              ? <Act action={checkIn} fields={{ slug, id: r.id }} className={`${ui.ghost} h-9! text-[13px]!`}>{t("Checked in ✓ · reprint badge")}</Act>
              : <Act action={checkIn} fields={{ slug, id: r.id }} className={`${ui.primary} h-9! text-[13px]!`} pendingLabel={t("Checking in…")}>{t("Check in + print badge")}</Act>}
          </li>
        ))}
      </ul>
      <div className="mt-3">
        {desk ? <DeskRegister slug={slug} /> : <button onClick={() => setDesk(true)} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline">{t("Not registered? Register at desk")}</button>}
      </div>
    </section>
  );
}

export function AnnouncementForm({ slug, options }: { slug: string; options: { id: string; label: string; count: number }[] }) {
  const [key, setKey] = useState(0);
  return <AnnouncementInner key={key} slug={slug} options={options} onNew={() => setKey((k) => k + 1)} />;
}

function AnnouncementInner({ slug, options, onNew }: { slug: string; options: { id: string; label: string; count: number }[]; onNew: () => void }) {
  const t = useT();
  const [state, run] = useActionState<Ops2State, FormData>(sendAnnouncement, {});
  const [target, setTarget] = useState("");
  const affected = options.find((o) => o.id === target)?.count ?? 0;
  if (state.ok) return (
    <div className="flex flex-col gap-2">
      <p role="status" className={`${ui.ok} m-0`}>{t("Sent to {n} people ✓", { n: state.count ?? 0 })}</p>
      <button onClick={onNew} className={ui.ghost}>{t("New announcement")}</button>
    </div>
  );
  return (
    <form action={run} className="flex flex-col gap-2.5">
      <input type="hidden" name="slug" value={slug} />
      <label className={ui.label}>{t("Who")}<select name="session" value={target} onChange={(e) => setTarget(e.target.value)} className={ui.input}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select></label>
      <label className={ui.label}>{t("Title")}<input name="title" required maxLength={200} placeholder={t("Room change: TuA1 moves to Hall B")} className={ui.input} /><FieldErr state={state} name="title" /></label>
      <label className={ui.label}>{t("Message")}<textarea name="body" required rows={4} maxLength={5000} className={ui.textarea} /><FieldErr state={state} name="body" /></label>
      <p className="m-0 flex gap-3 font-mono text-[11px] text-[#4A5263]"><span>{t("PUSH + INBOX")}</span><span>{t("AFFECTED: {n}", { n: affected })}</span></p>
      <StateLine state={state} />
      <Submit className={ui.navy} disabled={!affected} pendingLabel={t("Sending…")}>{t("Send announcement")}</Submit>
    </form>
  );
}

export type NoShow = { talk: string; label: string; note: string | null };

export function NoShowPanel({ slug, reports, talks, canEdit }: { slug: string; reports: NoShow[]; talks: { id: string; label: string }[]; canEdit: boolean }) {
  const t = useT();
  const [state, run] = useActionState<Ops2State, FormData>(setAttendance, {});
  return (
    <div className="flex flex-col gap-3">
      {reports.length === 0 ? <p className={`${ui.hint} m-0`}>{t("No no-shows reported.")}</p> : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {reports.map((r) => (
            <li key={r.talk} className="rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA]/50 p-2.5 text-[13px]">
              {r.label}{r.note ? <span className="block text-[12px] text-[#4A5263]">{r.note}</span> : null}
              {canEdit ? <Act action={setAttendance} fields={{ slug, talk: r.talk, attendance: "presented", note: "" }} className="mt-1 cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#2F5FD0] underline">{t("Undo — presented after all")}</Act> : null}
            </li>
          ))}
        </ul>
      )}
      {canEdit && talks.length ? (
        <form action={run} className="flex flex-col gap-2">
          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="attendance" value="no_show" />
          <select name="talk" required defaultValue="" aria-label={t("Talk")} className={ui.input}><option value="" disabled>{t("Report a no-show…")}</option>{talks.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
          <input name="note" placeholder={t("What happened (optional)")} className={ui.input} />
          <StateLine state={state} />
          <Submit className={ui.ghost} pendingLabel={t("Saving…")}>{t("Report no-show")}</Submit>
        </form>
      ) : null}
      <p className={`${ui.hint} m-0`}>{t("Final no-show status is set after the event in Proceedings (H5, H6).")}</p>
    </div>
  );
}
