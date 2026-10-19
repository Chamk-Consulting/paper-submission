"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { detectIdentifier, type Detected } from "@/lib/auth/identifier";
import { startSignup, type StartState } from "@/lib/auth/onboarding-actions";
import {
  sendSignInCode,
  signInWithPassword,
  verifyCode,
  type SignInState,
} from "@/lib/auth/signin-actions";
import { useT } from "@/lib/i18n/client";
import { resendSignInCode } from "@/lib/auth/resend-actions";
import { ResendButton } from "@/components/auth/resend-button";
import { AccountChooser, useDeviceAccounts } from "@/components/signin/account-chooser";
import type { DeviceAccount } from "@/lib/auth/device-accounts";

/* Canvas PR02 tokens */
const INK = "text-[#121826]";
const MUTED = "text-[#4A5263]";
const INPUT =
  "h-11 box-border rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[16px] text-[#121826] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]";
const LABEL = "text-[14px] font-medium";
const PRIMARY =
  "flex h-[46px] w-full items-center justify-center rounded-[4px] border-0 bg-[#F2A93B] text-[15px] font-semibold text-[#0E1B3D] hover:bg-[#E89B26] disabled:opacity-60";
const SECONDARY =
  "flex items-center justify-center gap-2 rounded-[4px] border border-[#B7BDC9] bg-white font-medium text-[#121826] hover:bg-[#F7F8F6]";
const LINK = "text-[#2F5FD0] underline hover:text-[#1F47A8]";
const H1 = "font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]";

const toneStyle: Record<Detected["tone"], { border: string; iconBg: string; iconInk: string; hint: string }> = {
  neutral: { border: "#B7BDC9", iconBg: "#EEF0EC", iconInk: "#4A5263", hint: "#4A5263" },
  info: { border: "#2F5FD0", iconBg: "#E6EDFC", iconInk: "#1F47A8", hint: "#4A5263" },
  ok: { border: "#18744F", iconBg: "#E1F3EA", iconInk: "#14603F", hint: "#14603F" },
  warn: { border: "#A8600F", iconBg: "#FBEFDD", iconInk: "#7A4508", hint: "#7A4508" },
};

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  const t = useT();
  if (!errors?.length) return null;
  return (
    <span id={id} className="text-[13px] text-[#B3261E]">
      {t(errors[0])}
    </span>
  );
}

function Banner({ tone = "bad", children }: { tone?: "bad" | "info"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={`mt-5 rounded-[6px] border px-3.5 py-3 text-[14px] ${tone === "bad" ? "border-[#F0C2BE] bg-[#FDF0EF] text-[#7A1C15]" : "border-[#F1D29A] bg-[#FFF6E6] text-[#3B2A07]"}`}
    >
      {children}
    </div>
  );
}

const KeyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden fill="none" stroke="#121826" strokeWidth="1.5"><circle cx="6" cy="9" r="3.5" /><path d="M9.5 9H16M13.5 9v3M16 9v2" /></svg>
);
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden fill="none" stroke="#121826" strokeWidth="1.5"><rect x="2" y="4" width="14" height="10" rx="1.5" /><path d="M2.5 5l6.5 5 6.5-5" /></svg>
);
const OrcidIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><circle cx="9" cy="9" r="8.5" fill="#A6CE39" /><text x="9" y="12.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="700" fill="#FFFFFF">iD</text></svg>
);
const InstitutionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="#121826" strokeWidth="1.5"><path d="M2 7l7-4 7 4M3.5 7.5v6M7 7.5v6M11 7.5v6M14.5 7.5v6M2 15.5h14" /></svg>
);
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="#121826" strokeWidth="1.5"><path d="M15 9a6 6 0 1 1-1.8-4.3M15 3.5V7h-3.5" /></svg>
);

export function SignInPanel({ next, initialTab = "signin", senderDomain = "[sender domain]" }: { next?: string; initialTab?: "signin" | "create"; senderDomain?: string }) {
  const [tab, setTab] = useState<"signin" | "create">(initialTab);
  const [identifier, setIdentifier] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [soon, setSoon] = useState<string | null>(null);
  const t = useT();
  // PR03: accounts used on this device. The chooser shows until one is picked or "Use another account".
  const [accounts, removeAccount] = useDeviceAccounts();
  const [chooserDone, setChooserDone] = useState(false);
  const [picked, setPicked] = useState<DeviceAccount | null>(null);
  const showChooser = !chooserDone && accounts.length > 0;
  const pick = (a: DeviceAccount) => { setPicked(a); setIdentifier(a.id ?? ""); setChooserDone(true); };
  const other = () => { setPicked(null); setIdentifier(""); setChooserDone(true); };

  const [pwState, pwAction, pwPending] = useActionState(signInWithPassword, {} as SignInState);
  const [codeState, codeAction, codePending] = useActionState(sendSignInCode, {} as SignInState);
  const [createState, createAction, createPending] = useActionState(startSignup, {} as StartState);

  // The code step shows when the current tab's action just sent a code (until "Use a different email").
  const [dismissed, setDismissed] = useState<SignInState | null>(null);
  const sent = tab === "signin" && codeState.step === "sent" && codeState !== dismissed ? codeState : null;

  const d = detectIdentifier(identifier);
  const tone = toneStyle[d.tone];
  const idErrors = pwState.fieldErrors?.identifier ?? codeState.fieldErrors?.identifier;

  const tabBtn = (active: boolean) =>
    `h-[38px] flex-1 rounded-[4px] border-0 text-[14px] font-semibold ${active ? "bg-white text-[#121826] shadow-[0_1px_2px_rgba(18,24,38,.12)]" : "bg-transparent text-[#4A5263]"}`;

  const comingSoon = (what: string) => setSoon(t("{what} sign-in is coming soon. Use your email for now.", { what: t(what) }));

  return (
    <div className="w-full max-w-[420px]">
      <div role="tablist" aria-label={t("Account")} className="flex gap-1 rounded-[6px] bg-[#E9EBE6] p-1">
        <button type="button" role="tab" aria-selected={tab === "signin"} className={tabBtn(tab === "signin")} onClick={() => { setTab("signin"); setSoon(null); }}>{t("Sign in")}</button>
        <button type="button" role="tab" aria-selected={tab === "create"} className={tabBtn(tab === "create")} onClick={() => { setTab("create"); setSoon(null); }}>{t("Create account")}</button>
      </div>

      {sent ? (
        <CodeStep key={sent.email} state={sent} next={next} onBack={() => setDismissed(sent)} senderDomain={senderDomain} />
      ) : tab === "signin" && showChooser ? (
        <AccountChooser accounts={accounts} onPick={pick} onOther={other} onRemove={removeAccount} />
      ) : tab === "signin" ? (
        <>
          <h1 className={`mt-7 ${H1}`}>{picked ? t("Hello again, {name}", { name: picked.name.split(" ")[0] }) : t("Welcome back")}</h1>
          <p className={`mt-2 ${MUTED}`}>{picked && !picked.id ? t("Enter the full email for {email}.", { email: picked.email }) : t("One account for submitting, reviewing and chairing — at every venue.")}</p>
          {accounts.length > 0 ? (
            <button type="button" onClick={() => { setChooserDone(false); setPicked(null); setIdentifier(""); }} className={`mt-1 min-h-6 border-0 bg-transparent p-0 text-[14px] ${LINK}`}>{picked ? t("Not you? Choose another account") : t("Choose an account on this device")}</button>
          ) : null}
          {pwState.message ? <Banner>{t(pwState.message)}</Banner> : null}
          {codeState.message ? <Banner>{t(codeState.message)}</Banner> : null}
          {soon ? <Banner tone="info">{soon}</Banner> : null}

          <form action={pwAction} noValidate>
            <input type="hidden" name="next" value={next ?? ""} />
            <div className="mt-6 flex flex-col gap-1.5">
              <label htmlFor="pr-id" className={LABEL}>{t("Email, phone, Plenary ID or alias")}</label>
              <div className="box-border flex h-12 items-center gap-2.5 rounded-[4px] border-2 bg-white px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2F5FD0]" style={{ borderColor: idErrors?.length ? "#B3261E" : tone.border }}>
                <span aria-hidden className="flex size-7 flex-none items-center justify-center rounded-[4px] font-mono text-[10px] font-semibold" style={{ background: tone.iconBg, color: tone.iconInk }}>{d.icon}</span>
                <input
                  id="pr-id" name="identifier" type="text" autoComplete="username webauthn" autoCapitalize="none" spellCheck={false}
                  placeholder="name@uni.edu · +234… · PL-4821-0937 · a.researcher"
                  value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                  aria-describedby="pr-id-hint pr-id-err" aria-invalid={idErrors?.length ? true : undefined}
                  className="h-10 min-w-0 flex-auto border-0 bg-transparent text-[16px] text-[#121826] outline-none"
                />
                {d.chip ? <span className="whitespace-nowrap rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]" style={{ background: tone.iconBg, color: tone.iconInk }}>{t(d.chip)}</span> : null}
              </div>
              <span id="pr-id-hint" className="text-[13px]" style={{ color: tone.hint }}>{t(d.hint)}</span>
              <FieldError id="pr-id-err" errors={idErrors} />
              {d.kind === "pin" ? (
                <Link href="/contact?topic=import" className="mt-1 flex items-center gap-3 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3 py-2.5 text-[13px] text-[#3B2A07] no-underline">
                  <span className="flex-auto"><strong>{t("Looks like a PaperCept PIN.")}</strong> {t("It can’t sign you in here, but it can bring your history across.")}</span>
                  <span className="whitespace-nowrap font-semibold text-[#7A4508]">{t("Bring history →")}</span>
                </Link>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="pr-pass1" className={LABEL}>{t("Password")}</label>
                <Link href="/forgot-password" className={`text-[13px] ${LINK}`}>{t("Forgot password?")}</Link>
              </div>
              <div className="flex overflow-hidden rounded-[4px] border bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2F5FD0]" style={{ borderColor: pwState.fieldErrors?.password?.length ? "#B3261E" : "#B7BDC9" }}>
                <input id="pr-pass1" name="password" type={showPass ? "text" : "password"} autoComplete="current-password" aria-describedby="pr-pass-err"
                  className="box-border h-11 min-w-0 flex-auto border-0 bg-transparent px-3.5 text-[16px] text-[#121826] outline-none" />
                <button type="button" onClick={() => setShowPass((s) => !s)} aria-label={showPass ? t("Hide password") : t("Show password")}
                  className="w-[68px] border-0 border-l border-[#B7BDC9] bg-[#F2F3F0] text-[13px] font-medium text-[#4A5263]">{showPass ? t("Hide") : t("Show")}</button>
              </div>
              <FieldError id="pr-pass-err" errors={pwState.fieldErrors?.password} />
            </div>

            <label className="mt-3 flex min-h-6 items-center gap-2.5 text-[14px]">
              <input type="checkbox" name="remember" className="size-[18px] accent-[#0E1B3D]" />{t("Keep me signed in on this device")}
            </label>
            <button type="submit" disabled={pwPending} className={`mt-4 ${PRIMARY}`}>{pwPending ? t("Signing in…") : t("Sign in")}</button>
          </form>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => comingSoon("Passkey")} className={`h-10 text-[13px] ${SECONDARY}`}><KeyIcon />{t("Use a passkey")}</button>
            <form action={codeAction}>
              <input type="hidden" name="identifier" value={identifier} />
              <input type="hidden" name="next" value={next ?? ""} />
              <button type="submit" disabled={codePending} className={`h-10 w-full text-[13px] ${SECONDARY}`}><MailIcon />{codePending ? t("Sending…") : t("Email me a link")}</button>
            </form>
          </div>

          <div className={`my-[22px] flex items-center gap-3 text-[13px] ${MUTED}`}>
            <span className="h-px flex-auto bg-[#DADDE3]" />{t("or continue with")}<span className="h-px flex-auto bg-[#DADDE3]" />
          </div>
          {/* TODO(auth): wire ORCID (custom OIDC), Institution (SAML) and Google once providers are configured. */}
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => comingSoon("ORCID")} className={`h-11 text-[14px] ${SECONDARY}`}><OrcidIcon />ORCID</button>
            <button type="button" onClick={() => comingSoon("Institution")} className={`h-11 text-[14px] ${SECONDARY}`}><InstitutionIcon />{t("Institution")}</button>
            <button type="button" onClick={() => comingSoon("Google")} className={`h-11 text-[14px] ${SECONDARY}`}><GoogleIcon />Google</button>
          </div>
          <p className={`mt-5 text-[14px] ${MUTED}`}>{t("Had a PIN on another conference system?")} <Link href="/contact?topic=import" className={LINK}>{t("Bring your history")}</Link></p>
        </>
      ) : (
        <CreateStep state={createState} action={createAction} pending={createPending} next={next} onOrcid={() => comingSoon("ORCID")} soon={soon} />
      )}
    </div>
  );
}

function CreateStep({ state, action, pending, next, onOrcid, soon }: {
  state: StartState; action: (fd: FormData) => void; pending: boolean; next?: string; onOrcid: () => void; soon: string | null;
}) {
  const t = useT();
  const e = state.fieldErrors;
  const nameErr = e?.firstName?.[0] ?? e?.lastName?.[0];
  const inv = (k: string) => (e?.[k]?.length ? { "aria-invalid": true as const, style: { borderColor: "#B3261E" } } : {});
  return (
    <>
      <h1 className={`mt-7 ${H1}`}>{t("Create your account")}</h1>
      <p className={`mt-2 ${MUTED}`}>{t("Free for authors and reviewers. Takes about a minute.")}</p>
      {state.message ? <Banner>{t(state.message)}</Banner> : null}
      {soon ? <Banner tone="info">{soon}</Banner> : null}
      <button type="button" onClick={onOrcid} className={`mt-5 h-[46px] w-full text-[15px] font-semibold ${SECONDARY}`}><OrcidIcon />{t("Fill in from ORCID")}</button>
      <form action={action} noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5"><label htmlFor="pr-first" className={LABEL}>{t("First name")}</label><input id="pr-first" name="firstName" autoComplete="given-name" className={INPUT} {...inv("firstName")} /></div>
          <div className="flex flex-col gap-1.5"><label htmlFor="pr-last" className={LABEL}>{t("Last name")}</label><input id="pr-last" name="lastName" autoComplete="family-name" className={INPUT} {...inv("lastName")} /></div>
        </div>
        {nameErr ? <p className="mt-1.5 text-[13px] text-[#B3261E]">{t(nameErr)}</p> : null}
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5"><label htmlFor="pr-cemail" className={LABEL}>{t("Email")}</label><input id="pr-cemail" name="email" type="email" autoComplete="email" placeholder={t("Institutional email preferred")} className={INPUT} {...inv("email")} /><FieldError id="e-email" errors={e?.email} /></div>
          <div className="flex flex-col gap-1.5"><label htmlFor="pr-aff" className={LABEL}>{t("Affiliation")}</label><input id="pr-aff" name="affiliation" autoComplete="organization" placeholder={t("University or company")} className={INPUT} /></div>
          <label className="flex items-start gap-2.5 text-[14px]"><input type="checkbox" name="consent" className="mt-0.5 size-[18px] flex-none accent-[#0E1B3D]" />
            <span>{t("I agree to the")} <Link href="/legal/terms" className={LINK}>{t("Terms")}</Link> {t("and the")} <Link href="/legal/privacy" className={LINK}>{t("Privacy notice")}</Link> (GDPR).</span>
          </label>
          <FieldError id="e-consent" errors={e?.consent} />
        </div>
        <button type="submit" disabled={pending} className={`mt-[18px] ${PRIMARY}`}>{pending ? t("Creating…") : t("Create account")}</button>
      </form>
    </>
  );
}

function CodeStep({ state, next, onBack, senderDomain }: { state: SignInState; next?: string; onBack: () => void; senderDomain: string }) {
  const t = useT();
  const [vState, vAction, vPending] = useActionState(verifyCode, state);
  const byEmail = state.sentKind === "email";
  const lead = byEmail ? t("We sent a link and a 6-digit code to") : t("We sent a link and a 6-digit code to your account email");
  return (
    <>
      <p className="mt-7 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#18744F]">{t("Link sent")}</p>
      <h1 className={`mt-2.5 ${H1}`}>{t("Check your inbox")}</h1>
      <p className={`mt-2.5 ${MUTED}`}>{lead} <strong className={INK}>{state.sentTo}</strong>. {t("It expires in 15 minutes. On another device? Enter the code from the same email.")}</p>
      <form action={vAction} noValidate>
        <input type="hidden" name="email" value={state.email ?? ""} />
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="mt-[22px] flex flex-col gap-1.5">
          <label htmlFor="pr-code" className={LABEL}>{t("Verification code")}</label>
          <input id="pr-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" aria-describedby="pr-code-err"
            className="box-border h-[46px] rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 font-mono text-[18px] tracking-[0.3em] text-[#121826] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]"
            style={vState.fieldErrors?.code?.length ? { borderColor: "#B3261E" } : undefined} />
          <FieldError id="pr-code-err" errors={vState.fieldErrors?.code} />
        </div>
        <button type="submit" disabled={vPending} className={`mt-4 ${PRIMARY}`}>{vPending ? t("Checking…") : t("Verify and sign in")}</button>
      </form>
      <div className="mt-4 flex flex-wrap items-start gap-4 text-[14px]">
        <ResendButton send={() => resendSignInCode(state.email ?? "", next)} label={t("Resend code")} />
        <button type="button" onClick={onBack} className={`min-h-6 border-0 bg-transparent p-0 text-[14px] ${LINK}`}>{t("Use a different email")}</button>
      </div>
      <p className={`mt-5 text-[13px] ${MUTED}`}>{t("Not arriving? Check spam, or ask your IT team to allow mail from")} <span className="font-mono">{senderDomain}</span>.</p>
    </>
  );
}
