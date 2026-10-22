"use client";

import { useState } from "react";
import { scorePassword } from "@/lib/auth/password-rules";
import { ui } from "@/components/auth/split-layout";
import { useT } from "@/lib/i18n/client";

const COLORS = ["#DADDE3", "#B3261E", "#A8600F", "#2F5FD0", "#18744F"];
const LABELS = ["—", "Too weak", "Could be stronger", "Good", "Strong"];

/**
 * New password + confirm, with a strength bar, a live rule checklist and a show/hide toggle.
 * Same rules as the server (lib/auth/password-rules.ts). `onValid` reports whether both fields are acceptable.
 */
export function PasswordFields({ email, tried, serverErrors, idPrefix = "pw", onValid }: {
  email: string; tried: boolean; serverErrors?: { password?: string[]; confirm?: string[] }; idPrefix?: string; onValid?: (ok: boolean) => void;
}) {
  const t = useT();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);

  const r = scorePassword(pw, email);
  const mismatch = pw2.length > 0 && pw2 !== pw;
  const matchOk = pw2.length > 0 && pw2 === pw;
  const flag = tried || !!serverErrors?.password;
  const rule = (pass: boolean, label: string) => ({ label: t(label), mark: pass ? "✓" : flag ? "!" : "·", ink: pass ? "#14603F" : flag ? "#B3261E" : "#4A5263" });
  const rules = [rule(r.long, "At least 12 characters"), rule(r.notCommon, "Not a common password"), rule(r.notEmail, "Doesn’t contain your email name")];
  const pwBad = (flag && !r.ok) || !!serverErrors?.password;
  const confirmBad = mismatch || !!serverErrors?.confirm || (tried && pw2 !== pw);
  const update = (a: string, b: string) => onValid?.(scorePassword(a, email).ok && a === b);

  return (
    <>
      <div className="mt-3.5 flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-new`} className={ui.label}>{t("Password")}</label>
        <div className="flex overflow-hidden rounded-[4px] bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2F5FD0]" style={{ border: pwBad ? "2px solid #B3261E" : r.ok ? "2px solid #18744F" : "1px solid #B7BDC9" }}>
          <input
            id={`${idPrefix}-new`} name="password" type={show ? "text" : "password"} autoComplete="new-password" maxLength={128}
            value={pw} onChange={(e) => { setPw(e.target.value); update(e.target.value, pw2); }}
            aria-describedby={`${idPrefix}-rules${serverErrors?.password ? ` ${idPrefix}-err` : ""}`} aria-invalid={pwBad || undefined}
            className="box-border h-[46px] min-w-0 flex-auto border-0 bg-transparent px-3.5 text-[16px] text-[#121826] outline-none"
          />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? t("Hide password") : t("Show password")} aria-pressed={show}
            className="w-[68px] border-0 border-l border-[#B7BDC9] bg-[#F2F3F0] text-[13px] font-medium text-[#4A5263]">
            {show ? t("Hide") : t("Show")}
          </button>
        </div>
        <div aria-hidden className="mt-1 grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((i) => <span key={i} className="h-1 rounded-sm" style={{ background: r.sc >= i ? COLORS[r.sc] : "#DADDE3" }} />)}
        </div>
        <div className="flex justify-between text-[13px]" aria-live="polite">
          <span className={ui.muted}>{t("Strength")}</span>
          <span className="font-semibold" style={{ color: r.sc ? COLORS[r.sc] : "#4A5263" }}>{t(LABELS[r.sc])}</span>
        </div>
        <ul id={`${idPrefix}-rules`} className="m-0 mt-1 flex list-none flex-col gap-1 p-0 text-[13px]">
          {rules.map((x) => (
            <li key={x.label} className="flex items-center gap-2" style={{ color: x.ink }}>
              <span aria-hidden className="w-4 text-center font-semibold">{x.mark}</span>{x.label}
            </li>
          ))}
        </ul>
        {serverErrors?.password ? <span id={`${idPrefix}-err`} role="alert" className={ui.error}>{t(serverErrors.password[0])}</span> : null}
      </div>

      <div className="mt-3.5 flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-confirm`} className={ui.label}>{t("Confirm password")}</label>
        <input
          id={`${idPrefix}-confirm`} name="confirm" type={show ? "text" : "password"} autoComplete="new-password" maxLength={128}
          value={pw2} onChange={(e) => { setPw2(e.target.value); update(pw, e.target.value); }} aria-invalid={confirmBad || undefined}
          aria-describedby={`${idPrefix}-match`}
          className={`${ui.input} h-[46px]`} style={{ border: confirmBad ? "2px solid #B3261E" : matchOk ? "2px solid #18744F" : "1px solid #B7BDC9" }}
        />
        <span id={`${idPrefix}-match`} aria-live="polite" className="min-h-[18px] text-[13px]">
          {confirmBad ? <span className="text-[#B3261E]">{t(serverErrors?.confirm?.[0] ?? "The two passwords don't match yet.")}</span> : matchOk ? <span className="text-[#14603F]">✓ {t("Passwords match.")}</span> : null}
        </span>
      </div>
    </>
  );
}
