"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/browser";
import { messageEditor, setAnnotation, volunteer, withdrawVolunteer, type PolishState } from "@/lib/reviewpolish/actions";
import { ui } from "@/components/manage/ui";

/* ---------------------------------------------------------------- SB08 "Help review for this venue?" */
export function VolunteerBox({ venueId, venue, path, suggested, current }: {
  venueId: string; venue: string; path: string; suggested: string[];
  current: { topics: string[]; note: string | null; maxPapers: number } | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PolishState, FormData>(volunteer, {});
  const [wState, wAction, wPending] = useActionState<PolishState, FormData>(withdrawVolunteer, {});
  const active = (current && !wState.ok) || state.ok;
  if (active) {
    return (
      <div className="mt-3">
        <p role="status" className="m-0 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3 py-2 text-[14px] text-[#14603F]">
          ✓ {t("You volunteered to review for {venue}. The chairs see you as a candidate when they look for reviewers.", { venue })}
        </p>
        <form action={wAction} className="mt-2">
          <input type="hidden" name="venueId" value={venueId} /><input type="hidden" name="path" value={path} />
          <button type="submit" disabled={wPending} className="border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline">{t("Withdraw my offer")}</button>
        </form>
      </div>
    );
  }
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className={`${ui.ghost} mt-3 h-10! text-[14px]!`}>{t("Yes, I can review")}</button>;
  }
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="venueId" value={venueId} /><input type="hidden" name="path" value={path} />
      <label className={ui.label}>{t("Topics you can review")}
        <input name="topics" defaultValue={(current?.topics ?? suggested).join(", ")} className={ui.input} maxLength={1200} />
        <span className={ui.hint}>{t("Separate topics with commas. Up to 10.")}</span>
      </label>
      <label className={ui.label}>{t("How many papers at most?")}
        <select name="max" defaultValue={String(current?.maxPapers ?? 3)} className={ui.input}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label className={ui.label}>{t("Note to the chairs (optional)")}
        <textarea name="note" rows={2} maxLength={500} defaultValue={current?.note ?? ""} className={ui.textarea} />
      </label>
      <p className={`${ui.hint} m-0`}>{t("You won't be given your own paper or papers you have a conflict with.")}</p>
      {state.error ? <p role="alert" className="m-0 text-[13px] text-[#B3261E]">{t(state.error)}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={`${ui.primary} h-10!`}>{pending ? t("Saving…") : t("Volunteer")}</button>
        <button type="button" onClick={() => setOpen(false)} className={`${ui.ghost} h-10!`}>{t("Cancel")}</button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- RV02 message the associate editor */
export function MessageEditorBox({ assignmentId, editor }: { assignmentId: string; editor: string | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PolishState, FormData>(messageEditor, {});
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1.5 block border-0 bg-transparent p-0 text-left text-[14px] text-[#2F5FD0] hover:underline">
        {editor ? t("Message {name}", { name: editor }) : t("Message the associate editor")}
      </button>
    );
  }
  return (
    <form action={action} className="mt-2 flex flex-col gap-2.5">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <label className={ui.label}>{t("Subject")}<input name="subject" maxLength={200} placeholder={t("Question about the review")} className={`${ui.input} h-10!`} /></label>
      <label className={ui.label}>{t("Message")}
        <textarea name="body" rows={4} maxLength={8000} required aria-invalid={!!state.fieldErrors?.body} className={ui.textarea} />
        {state.fieldErrors?.body ? <span className="text-[13px] font-normal text-[#B3261E]">{t(state.fieldErrors.body)}</span> : null}
      </label>
      <p className={`${ui.hint} m-0`}>{t("Only the editor handling this paper reads it (or the chairs if there is none yet). Authors never see it.")}</p>
      {state.error ? <p role="alert" className="m-0 text-[13px] text-[#B3261E]">{t(state.error)}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={`${ui.navy} h-10!`}>{pending ? t("Sending…") : t("Send message")}</button>
        <button type="button" onClick={() => setOpen(false)} className={`${ui.ghost} h-10!`}>{t("Cancel")}</button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- RV03 annotated PDF */
const MAX_MB = 25;
const ERR = {
  pdf: "Upload a PDF file.",
  size: "The file is larger than 25 MB.",
  upload: "The upload failed. Please try again.",
};
export function AnnotatedPdf({ assignmentId, submissionId, editable, current }: {
  assignmentId: string; submissionId: string; editable: boolean; current: { name: string; url: string | null } | null;
}) {
  const t = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function upload(file: File) {
    setErr(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setErr(ERR.pdf); return; }
    if (file.size > MAX_MB * 1048576) { setErr(ERR.size); return; }
    start(async () => {
      const path = `${submissionId}/reviews/${assignmentId}/annotated-${Date.now()}.pdf`;
      const { error } = await createClient().storage.from("papers").upload(path, file, { contentType: "application/pdf", upsert: false });
      if (error) { setErr(ERR.upload); return; }
      const r = await setAnnotation(assignmentId, path);
      if (r.error) { setErr(r.error); return; }
      router.refresh();
    });
  }
  function remove() {
    setErr(null);
    start(async () => {
      const r = await setAnnotation(assignmentId, null);
      if (r.error) { setErr(r.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="mt-5 rounded-[6px] border border-dashed border-[#B7BDC9] px-4 py-3.5">
      <p className="m-0 text-[15px] font-medium">{t("Annotated PDF (optional)")}</p>
      <p className={`${ui.hint} mb-0 mt-1`}>{t("Mark up the paper in any PDF reader and upload it. Only the editor and the chairs see it; remove your name from the file's comments first.")}</p>
      {current ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[14px]">
          <span aria-hidden className="rounded-[3px] bg-[#E6EDFC] px-1.5 py-px font-mono text-[11px] text-[#1F47A8]">PDF</span>
          {current.url ? <a href={current.url} target="_blank" rel="noreferrer" className="text-[#2F5FD0]">{current.name}</a> : <span>{current.name}</span>}
          {editable ? <button type="button" onClick={remove} disabled={busy} className="border-0 bg-transparent p-0 text-[13px] text-[#B3261E] underline">{t("Remove")}</button> : null}
        </div>
      ) : null}
      {editable ? (
        <>
          <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label={t("Choose annotated PDF")}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className={`${ui.ghost} mt-2.5 h-9! text-[14px]!`}>
            {busy ? t("Uploading…") : current ? t("Replace PDF") : t("Upload annotated PDF")}
          </button>
        </>
      ) : !current ? <p className={`${ui.hint} mb-0 mt-2`}>{t("No annotated PDF.")}</p> : null}
      {err ? <p role="alert" className="mb-0 mt-2 text-[13px] text-[#B3261E]">{t(err)}</p> : null}
    </div>
  );
}
