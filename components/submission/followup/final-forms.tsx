"use client";

import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { saveFinalCopyright, saveFinalPresenter, saveFinalTitle, submitFinal } from "@/lib/submission/followup-actions";
import type { ActionState } from "@/lib/submission/actions";
import { ghostBtn, primaryBtn } from "@/components/submission/shell";
import { ErrorBox, FieldError, Saved } from "@/components/submission/followup/bits";
import { useT } from "@/lib/i18n/client";

const box = "mt-0.5 size-5 flex-none accent-[#0E1B3D]";

/** SB12b — final title + lock. */
export function TitleLockForm({ id, title: t0, authors, locked }: { id: string; title: string; authors: { name: string; institution: string | null; tag: string | null }[]; locked: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveFinalTitle, {});
  const [title, setTitle] = useState(t0);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      <label htmlFor="fa-t" className="mt-4 block font-semibold">{t("Title")}</label>
      <input id="fa-t" name="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} maxLength={200} className="mt-1.5 h-12 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[15px] disabled:bg-[#F7F8F6]" />
      <FieldError msg={fe.title} />
      <p className="mb-0 mt-5 font-semibold">{t("Authors, in order")}</p>
      <ol className="m-0 mt-2 list-none p-0">
        {authors.map((a, i) => (
          <li key={i} className="flex items-center gap-3 border-b border-[#EEF0EC] py-2.5 last:border-0">
            <span className="flex size-7 flex-none items-center justify-center rounded-full bg-[#EEF0EC] font-mono text-[13px]">{i + 1}</span>
            <span className="min-w-0 flex-auto"><span className="block font-semibold">{a.name}</span>{a.institution ? <span className="block text-[14px] text-[#4A5263]">{a.institution}</span> : null}</span>
            {a.tag ? <span className="rounded-[3px] bg-[#E6EDFC] px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[#1F47A8]">{a.tag}</span> : null}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[13px] text-[#4A5263]">{t("To change the author list, message the program chair before you lock.")}</p>
      <div className="mt-4 rounded-[6px] bg-[#F7F8F6] px-4 py-3">
        <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Preview · as in the program")}</p>
        <p className="mt-1.5 font-serif text-[18px]">{title}</p>
        <p className="m-0 text-[14px] text-[#4A5263]">{authors.map((a) => a.name).join(", ")}</p>
      </div>
      {locked ? (
        <p className="mt-4 rounded-[6px] bg-[#E1F3EA] px-3 py-2 text-[14px] text-[#14603F]">✓ {t("Locked. Changes now need the publication chair.")}</p>
      ) : (
        <label className="mt-4 flex gap-3 text-[15px]"><input type="checkbox" name="lock" className={box} /><span><span className="font-semibold">{t("Lock title and authors")}</span><span className="block text-[14px] text-[#4A5263]">{t("After locking, changes need the publication chair. Copyright is signed for this exact title and author list.")}</span></span></label>
      )}
      <FieldError msg={fe.lock} />
      <ErrorBox msg={state.error} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/submissions/${id}/final`} className={ghostBtn}>← {t("Camera-ready PDF")}</Link>
        <div className="flex flex-wrap items-center gap-3">
          <Saved at={state.savedAt} />
          {locked ? <Link href={`/submissions/${id}/final/copyright`} className={primaryBtn}>{t("Continue to copyright")} →</Link> : (
            <>
              <button type="submit" name="intent" value="save" disabled={pending} className={ghostBtn}>{t("Save title")}</button>
              <button type="submit" name="intent" value="next" disabled={pending} className={primaryBtn}>{pending ? t("Saving…") : `${t("Continue to copyright")} →`}</button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

const COPYRIGHT_TYPES: [string, string, string][] = [
  ["ieee", "IEEE copyright", "The usual choice. You sign IEEE's electronic form (eCF)."],
  ["open_access", "Open access (CC BY)", "For papers with an open-access fee paid. Signed on IEEE's form."],
  ["us_gov", "US government work", "All authors are US government employees and wrote it as part of their job."],
  ["crown", "Crown copyright", "Written by employees of the UK, Canada or Australia governments."],
];

/** SB12c — copyright type + sign. */
export function CopyrightForm({ id, type: t0, status, signer, ecfUrl, locked }: { id: string; type: string | null; status: "not_started" | "waiting" | "signed"; signer: string | null; ecfUrl: string; locked: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveFinalCopyright, {});
  const [type, setType] = useState(t0 ?? "ieee");
  const viaIeee = type === "ieee" || type === "open_access";
  const tag = status === "signed" ? [t("Signed"), "#E1F3EA", "#14603F"] : status === "waiting" ? [t("Waiting for IEEE"), "#FBEFDD", "#7A4508"] : [t("Not signed"), "#EEF0EC", "#4A5263"];
  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      <p className="mb-0 mt-5 font-semibold">{t("Which applies to this paper?")}</p>
      <div role="radiogroup" className="mt-2 flex flex-col gap-2">
        {COPYRIGHT_TYPES.map(([k, label, d]) => (
          <label key={k} className={`flex cursor-pointer gap-3 rounded-[6px] border px-3.5 py-3 ${type === k ? "border-[#0E1B3D] bg-[#F7F8F6]" : "border-[#DADDE3] bg-white"}`}>
            <input type="radio" name="type" value={k} checked={type === k} disabled={status === "signed"} onChange={() => setType(k)} className="mt-1 accent-[#0E1B3D]" />
            <span><span className="block font-semibold">{t(label)}</span><span className="block text-[14px] text-[#4A5263]">{t(d)}</span></span>
          </label>
        ))}
      </div>
      <FieldError msg={state.fieldErrors?.type} />
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[6px] border border-[#EEF0EC] px-3.5 py-3">
        <span className="rounded-[3px] px-2 py-0.5 font-mono text-[12px] uppercase tracking-[0.06em]" style={{ background: tag[1], color: tag[2] }}>{tag[0]}</span>
        <span className="text-[14px]">
          {status === "signed" ? t("Signed by {name}.", { name: signer ?? "—" }) : status === "waiting" ? t("Finish the form at IEEE. It can take a few minutes to show here.") : viaIeee ? t("You'll sign on IEEE's site, then come back here.") : t("Saving this choice signs it for all authors.")}
        </span>
      </div>
      {!locked ? <p className="mt-3 text-[14px] text-[#B3261E]">{t("Lock the title and authors first.")}</p> : null}
      {status === "waiting" ? <p className="mt-3 text-[14px] text-[#4A5263]">{t("Finished at IEEE but nothing changed here? Make sure you clicked Return to Plenary on IEEE's last page.")}</p> : null}
      <ErrorBox msg={state.error} />
      <div className="mt-4 flex flex-wrap gap-2">
        {status !== "signed" && locked ? (
          viaIeee
            ? <button type="submit" name="intent" value="start" disabled={pending} onClick={() => window.open(ecfUrl, "_blank", "noopener")} className="h-10 rounded-[4px] bg-[#0E1B3D] px-4 text-[15px] font-semibold text-white">{t("Open IEEE eCF")} ↗</button>
            : <button type="submit" name="intent" value="save" disabled={pending} className="h-10 rounded-[4px] bg-[#0E1B3D] px-4 text-[15px] font-semibold text-white">{t("Sign for all authors")}</button>
        ) : null}
        {status === "waiting" ? <button type="submit" name="intent" value="save" disabled={pending} className="h-10 rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[15px]">{t("Check again")}</button> : null}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/submissions/${id}/final/title-authors`} className={ghostBtn}>← {t("Title & authors")}</Link>
        <div className="flex items-center gap-3"><Saved at={state.savedAt} />
          <button type="submit" name="intent" value="next" disabled={pending || !locked} className={primaryBtn}>{t("Continue to registration")} →</button></div>
      </div>
    </form>
  );
}

/** SB12d — presenter + remote. */
export function PresenterForm({ id, people, presenter, remote }: { id: string; people: { personId: string; name: string; registered: boolean; number: string | null }[]; presenter: string | null; remote: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveFinalPresenter, {});
  const [who, setWho] = useState(presenter ?? people.find((p) => p.registered)?.personId ?? "");
  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      <fieldset className="m-0 mt-2 border-0 p-0">
        <legend className="sr-only">{t("Who presents?")}</legend>
        <div className="flex flex-col gap-2">
          {people.map((p) => (
            <label key={p.personId} className={`flex items-center gap-3 rounded-[6px] border px-3.5 py-3 ${!p.registered ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${who === p.personId ? "border-[#0E1B3D] bg-[#F7F8F6]" : "border-[#DADDE3] bg-white"}`}>
              <input type="radio" name="presenter" value={p.personId} disabled={!p.registered} checked={who === p.personId} onChange={() => setWho(p.personId)} className="accent-[#0E1B3D]" />
              <span className="flex-auto font-semibold">{p.name}</span>
              <span className={`rounded-[3px] px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] ${p.registered ? "bg-[#E1F3EA] text-[#14603F]" : "bg-[#EEF0EC] text-[#4A5263]"}`}>{p.registered ? t("Registered · {no}", { no: p.number ?? "—" }) : t("Not registered")}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <FieldError msg={state.fieldErrors?.presenter} />
      <label className="mt-4 flex gap-3 text-[15px]"><input type="checkbox" name="remote" defaultChecked={remote} className={box} /><span>{t("Ask to present remotely")}<span className="block text-[14px] text-[#4A5263]">{t("Only for visa or health reasons. The program chair decides.")}</span></span></label>
      <ErrorBox msg={state.error} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/submissions/${id}/final/copyright`} className={ghostBtn}>← {t("Copyright")}</Link>
        <button type="submit" disabled={pending || !people.some((p) => p.registered)} className={primaryBtn}>{pending ? t("Saving…") : `${t("Continue to review")} →`}</button>
      </div>
    </form>
  );
}

/** SB12e — attest + submit. */
export function FinalSubmitForm({ id, ready }: { id: string; ready: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(submitFinal, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="mt-5">
      <input type="hidden" name="submissionId" value={id} />
      <label className="flex gap-3 py-2 text-[15px]"><input type="checkbox" name="attestComments" className={box} />{t("We addressed the reviewers' comments in this version.")}</label>
      <FieldError msg={fe.attestComments} />
      <label className="flex gap-3 py-2 text-[15px]"><input type="checkbox" name="attestNoshow" className={box} />{t("We understand the paper is removed from the proceedings if no author presents it.")}</label>
      <FieldError msg={fe.attestNoshow} />
      <ErrorBox msg={state.error} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/submissions/${id}/final/registration`} className={ghostBtn}>← {t("Registration & presenter")}</Link>
        <button type="submit" disabled={pending || !ready} className={primaryBtn}>{pending ? t("Submitting…") : t("Submit final version")}</button>
      </div>
    </form>
  );
}
