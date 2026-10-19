"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import {
  cancelMaintenance, closeSupport, decideVenue, lockPerson, personAction, replySupport, scheduleMaintenance, setRequireApproval, type AdminState,
} from "@/lib/admin/actions";

function Status({ s }: { s: AdminState }) {
  const t = useT();
  if (s.error) return <p role="alert" className="m-0 text-[13px] text-[#B3261E]">{t(s.error)}</p>;
  if (s.ok) return <p role="status" className="m-0 text-[13px] text-[#14603F]">{t(s.ok)}</p>;
  return <span role="status" className="sr-only" />;
}

const small = "inline-flex h-9 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60";
const smallBad = `${small} border-[#F3C3BE]! text-[#B3261E]!`;
const smallOk = `${small} border-[#B9E0CB]! text-[#14603F]!`;

export function ReplyForm({ source, id, name, closed }: { source: string; id: string; name: string | null; closed: boolean }) {
  const t = useT();
  const [s, act, pending] = useActionState(replySupport, {});
  const [c, close, closing] = useActionState(closeSupport, {});
  const [body, setBody] = useState(`${t("Hello {name}, thanks for writing.", { name: name?.split(" ")[0] || t("there") })} `);
  return (
    <div className="mt-4 flex flex-col gap-3">
      <form action={act} className="flex flex-col gap-3" key={s.at}>
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="id" value={id} />
        <label className={ui.label}>
          {t("Reply (sent by email and saved here)")}
          <textarea name="body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} className={ui.textarea} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending || body.trim().length < 2} className={ui.primary}>{pending ? t("Sending…") : t("Send reply")}</button>
          <Status s={s} />
        </div>
      </form>
      <form action={close} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="id" value={id} />
        {closed ? <input type="hidden" name="reopen" value="1" /> : null}
        <button type="submit" disabled={closing} className={ui.ghost}>{closed ? t("Reopen") : t("Mark solved")}</button>
        <Status s={c} />
      </form>
    </div>
  );
}

export function VenueDecision({ id, status }: { id: string; status: string }) {
  const t = useT();
  const [s, act, pending] = useActionState(decideVenue, {});
  const [asking, setAsking] = useState(false);
  return (
    <form action={act} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      {asking ? (
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          {t("What do you need from the organizer?")}
          <textarea name="note" rows={3} required minLength={5} maxLength={1000} className={ui.textarea} placeholder={t("e.g. Please send the conference website.")} />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {asking ? (
          <>
            <button type="submit" name="intent" value="info" disabled={pending} className={small}>{t("Send")}</button>
            <button type="button" onClick={() => setAsking(false)} className={small}>{t("Cancel")}</button>
          </>
        ) : (
          <>
            {status !== "approved" ? <button type="submit" name="intent" value="approve" disabled={pending} className={smallOk}>{t("Approve")}</button> : null}
            <button type="button" onClick={() => setAsking(true)} className={smallBad}>{t("Ask for info")}</button>
          </>
        )}
      </div>
      <Status s={s} />
    </form>
  );
}

export function ApprovalToggle({ on }: { on: boolean }) {
  const t = useT();
  const [s, act, pending] = useActionState(setRequireApproval, {});
  return (
    <form action={act} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="on" value={on ? "0" : "1"} />
      <button type="submit" role="switch" aria-checked={on} disabled={pending} className="flex items-center gap-2 border-0 bg-transparent p-0 text-[14px] text-[#121826]">
        <span aria-hidden className={`relative inline-block h-5 w-9 rounded-full ${on ? "bg-[#18744F]" : "bg-[#8A93A6]"}`}>
          <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left] ${on ? "left-[18px]" : "left-0.5"}`} />
        </span>
        {t("New events must be approved before they open submissions")}
      </button>
      <Status s={s} />
    </form>
  );
}

export function LockForm({ id, locked, merged }: { id: string; locked: boolean; merged: boolean }) {
  const t = useT();
  const [s, act, pending] = useActionState(lockPerson, {});
  const [open, setOpen] = useState(false);
  if (merged) return <p className="m-0 text-[13px] text-[#4A5263]">{t("Merged accounts stay locked.")}</p>;
  return (
    <form action={act} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="lock" value={locked ? "0" : "1"} />
      {open ? (
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          {t("Reason (the person can see it)")}
          <input name="reason" required minLength={3} maxLength={300} className={ui.input} />
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {open ? (
          <>
            <button type="submit" disabled={pending} className={locked ? smallOk : smallBad}>{locked ? t("Unlock account") : t("Lock account")}</button>
            <button type="button" onClick={() => setOpen(false)} className={small}>{t("Cancel")}</button>
          </>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className={locked ? smallOk : smallBad}>{locked ? t("Unlock account…") : t("Lock account…")}</button>
        )}
        <Status s={s} />
      </div>
    </form>
  );
}

export function PersonAction({ id, action, email, label }: { id: string; action: "verification.resent" | "person.signed_out"; email?: string; label: string }) {
  const t = useT();
  const [s, act, pending] = useActionState(personAction, {});
  return (
    <form action={act} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="email" value={email ?? ""} />
      <button type="submit" disabled={pending} className={small}>{t(label)}</button>
      <Status s={s} />
    </form>
  );
}

export function MaintenanceForm() {
  const t = useT();
  const [s, act, pending] = useActionState(scheduleMaintenance, {});
  return (
    <form action={act} className="flex flex-col gap-3" key={s.ok ? s.at : undefined}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ui.label}>{t("Starts (UTC)")}<input type="datetime-local" name="starts" required className={ui.input} /></label>
        <label className={ui.label}>{t("Ends (UTC)")}<input type="datetime-local" name="ends" required className={ui.input} /></label>
      </div>
      <label className={ui.label}>{t("Message on the maintenance page (optional)")}<input name="message" maxLength={500} className={ui.input} placeholder={t("e.g. Database upgrade")} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={ui.primary}>{t("Schedule")}</button>
        <Status s={s} />
      </div>
    </form>
  );
}

export function CancelMaintenance({ id }: { id: number }) {
  const t = useT();
  const [s, act, pending] = useActionState(cancelMaintenance, {});
  return (
    <form action={act} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={smallBad}>{t("Cancel")}</button>
      <Status s={s} />
    </form>
  );
}
