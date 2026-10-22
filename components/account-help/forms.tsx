"use client";

import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { findPaper, requestClaim, respondClaim, submitLostEmail, type FindState, type HelpState } from "@/lib/account-help/actions";

const card = "rounded-[8px] border border-[#DADDE3] bg-white px-6 py-5";

/* ---------------------------------------------------------------- lost email */
const PROOFS: [string, string, string][] = [
  ["orcid", "My ORCID iD is on my Plenary profile", "Fastest. We check it against the ORCID record."],
  ["coauthor", "A co-author vouches for me", "We email a co-author from one of your papers to confirm."],
  ["organizer", "An organizer confirms", "For venues where you hold a role; the chair confirms who you are."],
];

export function LostEmailForm({ name, email }: { name: string; email: string }) {
  const t = useT();
  const [s, act, pending] = useActionState<HelpState, FormData>(submitLostEmail, {});
  const [proof, setProof] = useState("orcid");
  if (s.ref) {
    return (
      <section className={card}>
        <div className="flex items-start gap-3.5">
          <span aria-hidden className="flex size-10 flex-none items-center justify-center rounded-full bg-[#E1F3EA] font-bold text-[#14603F]">✓</span>
          <div>
            <h2 className="m-0 font-serif text-[28px] font-normal">{t("Request sent")}</h2>
            <p role="status" className="mt-1 text-[#4A5263]">{t("Your reference is {ref}. We also emailed it to the new address. A person at Plenary checks it within 2 working days.", { ref: s.ref })}</p>
            <p className="mt-3 font-mono text-[22px] font-semibold">{s.ref}</p>
          </div>
        </div>
      </section>
    );
  }
  return (
    <form action={act} className={card}>
      <h2 className="m-0 text-[17px] font-semibold">{t("I lost access to my email")}</h2>
      <p className="mt-1.5 text-[14px] text-[#4A5263]">{t("For example, you changed university and the old address is closed. Tell us who you are and where to move the account.")}</p>
      <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
        <label className={ui.label}>{t("Full name")}<input name="name" required minLength={2} maxLength={200} defaultValue={name} autoComplete="name" className={ui.input} /></label>
        <label className={ui.label}>{t("Plenary ID (if you know it)")}<input name="plenaryId" maxLength={20} placeholder="PL-0000-0000" className={`${ui.input} font-mono`} /></label>
        <label className={ui.label}>{t("Old email (no longer works)")}<input name="oldEmail" type="email" maxLength={254} placeholder="name@old-university.edu" className={ui.input} /></label>
        <label className={ui.label}>{t("New email")}<input name="newEmail" type="email" required maxLength={254} defaultValue={email} autoComplete="email" placeholder="name@new-university.edu" className={ui.input} /></label>
      </div>
      <fieldset className="m-0 mt-[18px] border-0 p-0">
        <legend className="mb-2 p-0 text-[13px] font-semibold">{t("How can we confirm it’s you?")}</legend>
        <div className="flex flex-col gap-2">
          {PROOFS.map(([k, title, d]) => (
            <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-[6px] border px-3.5 py-3 ${proof === k ? "border-[#2F5FD0] bg-[#FBFCFF]" : "border-[#DADDE3] bg-white"}`}>
              <input type="radio" name="proof" value={k} checked={proof === k} onChange={() => setProof(k)} className="mt-1 size-4 accent-[#2F5FD0]" />
              <span className="text-[14px]"><strong>{t(title)}</strong><span className="block text-[13px] text-[#4A5263]">{t(d)}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className={`${ui.label} mt-4`}>{t("Anything else we should know (optional)")}<textarea name="note" rows={3} maxLength={2000} className={ui.textarea} /></label>
      {s.error ? <p role="alert" className={`${ui.bad} mt-4`}>{t(s.error)}</p> : null}
      <div className="mt-[18px]"><button type="submit" disabled={pending} className={ui.primary}>{pending ? t("Sending…") : t("Send request")}</button></div>
    </form>
  );
}

/* ---------------------------------------------------------------- claim */
export function ClaimFinder({ defaultVenue }: { defaultVenue: string }) {
  const t = useT();
  const [s, find, finding] = useActionState<FindState, FormData>(findPaper, {});
  const [c, claim, claiming] = useActionState<FindState, FormData>(requestClaim, {});
  return (
    <section className={card}>
      <h2 className="m-0 text-[17px] font-semibold">{t("Claim a paper")}</h2>
      <p className="mt-1.5 text-[14px] text-[#4A5263]">{t("A co-author added you with an old address, so the paper isn’t linked to you. Find it and ask to be linked.")}</p>
      <form action={find} className="mt-4 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
        <label className={ui.label}>{t("Paper number")}<input name="number" required inputMode="numeric" placeholder="#0702" className={`${ui.input} font-mono`} /></label>
        <label className={ui.label}>{t("Venue")}<input name="venue" required defaultValue={defaultVenue} placeholder={t("Short name or web address, e.g. demo-ca-2027")} className={ui.input} /></label>
        <button type="submit" disabled={finding} className={ui.ghost}>{finding ? t("Finding…") : t("Find paper")}</button>
      </form>
      {s.error ? <p role="alert" className={`${ui.bad} mt-4`}>{t(s.error)}</p> : null}
      {s.searched && !s.found ? <p role="status" className={`${ui.warn} mt-4`}>{t("No submitted paper with that number at that venue.")}</p> : null}
      {s.found ? (
        <div className="mt-4 rounded-[6px] border border-[#DADDE3] p-3.5">
          <p className="m-0 font-semibold">{s.title}</p>
          <p className="m-0 mb-2.5 mt-0.5 text-[13px] text-[#4A5263]">#{String(s.number).padStart(4, "0")} · {s.venue} · {t("{n} authors", { n: s.authors ?? 0 })}</p>
          {s.alreadyAuthor ? <p className={ui.ok}>{t("You are already an author of this paper.")} <Link href="/workspace/submissions">{t("Open My submissions")}</Link></p>
            : (s.candidates ?? []).length === 0 ? <p className={ui.warn}>{t("No unlinked author with your family name is on this paper. If your name is spelled differently, ask the corresponding author to fix it, or contact support.")}</p>
            : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {(s.candidates ?? []).map((a) => (
                  <li key={a.person_id} className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-[#F7F8F6] px-3 py-2.5 text-[14px]">
                    <span>{a.position}. <strong>{a.name}</strong> · {a.email ?? "—"} <span className={`${ui.tag} ml-1 bg-[#FBEFDD] text-[#7A4508]`}>{t("Not linked")}</span></span>
                    {s.pending || c.claimed === a.person_id ? <span role="status" className="text-[13px] text-[#14603F]">{t("Asked. The corresponding author will confirm by email and in their inbox.")}</span> : (
                      <form action={claim}>
                        <input type="hidden" name="submissionId" value={s.submissionId} />
                        <input type="hidden" name="placeholder" value={a.person_id} />
                        <button type="submit" disabled={claiming} className={ui.primary}>{t("This is me — ask to link")}</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          <p className="m-0 mt-2.5 text-[13px] text-[#4A5263]">{t("The corresponding author confirms before the paper moves to your account.")}</p>
          {c.error ? <p role="alert" className={`${ui.bad} mt-3`}>{t(c.error)}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

export function ClaimDecision({ id }: { id: string }) {
  const t = useT();
  const [s, act, pending] = useActionState<HelpState, FormData>(respondClaim, {});
  return (
    <form action={act} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="accept" value="1" disabled={pending} className={ui.primary}>{t("Yes, link them to the paper")}</button>
        <button type="submit" name="accept" value="0" disabled={pending} className={ui.ghost}>{t("No, this isn’t my co-author")}</button>
      </div>
      {s.error ? <p role="alert" className={ui.bad}>{t(s.error)}</p> : null}
    </form>
  );
}
