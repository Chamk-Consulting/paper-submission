"use client";

import Link from "@/components/site/link";
import { useActionState, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { changePassword, signOutOthers, type AccountState } from "@/lib/account/actions";
import type { SignInEvent } from "@/lib/account/data";
import { scorePassword } from "@/lib/auth/password-rules";
import { PasswordMeter, useLeakCheck } from "@/components/auth/password-meter";
import { Eye, EyeOff } from "lucide-react";
import { sx } from "@/components/account/styles";
import { FieldErr } from "@/components/account/save-bar";
import { deviceName } from "@/lib/account/ua";
import type { SecurityPlus } from "@/lib/account/security-data";
import { EmailAddresses, SignInMethods } from "@/components/account/security-extras";

/* Canvas ST02 — Sign-in & security. */

/** A password box with a show/hide button; border turns red or green with the checks. */
function PwInput({ id, name, auto, value, onChange, bad, good, describedBy }: { id: string; name: string; auto: string; value: string; onChange: (v: string) => void; bad?: boolean; good?: boolean; describedBy?: string }) {
  const t = useT();
  const [shown, setShown] = useState(false);
  return (
    <span className="flex overflow-hidden rounded-[4px] bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2F5FD0]" style={{ border: bad ? "2px solid #B3261E" : good ? "2px solid #14603F" : "1px solid #B7BDC9" }}>
      <input id={id} name={name} type={shown ? "text" : "password"} autoComplete={auto} maxLength={128} value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={bad || undefined} aria-describedby={describedBy} className="box-border h-[42px] min-w-0 flex-auto border-0 bg-transparent px-3 text-[15px] font-normal text-[#121826] outline-none" />
      <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? t("Hide password") : t("Show password")} aria-pressed={shown}
        className="flex w-11 flex-none cursor-pointer items-center justify-center border-0 border-l border-[#DADDE3] bg-[#F5F6F3] text-[#4A5263] hover:text-[#121826]">
        {shown ? <EyeOff size={17} strokeWidth={1.75} aria-hidden /> : <Eye size={17} strokeWidth={1.75} aria-hidden />}
      </button>
    </span>
  );
}

const small = "inline-flex h-8 items-center whitespace-nowrap rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60";
const tagCls = "rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]";
const METHOD_LABELS: Record<string, string> = { password: "Password", email_code: "Email code", magic_link: "Email link", passkey: "Passkey", orcid: "ORCID", google: "Google", reset: "Password reset" };

export function SecurityPanel({ email, device, providers, events, plus }: { email: string; device: string; providers: string[]; events: SignInEvent[]; plus: SecurityPlus }) {
  const t = useT();
  const [state, action, pending] = useActionState<AccountState, FormData>(changePassword, {});
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [cur, setCur] = useState("");
  const [tried, setTried] = useState(false);
  const score = scorePassword(pw, email, cur);
  const leak = useLeakCheck(pw, score.long && score.mixed && score.notCommon && score.notEmail);
  const canSave = !!cur && score.ok && pw === pw2 && leak !== "leaked" && leak !== "checking";
  const [outState, setOut] = useState<AccountState | null>(null);
  const [outPending, startOut] = useTransition();
  const fmt = new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const orcid = providers.includes("orcid");

  return (
    <>
      <SignInMethods email={email} plus={plus} orcid={orcid} />
      <EmailAddresses email={email} plus={plus} />

      <section id="password" className={sx.card}>
        <h2 className={sx.h2}>{t("Password")}</h2>
        <p className={sx.sub + " text-[13px]"}>{t("Use something long that you don’t use anywhere else. A short phrase of three or four words works well.")}</p>
        <form action={action} onSubmit={(e) => { if (!canSave) { e.preventDefault(); setTried(true); } }} noValidate className="mt-3.5 flex max-w-[460px] flex-col gap-4">
          <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
          <div className={sx.label}>
            <label htmlFor="pw-current">{t("Current password")}</label>
            <PwInput id="pw-current" name="current" auto="current-password" value={cur} onChange={setCur} bad={!!state.fieldErrors?.current} />
            <FieldErr state={state} name="current" />
          </div>
          <div className={sx.label}>
            <label htmlFor="pw-next">{t("New password")}</label>
            <PwInput id="pw-next" name="next" auto="new-password" value={pw} onChange={setPw} bad={(tried && !score.ok) || leak === "leaked" || !!state.fieldErrors?.next} good={score.ok && leak !== "leaked" && leak !== "checking"} describedBy="pw-rules" />
            <PasswordMeter id="pw-rules" pw={pw} email={email} current={cur} flag={tried} leak={leak} />
            <FieldErr state={state} name="next" />
          </div>
          <div className={sx.label}>
            <label htmlFor="pw-confirm">{t("Type the new password again")}</label>
            <PwInput id="pw-confirm" name="confirm" auto="new-password" value={pw2} onChange={setPw2} bad={(pw2.length > 0 && pw2 !== pw) || (tried && pw2 !== pw) || !!state.fieldErrors?.confirm} good={pw2.length > 0 && pw2 === pw} describedBy="pw-match" />
            <span id="pw-match" aria-live="polite" className="min-h-[18px] text-[13px] font-normal">
              {pw2 && pw2 !== pw ? <span className="text-[#B3261E]">{t("The two passwords don't match yet.")}</span> : pw2 && pw2 === pw ? <span className="text-[#14603F]">✓ {t("Passwords match.")}</span> : null}
            </span>
            <FieldErr state={state} name="confirm" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className="inline-flex h-[42px] items-center rounded-[4px] border-0 bg-[#0E1B3D] px-[18px] text-[15px] font-semibold text-white disabled:opacity-60">{pending ? t("Saving…") : t("Change password")}</button>
            <Link href="/forgot-password" className="text-[14px] text-[#2F5FD0]">{t("Forgot your current password?")}</Link>
          </div>
          <span role="status" className={`text-[13px] ${state.error ? "text-[#B3261E]" : "text-[#14603F]"}`}>{state.error ? t(state.error) : state.savedAt ? t("Password changed. Other devices stay signed in until you sign them out below.") : ""}</span>
        </form>
      </section>

      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Where you're signed in")}</h2>
        <div className="mt-3.5">
          <div className="flex items-center justify-between gap-3 border-t border-[#EEF0EC] py-2.5">
            <span>
              <strong className="text-[14px]">{t(device)}</strong>{" "}
              <span className={`${tagCls} bg-[#E6EDFC] text-[#1F47A8]`}>{t("THIS DEVICE")}</span>
              <span className="block text-[13px] text-[#4A5263]">{t("active now")}</span>
            </span>
          </div>
          <p className="m-0 border-t border-[#EEF0EC] py-2.5 text-[13px] text-[#4A5263]">{t("Other phones, tablets and computers where you signed in stay signed in until you sign them out.")}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <button type="button" disabled={outPending} onClick={() => startOut(async () => setOut(await signOutOthers()))} className={`${small} text-[#B3261E]!`}>{t("Sign out of all other devices")}</button>
            <span role="status" className={`text-[13px] ${outState?.error ? "text-[#B3261E]" : "text-[#14603F]"}`}>{outState?.error ? t(outState.error) : outState?.ok ? t("Signed out everywhere else.") : ""}</span>
          </div>
        </div>
      </section>

      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Recent sign-in activity")}</h2>
        <div className="mt-3.5 overflow-x-auto">
          {events.length === 0 ? <p className="m-0 text-[14px] text-[#4A5263]">{t("No sign-ins recorded yet. New sign-ins will show here.")}</p> : (
            <table className="w-full border-collapse text-[13px]">
              <thead><tr className="text-left text-[#4A5263]">
                {["When", "How", "Where", "Result"].map((h) => <th key={h} scope="col" className="border-b border-[#DADDE3] p-1.5 font-semibold">{t(h)}</th>)}
              </tr></thead>
              <tbody>
                {events.map((e) => {
                  const ok = e.result === "ok";
                  return (
                    <tr key={e.id}>
                      <td className="border-b border-[#EEF0EC] p-1.5">{fmt.format(new Date(e.at))}</td>
                      <td className="border-b border-[#EEF0EC] p-1.5">{t(METHOD_LABELS[e.method] ?? e.method)}</td>
                      <td className="border-b border-[#EEF0EC] p-1.5">{[e.place ?? t("Unknown"), e.user_agent ? deviceName(e.user_agent) : null].filter(Boolean).join(" · ")}</td>
                      <td className={`border-b border-[#EEF0EC] p-1.5 ${ok ? "text-[#14603F]" : "text-[#B3261E]"}`}>{ok ? t("Signed in") : e.result}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
