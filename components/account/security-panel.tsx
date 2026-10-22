"use client";

import Link from "@/components/site/link";
import { useActionState, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { changePassword, signOutOthers, type AccountState } from "@/lib/account/actions";
import type { SignInEvent } from "@/lib/account/data";
import { scorePassword, MIN_PASSWORD } from "@/lib/auth/password-rules";
import { sx } from "@/components/account/styles";
import { FieldErr } from "@/components/account/save-bar";
import { deviceName } from "@/lib/account/ua";
import type { SecurityPlus } from "@/lib/account/security-data";
import { EmailAddresses, SignInMethods } from "@/components/account/security-extras";

/* Canvas ST02 — Sign-in & security. */

const small = "inline-flex h-8 items-center whitespace-nowrap rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60";
const tagCls = "rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]";
const METHOD_LABELS: Record<string, string> = { password: "Password", email_code: "Email code", magic_link: "Email link", passkey: "Passkey", orcid: "ORCID", google: "Google", reset: "Password reset" };

export function SecurityPanel({ email, device, providers, events, plus }: { email: string; device: string; providers: string[]; events: SignInEvent[]; plus: SecurityPlus }) {
  const t = useT();
  const [state, action, pending] = useActionState<AccountState, FormData>(changePassword, {});
  const [pw, setPw] = useState("");
  const score = scorePassword(pw, email);
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
        <form action={action} className="mt-3.5">
          <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
          <div className="grid items-start gap-3.5 sm:grid-cols-2">
            <label className={sx.label}>{t("Current password")}<input name="current" type="password" autoComplete="current-password" required className={sx.input} /><FieldErr state={state} name="current" /></label>
            <label className={sx.label}>{t("New password")}
              <input name="next" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={128} value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby="pw-help" className={sx.input} />
              {pw ? (
                <span className="flex items-center gap-2" aria-live="polite">
                  <span className="flex flex-auto gap-1" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${score.sc >= i ? (score.sc >= 3 ? "bg-[#18744F]" : "bg-[#F2A93B]") : "bg-[#EEF0EC]"}`} />)}</span>
                  <span className="text-[12px] font-normal text-[#4A5263]">{!score.long ? t("Too short") : !score.notCommon ? t("Too common") : !score.notEmail ? t("Don’t use your email") : score.sc >= 4 ? t("Strong") : t("Good")}</span>
                </span>
              ) : null}
              <FieldErr state={state} name="next" />
            </label>
          </div>
          <p id="pw-help" className="mb-0 mt-2 text-[13px] text-[#4A5263]">
            {t("At least {n} characters.", { n: MIN_PASSWORD })} <Link href="/forgot-password" className="text-[#2F5FD0]">{t("Forgot it?")}</Link>
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending || !score.ok} className="inline-flex h-[42px] items-center rounded-[4px] border-0 bg-[#0E1B3D] px-[18px] text-[15px] font-semibold text-white disabled:opacity-60">{pending ? t("Saving…") : t("Change password")}</button>
            <span role="status" className={`text-[13px] ${state.error ? "text-[#B3261E]" : "text-[#14603F]"}`}>{state.error ? t(state.error) : state.savedAt ? t("Password changed. Other devices stay signed in until you sign them out below.") : ""}</span>
          </div>
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
