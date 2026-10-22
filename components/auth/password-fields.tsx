"use client";

import { useState } from "react";
import { scorePassword } from "@/lib/auth/password-rules";
import { ui } from "@/components/auth/split-layout";
import { useT } from "@/lib/i18n/client";
import { FieldLabel } from "@/components/auth/field-label";

const COLORS = ["#DADDE3", "#B3261E", "#A8600F", "#2F5FD0", "#18744F"];
const LABELS = ["—", "Too weak", "Could be stronger", "Good", "Strong"];

function Eye({ shown, onToggle, label }: { shown: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" onClick={onToggle} aria-label={label} aria-pressed={shown} title={label}
      className="flex w-[48px] flex-none items-center justify-center border-0 border-l border-[#B7BDC9] bg-[#F2F3F0] text-[#4A5263] hover:text-[#121826]">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6S1.5 10 1.5 10z" /><circle cx="10" cy="10" r="2.6" />
        {shown ? null : <path d="M3 17L17 3" />}
      </svg>
    </button>
  );
}

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
  const [show2, setShow2] = useState(false);

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
        <FieldLabel htmlFor={`${idPrefix}-new`} required info={<>{t("At least 12 characters. A short phrase of three or four words is easy to remember and hard to guess.")} {t("Don’t reuse a password from another site — we check it against known leaks.")}</>}>{t("Password")}</FieldLabel>
        <div className="flex overflow-hidden rounded-[4px] bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2F5FD0]" style={{ border: pwBad ? "2px solid #B3261E" : r.ok ? "2px solid #18744F" : "1px solid #B7BDC9" }}>
          <input
            id={`${idPrefix}-new`} name="password" aria-required="true" type={show ? "text" : "password"} autoComplete="new-password" maxLength={128}
            value={pw} onChange={(e) => { setPw(e.target.value); update(e.target.value, pw2); }}
            aria-describedby={`${idPrefix}-rules${serverErrors?.password ? ` ${idPrefix}-err` : ""}`} aria-invalid={pwBad || undefined}
            className="box-border h-[46px] min-w-0 flex-auto border-0 bg-transparent px-3.5 text-[16px] text-[#121826] outline-none"
          />
          <Eye shown={show} onToggle={() => setShow((v) => !v)} label={show ? t("Hide password") : t("Show password")} />
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
        <FieldLabel htmlFor={`${idPrefix}-confirm`} required info={t("Type the same password again, so a typo doesn’t lock you out.")}>{t("Confirm password")}</FieldLabel>
        <div className="flex overflow-hidden rounded-[4px] bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2F5FD0]" style={{ border: confirmBad ? "2px solid #B3261E" : matchOk ? "2px solid #18744F" : "1px solid #B7BDC9" }}>
          <input
            id={`${idPrefix}-confirm`} name="confirm" type={show2 ? "text" : "password"} autoComplete="new-password" maxLength={128} aria-required="true"
            value={pw2} onChange={(e) => { setPw2(e.target.value); update(pw, e.target.value); }} aria-invalid={confirmBad || undefined}
            aria-describedby={`${idPrefix}-match`}
            className="box-border h-[46px] min-w-0 flex-auto border-0 bg-transparent px-3.5 text-[16px] text-[#121826] outline-none"
          />
          <Eye shown={show2} onToggle={() => setShow2((v) => !v)} label={show2 ? t("Hide password") : t("Show password")} />
        </div>
        <span id={`${idPrefix}-match`} aria-live="polite" className="min-h-[18px] text-[13px]">
          {confirmBad ? <span className="text-[#B3261E]">{t(serverErrors?.confirm?.[0] ?? "The two passwords don't match yet.")}</span> : matchOk ? <span className="text-[#14603F]">✓ {t("Passwords match.")}</span> : null}
        </span>
      </div>
    </>
  );
}
