"use client";

import Link from "@/components/site/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { focusFirstError } from "@/components/auth/focus-error";
import { startSignup, type StartState } from "@/lib/auth/onboarding-actions";
import { OrcidIcon, ui } from "@/components/auth/split-layout";
import { useT } from "@/lib/i18n/client";
import { PasswordFields } from "@/components/auth/password-fields";
import { FieldLabel } from "@/components/auth/field-label";
import { Turnstile } from "@/components/site/turnstile";

type EmailCheck = { border: string; chip?: string; chipBg?: string; chipInk?: string; hint: string; hintInk: string };

function checkEmail(v: string, tried: boolean): EmailCheck {
  const t = v.trim().toLowerCase();
  if (!t)
    return tried
      ? { border: "2px solid #B3261E", hint: "Enter your email address.", hintInk: "#B3261E" }
      : { border: "1px solid #B7BDC9", hint: "Use your university or institute email if you have one.", hintInk: "#4A5263" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t))
    return tried
      ? { border: "2px solid #B3261E", hint: "That doesn’t look like a full email, e.g. name@university.edu", hintInk: "#B3261E" }
      : { border: "2px solid #2F5FD0", hint: "Keep typing…", hintInk: "#4A5263" };
  if (/\.(edu|ac\.[a-z]{2}|edu\.[a-z]{2})$/.test(t) || /@(uni|univ|university)[.-]/.test(t))
    return { border: "2px solid #18744F", chip: "INSTITUTION ✓", chipBg: "#E1F3EA", chipInk: "#14603F", hint: "University email — we’ll suggest your affiliation next.", hintInk: "#14603F" };
  return { border: "2px solid #2F5FD0", chip: "EMAIL", chipBg: "#E6EDFC", chipInk: "#1F47A8", hint: "Personal email works too. You can add a university one later.", hintInk: "#4A5263" };
}

/**
 * Step 1 of 4: name, email and terms. The password is chosen after the email code (step 3), unless the
 * rollback switch (SIGNUP_PASSWORD_FIRST=1) asks for the old order, where it is chosen here.
 */
export function CreateAccountForm({ next, venue, withPassword = false }: { next?: string; venue?: string; withPassword?: boolean }) {
  const [state, action, pending] = useActionState(startSignup, {} as StartState);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [tried, setTried] = useState(false);
  const [orcidSoon, setOrcidSoon] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const t = useT();
  // server answered with field errors: focus the first one (plan D3)
  useEffect(() => { if (state.fieldErrors || state.message) focusFirstError(formRef.current?.parentElement); }, [state]);

  const e = checkEmail(email, tried);
  const fe = state.fieldErrors;
  const firstBad = (tried && !first.trim()) || !!fe?.firstName;
  const lastBad = (tried && !last.trim()) || !!fe?.lastName;
  const emailErr = fe?.email?.[0];
  const agreeErr = (tried && !agree) || !!fe?.consent;
  const red = "2px solid #B3261E";
  const norm = "1px solid #B7BDC9";

  return (
    <>
      <div role="tablist" aria-label={t("Account")} className="flex gap-1 rounded-[6px] bg-[#E9EBE6] p-1">
        <Link href={`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`} role="tab" aria-selected={false} className="flex h-[38px] flex-1 items-center justify-center rounded-[4px] text-[14px] font-semibold text-[#4A5263] no-underline">{t("Sign in")}</Link>
        <span role="tab" aria-selected className="flex h-[38px] flex-1 items-center justify-center rounded-[4px] bg-white text-[14px] font-semibold text-[#121826] shadow-[0_1px_2px_rgba(18,24,38,.12)]">{t("Create account")}</span>
      </div>

      <p className={`mt-[26px] ${ui.kicker}`}>{t("Step 1 of 4")}</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>{t("Create your account")}</h1>
      <p className={`mt-2 ${ui.muted}`}>{t("Free for authors and reviewers. Takes about a minute.")}</p>

      <p className="mt-1.5 text-[13px] text-[#4A5263]"><span aria-hidden className="text-[#B3261E]">*</span> {t("Required field")}</p>
      {state.exists ? <ExistingAccount email={state.exists.email} next={next} /> : null}
      {state.message ? <div role="alert" data-form-error className="mt-4 rounded-[6px] border border-[#F0C2BE] bg-[#FDF0EF] px-3.5 py-3 text-[14px] text-[#7A1C15]">{t(state.message)}</div> : null}
      {orcidSoon ? <div role="status" className="mt-4 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-3 text-[14px] text-[#3B2A07]">{t("ORCID sign-up is coming soon. Use your email for now.")}</div> : null}

      {/* TODO(auth): ORCID via Supabase custom OIDC provider. */}
      <button type="button" onClick={() => setOrcidSoon(true)} className={`mt-5 h-[46px] w-full gap-2.5 text-[15px] font-semibold ${ui.secondary}`}><OrcidIcon />{t("Continue with ORCID")}</button>

      <div className={`my-5 flex items-center gap-3 text-[13px] ${ui.muted}`}>
        <span className="h-px flex-auto bg-[#DADDE3]" />{t("or use your email")}<span className="h-px flex-auto bg-[#DADDE3]" />
      </div>

      <form ref={formRef} action={action} noValidate onSubmit={(ev) => {
        setTried(true);
        // stay on the page (keeping everything typed) until the basics are right; the server checks again
        if (!first.trim() || !last.trim() || !agree || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) || (withPassword && !pwOk)) {
          ev.preventDefault();
          focusFirstError(formRef.current);
        }
      }}>
        <input type="hidden" name="next" value={next ?? ""} />
        <input type="hidden" name="venue" value={venue ?? ""} />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="pr6-first" required info={t("As it appears on your papers. Co-authors and chairs find you by this name.")}>{t("First name")}</FieldLabel>
            <input id="pr6-first" name="firstName" aria-required="true" autoComplete="given-name" value={first} onChange={(ev) => setFirst(ev.target.value)} aria-invalid={firstBad || undefined} className={ui.input} style={{ border: firstBad ? red : norm }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="pr6-last" required>{t("Last name")}</FieldLabel>
            <input id="pr6-last" name="lastName" aria-required="true" autoComplete="family-name" value={last} onChange={(ev) => setLast(ev.target.value)} aria-invalid={lastBad || undefined} className={ui.input} style={{ border: lastBad ? red : norm }} />
          </div>
        </div>
        {firstBad || lastBad ? <p className={`mt-1.5 ${ui.error}`}>{t("Enter your first and last name as they appear on your papers.")}</p> : null}

        <div className="mt-3.5 flex flex-col gap-1.5">
          <FieldLabel htmlFor="pr6-email" required info={t("We send a code here to confirm it’s you. A university or institute email helps chairs recognise you; you can add other emails later.")}>{t("Email")}</FieldLabel>
          <div className="box-border flex h-12 items-center gap-2.5 rounded-[4px] bg-white px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2F5FD0]" style={{ border: emailErr ? red : e.border }}>
            <input id="pr6-email" name="email" aria-required="true" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="name@university.edu"
              value={email} onChange={(ev) => setEmail(ev.target.value)} aria-describedby="pr6-email-hint" aria-invalid={emailErr ? true : undefined}
              className="h-10 min-w-0 flex-auto border-0 bg-transparent text-[16px] text-[#121826] outline-none" />
            {e.chip ? <span className="whitespace-nowrap rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]" style={{ background: e.chipBg, color: e.chipInk }}>{t(e.chip)}</span> : null}
          </div>
          <span id="pr6-email-hint" className="text-[13px]" style={{ color: emailErr ? "#B3261E" : e.hintInk }}>{t(emailErr ?? e.hint)}</span>
        </div>

        {withPassword ? <PasswordFields email={email} tried={tried} serverErrors={{ password: fe?.password, confirm: fe?.confirm }} idPrefix="pr6" onValid={setPwOk} /> : null}

        <label className="mt-4 flex items-start gap-2.5 text-[14px]">
          <input type="checkbox" name="consent" aria-required="true" checked={agree} onChange={(ev) => setAgree(ev.target.checked)} aria-invalid={agreeErr || undefined} className="mt-0.5 size-[18px] flex-none accent-[#0E1B3D]" />
          {/* Supabase project region: eu-central-1 (Frankfurt). */}
          <span><span aria-hidden className="mr-0.5 text-[#B3261E]">*</span>{t("I agree to the")} <Link href="/legal/terms" className={ui.link}>{t("Terms")}</Link> {t("and the")} <Link href="/legal/privacy" className={ui.link}>{t("Privacy notice")}</Link>. {t("Your data is stored in the EU (GDPR).")}</span>
        </label>
        {agreeErr ? <p className={`ml-7 mt-1.5 ${ui.error}`}>{t("Please agree to continue.")}</p> : null}

        <Turnstile />
        <button type="submit" disabled={pending} className={`mt-[18px] ${ui.primary}`}>{pending ? t("Sending your code…") : withPassword ? t("Create account") : t("Continue")}</button>
      </form>
      <p className={`mt-3 text-[13px] ${ui.muted}`}>{withPassword ? t("Next, we'll email you a code to confirm your address.") : t("Next, we'll email you a code. After it, you choose your password.")}</p>
      <p className={`mt-[22px] text-[14px] ${ui.muted}`}>{t("Used PaperCept before?")} <Link href="/contact?topic=import" className={ui.link}>{t("Bring your history")}</Link> {t("after you sign up.")}</p>
    </>
  );
}

/** The email already has a Plenary account: go to sign-in (email filled in) or reset the password. */
function ExistingAccount({ email, next }: { email: string; next?: string }) {
  const t = useT();
  const q = (extra: Record<string, string>) => {
    const p = new URLSearchParams(extra);
    if (next) p.set("next", next);
    return p.toString();
  };
  return (
    <div role="alert" className="mt-4 rounded-[8px] border border-[#BCCDF3] bg-[#F3F6FD] px-4 py-3.5 text-[14px] text-[#121826]">
      <p className="m-0 font-semibold">{t("You already have a Plenary account")}</p>
      <p className="m-0 mt-1 text-[#4A5263]">{t("{email} is already registered. Sign in instead — your papers and reviews are there.", { email })}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/sign-in?${q({ email })}`} className="inline-flex h-10 items-center rounded-[4px] bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white no-underline">{t("Sign in")}</Link>
        <Link href={`/forgot-password?${q({ email })}`} className="inline-flex h-10 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[14px] font-medium text-[#121826] no-underline">{t("Forgot password?")}</Link>
      </div>
      <p className="m-0 mt-2.5 text-[13px] text-[#4A5263]">{t("No password yet? On the sign-in page choose “Email me a link” — it also contains a code.")}</p>
    </div>
  );
}
