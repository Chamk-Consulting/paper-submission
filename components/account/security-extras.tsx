"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { sx } from "@/components/account/styles";
import type { SecurityPlus } from "@/lib/account/security-data";
import {
  cancelAddEmail, cancelEnroll, changeSignInEmail, enrollTotp, removeEmail, removeFactor, startAddEmail, verifyAddEmail, verifyEnroll,
  type SecState,
} from "@/lib/account/security-actions";

/* ST02 extensions: sign-in methods list, authenticator apps and email addresses. */

const small = "inline-flex h-8 items-center whitespace-nowrap rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60";
const danger = `${small} text-[#B3261E]!`;
const navy = "inline-flex h-9 items-center whitespace-nowrap rounded-[4px] border-0 bg-[#0E1B3D] px-3.5 text-[14px] font-semibold text-white disabled:opacity-60";
const tagCls = "rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]";
const on = `${tagCls} bg-[#E1F3EA] text-[#14603F]`;
const off = `${tagCls} bg-[#EEF0EC] text-[#4A5263]`;
const row = "flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF0EC] py-3";
const codeInput = "box-border h-10 w-[150px] rounded-[4px] border border-[#B7BDC9] bg-white px-3 font-mono text-[17px] tracking-[0.25em] text-[#121826] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]";

function Msg({ s }: { s: SecState | null | undefined }) {
  const t = useT();
  if (!s || (!s.error && !s.info)) return null;
  return s.error
    ? <p role="alert" data-form-error className="m-0 mt-2 text-[13px] text-[#B3261E]">{t(s.error)}</p>
    : <p role="status" className="m-0 mt-2 text-[13px] text-[#14603F]">{t(s.info!)}</p>;
}

/* ---------------------------------------------------------------- sign-in methods */
export function SignInMethods({ email, plus, orcid }: { email: string; plus: SecurityPlus; orcid: boolean }) {
  const t = useT();
  const verified = plus.factors.filter((f) => f.verified);
  const [setup, setSetup] = useState(false);
  const soon = <span className={`${small} text-[#6B7385]!`} aria-disabled title={t("Coming soon")}>{t("Coming soon")}</span>;
  return (
    <section className={sx.card}>
      <h2 className={sx.h2}>{t("Sign-in methods")}</h2>
      {verified.length === 0 ? (
        <p className="m-0 mt-2 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3 py-2 text-[13px] text-[#7A4508]">{t("Use at least two, so you can always get back in. Add an authenticator app so a stolen password or email alone can’t open your account.")}</p>
      ) : <p className={sx.sub + " text-[13px]"}>{t("Use at least two, so you can always get back in.")}</p>}
      <div className="mt-3.5">
        <div className={row}>
          <span className="min-w-0"><strong className="text-[14px]">{t("Email code")}</strong><span className="block break-all text-[13px] text-[#4A5263]">{email} · {t("always available as backup")}</span></span>
          <span className="flex items-center gap-2"><span className={on}>{t("ON")}</span><a href="#emails" className={small + " no-underline"}>{t("Manage emails")}</a></span>
        </div>
        <div className={row}>
          <span className="min-w-0"><strong className="text-[14px]">{t("Password")}</strong><span className="block text-[13px] text-[#4A5263]">{t("Never set one? Use “Forgot it?” below to create it.")}</span></span>
          <span className="flex items-center gap-2"><a href="#password" className={small + " no-underline"}>{t("Change")}</a></span>
        </div>
        <div className={`${row} items-start`}>
          <span className="min-w-0 flex-auto">
            <strong className="text-[14px]">{t("Authenticator app (2-step)")}</strong>
            <span className="block text-[13px] text-[#4A5263]">{verified.length ? t("Asked for after your password or email code.") : t("Adds a 6-digit code after your password")}</span>
            {verified.map((f) => <FactorLine key={f.id} id={f.id} name={f.name} canRemove={plus.level === "aal2"} />)}
            {verified.length === 1 ? <span className="mt-1 block text-[12px] text-[#4A5263]">{t("Tip: add a backup app on a second device — if you lose your phone, it gets you back in.")}</span> : null}
            {setup ? <TotpSetup onDone={() => setSetup(false)} /> : null}
          </span>
          <span className="flex items-center gap-2">
            <span className={verified.length ? on : off}>{verified.length ? t("ON") : t("OFF")}</span>
            {!setup && verified.length < 2 ? <button type="button" onClick={() => setSetup(true)} className={small}>{verified.length ? t("Add backup app") : t("Set up")}</button> : null}
          </span>
        </div>
        <div className={row}>
          <span className="min-w-0"><strong className="text-[14px]">{t("Passkey")}</strong><span className="block text-[13px] text-[#4A5263]">{t("Face or fingerprint — fastest and safest")}</span></span>
          <span className="flex items-center gap-2"><span className={off}>{t("OFF")}</span>{soon}</span>
        </div>
        <div className={row}>
          <span className="min-w-0"><strong className="text-[14px]">ORCID</strong><span className="block text-[13px] text-[#4A5263]">{orcid ? t("ORCID linked") : t("Sign in with your ORCID iD")}</span></span>
          <span className="flex items-center gap-2"><span className={orcid ? on : off}>{orcid ? t("LINKED") : t("OFF")}</span>{soon}</span>
        </div>
        <div className={row}>
          <span className="min-w-0"><strong className="text-[14px]">Google</strong><span className="block text-[13px] text-[#4A5263]">{t("Sign in with your Google account")}</span></span>
          <span className="flex items-center gap-2"><span className={off}>{t("OFF")}</span>{soon}</span>
        </div>
      </div>
    </section>
  );
}

function FactorLine({ id, name, canRemove }: { id: string; name: string; canRemove: boolean }) {
  const t = useT();
  const [ask, setAsk] = useState(false);
  const [res, setRes] = useState<SecState | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const label = name.split(" · ")[0];
  return (
    <span className="mt-2 block rounded-[6px] border border-[#EEF0EC] bg-[#FBFBF9] px-3 py-2">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px]"><strong>{t(label)}</strong> <span className="text-[#4A5263]">· {t("verified")}</span></span>
        {!ask ? <button type="button" onClick={() => setAsk(true)} className={danger}>{t("Remove")}</button> : (
          <span className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => start(async () => { const r = await removeFactor(id); setRes(r); if (r.ok) router.refresh(); })} className={danger}>{pending ? t("Removing…") : t("Remove it")}</button>
            <button type="button" onClick={() => { setAsk(false); setRes(null); }} className={small}>{t("Cancel")}</button>
          </span>
        )}
      </span>
      {ask && !canRemove && !res ? <span className="mt-1 block text-[12px] text-[#7A4508]">{t("You’ll need to have entered an app code in this session.")}</span> : null}
      <Msg s={res} />
    </span>
  );
}

function TotpSetup({ onDone }: { onDone: () => void }) {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [res, setRes] = useState<SecState | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const begin = () => start(async () => { const r = await enrollTotp(); if (r.ok) setF(r); else setErr(r.error); });
  if (!f) {
    return (
      <span className="mt-3 block rounded-[8px] border border-[#DADDE3] bg-white p-3.5">
        <span className="block text-[14px] font-semibold">{t("Set up an authenticator app")}</span>
        <span className="mt-1 block text-[13px] text-[#4A5263]">{t("Install an app such as Google Authenticator, Microsoft Authenticator or 1Password on your phone, then continue.")}</span>
        <span className="mt-3 flex gap-2">
          <button type="button" disabled={pending} onClick={begin} className={navy}>{pending ? t("Preparing…") : t("Continue")}</button>
          <button type="button" onClick={onDone} className={small}>{t("Cancel")}</button>
        </span>
        {err ? <span role="alert" className="mt-2 block text-[13px] text-[#B3261E]">{t(err)}</span> : null}
      </span>
    );
  }
  return (
    <span className="mt-3 block rounded-[8px] border border-[#DADDE3] bg-white p-3.5">
      <span className="block text-[14px] font-semibold">{t("1 · Scan this code with the app")}</span>
      <span className="mt-2 flex flex-wrap items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.qr} alt={t("QR code for your authenticator app")} width={164} height={164} className="rounded-[6px] border border-[#EEF0EC] bg-white p-1.5" />
        <span className="min-w-0 flex-auto text-[13px] text-[#4A5263]">
          {t("Can’t scan? Type this key into the app instead:")}
          <span className="mt-1 block break-all rounded-[4px] bg-[#F5F6F3] px-2 py-1.5 font-mono text-[13px] text-[#121826]">{f.secret}</span>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(f.secret).then(() => setCopied(true)).catch(() => {}); }} className={`mt-1.5 ${small}`}>{copied ? t("Copied ✓") : t("Copy key")}</button>
        </span>
      </span>
      <span className="mt-4 block text-[14px] font-semibold">{t("2 · Enter the 6-digit code it shows")}</span>
      <span className="mt-2 flex flex-wrap items-center gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" aria-label={t("6-digit code")} className={codeInput} />
        <button type="button" disabled={pending} onClick={() => start(async () => { const r = await verifyEnroll(f.factorId, code); setRes(r); if (r.ok) { onDone(); router.refresh(); } })} className={navy}>{pending ? t("Checking…") : t("Turn on")}</button>
        <button type="button" onClick={() => { void cancelEnroll(f.factorId); onDone(); }} className={small}>{t("Cancel")}</button>
      </span>
      <Msg s={res} />
    </span>
  );
}

/* ---------------------------------------------------------------- email addresses */
export function EmailAddresses({ email, plus }: { email: string; plus: SecurityPlus }) {
  const t = useT();
  const extras = plus.emails.filter((e) => !e.primary);
  const [changing, setChanging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [chg, chgAction, chgPending] = useActionState<SecState, FormData>(changeSignInEmail, {});
  return (
    <section id="emails" className={sx.card}>
      <h2 className={sx.h2}>{t("Email addresses")}</h2>
      <p className={sx.sub + " text-[13px]"}>{t("Add the other addresses you publish with. Co-authors and chairs can find you by any of them, and papers sent to them are linked to you. Codes and notices go to your sign-in email.")}</p>
      <div className="mt-3.5">
        <div className={`${row} items-start`}>
          <span className="min-w-0 flex-auto">
            <strong className="break-all text-[14px]">{email}</strong> <span className={`${tagCls} bg-[#E6EDFC] text-[#1F47A8]`}>{t("SIGN-IN")}</span>
            {plus.pendingEmail ? <span className="mt-1 block text-[13px] text-[#7A4508]">{t("Changing to {email} — confirm from both inboxes to finish.", { email: plus.pendingEmail })}</span> : null}
            {changing ? (
              <form action={chgAction} className="mt-2.5 flex flex-wrap items-center gap-2">
                <input name="email" type="email" required autoComplete="email" placeholder={t("New sign-in email")} aria-label={t("New sign-in email")} className={`${sx.input} h-9! w-[260px] max-w-full`} />
                <button type="submit" disabled={chgPending} className={navy}>{chgPending ? t("Sending…") : t("Send confirmation")}</button>
                <button type="button" onClick={() => setChanging(false)} className={small}>{t("Cancel")}</button>
              </form>
            ) : null}
            <Msg s={chg} />
          </span>
          {!changing ? <button type="button" onClick={() => setChanging(true)} className={small}>{t("Change")}</button> : null}
        </div>
        {extras.map((e) => <ExtraEmail key={e.email} email={e.email} />)}
        {plus.extraEmailsReady ? (
          adding ? <AddEmail onDone={() => setAdding(false)} /> : (
            <div className="border-t border-[#EEF0EC] pt-3">
              <button type="button" onClick={() => setAdding(true)} className={small}>{t("+ Add email")}</button>
            </div>
          )
        ) : <p className="m-0 border-t border-[#EEF0EC] pt-3 text-[13px] text-[#4A5263]">{t("Adding more emails will be available soon.")}</p>}
      </div>
    </section>
  );
}

function ExtraEmail({ email }: { email: string }) {
  const t = useT();
  const router = useRouter();
  const [res, setRes] = useState<SecState | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className={row}>
      <span className="min-w-0"><span className="break-all text-[14px]">{email}</span> <span className={on}>{t("VERIFIED")}</span><Msg s={res} /></span>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await removeEmail(email); setRes(r.ok ? null : r); if (r.ok) router.refresh(); })} className={danger}>{pending ? t("Removing…") : t("Remove")}</button>
    </div>
  );
}

function AddEmail({ onDone }: { onDone: () => void }) {
  const t = useT();
  const router = useRouter();
  const [start, startAction, startPending] = useActionState<SecState, FormData>(startAddEmail, {});
  const [check, checkAction, checkPending] = useActionState<SecState, FormData>(async (p: SecState, fd: FormData) => {
    const r = await verifyAddEmail(p, fd);
    if (r.ok) { onDone(); router.refresh(); }
    return r;
  }, {});
  const codeStep = start.step === "code";
  const target = check.email ?? start.email;
  return (
    <div className="border-t border-[#EEF0EC] py-3">
      {!codeStep ? (
        <form action={startAction} className="flex flex-wrap items-center gap-2">
          <input name="email" type="email" required autoComplete="email" placeholder="name@university.edu" aria-label={t("Email to add")} className={`${sx.input} h-9! w-[260px] max-w-full`} />
          <button type="submit" disabled={startPending} className={navy}>{startPending ? t("Sending…") : t("Send code")}</button>
          <button type="button" onClick={onDone} className={small}>{t("Cancel")}</button>
        </form>
      ) : (
        <>
          <p className="m-0 text-[13px] text-[#4A5263]">{t("We sent a 6-digit code to {email}. It expires in 10 minutes.", { email: target ?? "" })}</p>
          <form action={checkAction} className="mt-2 flex flex-wrap items-center gap-2">
            <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" aria-label={t("6-digit code")} className={codeInput} />
            <button type="submit" disabled={checkPending} className={navy}>{checkPending ? t("Checking…") : t("Add email")}</button>
            <button type="button" onClick={() => { void cancelAddEmail(); onDone(); }} className={small}>{t("Cancel")}</button>
          </form>
          <form action={startAction} className="mt-2">
            <input type="hidden" name="email" value={target ?? ""} />
            <button type="submit" disabled={startPending} className="border-0 bg-transparent p-0 text-[13px] font-semibold text-[#2F5FD0] underline disabled:opacity-60">{t("Send a new code")}</button>
          </form>
          <Msg s={check.error || check.info ? check : null} />
        </>
      )}
      <Msg s={start.error || (start.info && !check.error) ? start : null} />
    </div>
  );
}
