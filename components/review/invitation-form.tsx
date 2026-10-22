"use client";

import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { respondInvitation, type ActionState } from "@/lib/review/actions";
import { ui } from "@/components/manage/ui";

type Props = {
  mode: "signed" | "token";
  id: string;            // assignment id (links after accepting)
  token?: string;        // RV02e only
  no: string;            // "#0903"
  due: string;           // formatted due date
  ae: string;            // inviter name
  email?: string | null; // invited email (RV02e sign-in links)
};

const REASONS: ["busy" | "expertise" | "conflict" | "other", string][] = [
  ["busy", "Too busy right now"],
  ["expertise", "Outside my expertise"],
  ["conflict", "Conflict of interest"],
  ["other", "Other"],
];

const box = (on: boolean) => `flex cursor-pointer items-start gap-3 rounded-[6px] border px-3.5 py-3 ${on ? "border-[#B9E0CB] bg-[#F3FAF6]" : "border-[#DADDE3] bg-white"}`;

/** RV02 (signed in) and RV02e (email link, no sign-in) accept / decline. */
export function InvitationForm({ mode, id, token, no, due, ae, email }: Props) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(respondInvitation, {});
  const [coi, setCoi] = useState(false);
  const [can, setCan] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [tried, setTried] = useState(false);

  if (state.ok && state.result === "accepted") {
    const next = encodeURIComponent(`/reviews/${id}`);
    return (
      <div className="rounded-[8px] border border-[#B9E0CB] bg-[#F3FAF6] p-5">
        <h2 className="m-0 font-serif text-[22px] font-normal text-[#14603F]">{t("Thank you — you're reviewing {no}.", { no })}</h2>
        {mode === "signed" ? (
          <>
            <p className="mb-0 mt-2 text-[15px]">{t("The PDF and review form are open now. Due {d}; we'll remind you 3 days before.", { d: due })}</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link href={`/reviews/${id}`} className={ui.primary}>{t("Open review form")}</Link>
              <Link href={`/reviews/${id}/paper`} className={ui.ghost}>{t("Read the paper")}</Link>
            </div>
          </>
        ) : (
          <>
            <p className="mb-0 mt-2 text-[15px]">{t("Sign in to open the PDF and the review form. Due {d}.", { d: due })}</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link href={`/sign-in?next=${next}${email ? `&email=${encodeURIComponent(email)}` : ""}`} className={ui.primary}>{t("Email me a sign-in code")}</Link>
              <Link href={`/sign-in?next=${next}`} className={ui.ghost}>{t("Sign in another way")}</Link>
              <Link href={`/create-account?next=${next}${email ? `&email=${encodeURIComponent(email)}` : ""}`} className={ui.ghost}>{t("Create account")}</Link>
            </div>
            <p className="mb-0 mt-3 text-[13px] text-[#4A5263]">{t("Your acceptance is saved already — it doesn't depend on signing in now.")}</p>
          </>
        )}
      </div>
    );
  }
  if (state.ok && state.result === "declined") {
    return (
      <div className="rounded-[8px] border border-[#DADDE3] bg-white p-5">
        <h2 className="m-0 font-serif text-[22px] font-normal">{mode === "token" ? t("Thanks for letting us know") : t("Declined.")}</h2>
        <p className="mb-0 mt-2 text-[15px] text-[#4A5263]">
          {mode === "token" ? t("{ae} has been told. You don't need an account for this.", { ae }) : t("{ae} has been told, with your suggestion.", { ae })}
        </p>
        {mode === "signed" ? <Link href="/reviews" className="mt-3 inline-block text-[#2F5FD0]">{t("Back to Reviews")}</Link> : null}
      </div>
    );
  }
  if (state.ok) {
    return <div className={ui.warn}>{state.result === "expired" ? t("This invitation has closed.") : t("This invitation was already answered.")}</div>;
  }

  const acceptBlocked = mode === "signed" ? !(coi && can) : !coi;
  const localErr = tried && acceptBlocked ? (mode === "signed" ? t("Tick both boxes to accept.") : t("Confirm you have no conflict first.")) : null;
  const err = localErr ?? (state.error ? t(state.error) : null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {token ? <input type="hidden" name="token" value={token} /> : null}
      <h2 className="m-0 font-serif text-[22px] font-normal">{t("Before you accept")}</h2>
      <label className={box(coi)}>
        <input type="checkbox" name="coi" checked={coi} onChange={(e) => setCoi(e.target.checked)} className="mt-1 size-4 accent-[#18744F]" />
        <span>
          <span className="block text-[15px] font-medium">{t("I have no conflict of interest with this paper")}</span>
          <span className="block text-[13px] text-[#4A5263]">{t("Not a co-author, colleague at the same institution, supervisor or student in the last 5 years, or close collaborator.")}</span>
        </span>
      </label>
      {mode === "signed" ? (
        <label className={box(can)}>
          <input type="checkbox" name="can" checked={can} onChange={(e) => setCan(e.target.checked)} className="mt-1 size-4 accent-[#18744F]" />
          <span className="text-[15px] font-medium">{t("I can submit the review by {d}", { d: due })}</span>
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <button type="submit" name="accept" value="1" disabled={pending}
          onClick={(e) => { if (acceptBlocked) { e.preventDefault(); setTried(true); } }}
          className={ui.primary}>
          {mode === "signed" ? t("Accept and open the paper") : t("Accept — I can review by {d}", { d: due })}
        </button>
        <button type="button" onClick={() => setDeclining((d) => !d)} aria-expanded={declining} className={ui.ghost}>{t("Decline")}</button>
      </div>
      {err ? <p role="alert" className="m-0 text-[14px] text-[#B3261E]">{err}</p> : null}

      {declining ? (
        <div className="flex flex-col gap-3 rounded-[8px] border border-[#DADDE3] bg-[#F7F8F6] p-4">
          {mode === "signed" ? (
            <label className={ui.label}>
              {t("Reason")}
              <select name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className={ui.input}>
                <option value="">{t("Choose…")}</option>
                {REASONS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
              </select>
            </label>
          ) : (
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-1.5 text-[14px] font-medium">{t("Reason (no sign-in needed)")}</legend>
              <input type="hidden" name="reason" value={reason} />
              <div className="flex flex-wrap gap-2">
                {REASONS.map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={reason === k} onClick={() => setReason(k)}
                    className={`h-9 rounded-full border px-3.5 text-[14px] ${reason === k ? "border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#4A5263]"}`}>
                    {t(l)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <label className={ui.label}>
            {mode === "signed" ? t("Suggest another reviewer (optional)") : t("Suggest someone else (optional)")}
            <input name="suggestion" maxLength={300} placeholder={mode === "token" ? t("Name and email") : ""} className={ui.input} />
          </label>
          <div>
            <button type="submit" name="accept" value="0" disabled={pending || !reason} className={ui.navy}>{t("Send decline")}</button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
