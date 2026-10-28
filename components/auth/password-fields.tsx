"use client";
import { Eye, EyeOff } from "lucide-react";

import { useEffect, useState } from "react";
import { scorePassword } from "@/lib/auth/password-rules";
import { PasswordMeter, useLeakCheck } from "@/components/auth/password-meter";
import { ui } from "@/components/auth/split-layout";
import { useT } from "@/lib/i18n/client";
import { FieldLabel } from "@/components/auth/field-label";


function EyeToggle({ shown, onToggle, label }: { shown: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" onClick={onToggle} aria-label={label} aria-pressed={shown} title={label}
      className="flex w-[48px] flex-none items-center justify-center border-0 border-l border-[#B7BDC9] bg-[#F2F3F0] text-[#4A5263] hover:text-[#121826]">
      {shown ? <EyeOff size={18} strokeWidth={1.75} aria-hidden /> : <Eye size={18} strokeWidth={1.75} aria-hidden />}
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
  const leak = useLeakCheck(pw, r.long && r.mixed && r.notCommon && r.notEmail);
  const pwBad = (flag && !r.ok) || leak === "leaked" || !!serverErrors?.password;
  const confirmBad = mismatch || !!serverErrors?.confirm || (tried && pw2 !== pw);
  const valid = r.ok && pw === pw2 && leak !== "leaked" && leak !== "checking";
  useEffect(() => { onValid?.(valid); }, [valid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="mt-3.5 flex flex-col gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-new`} required info={<>{t("At least 8 characters with letters and a number — or a phrase of 12+ characters, which is easy to remember.")} {t("Don’t reuse a password from another site — we check it against known leaks.")}</>}>{t("Password")}</FieldLabel>
        <div className="flex overflow-hidden rounded-[4px] bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2F5FD0]" style={{ border: pwBad ? "2px solid #B3261E" : r.ok && leak !== "checking" ? "2px solid #14603F" : "1px solid #B7BDC9" }}>
          <input
            id={`${idPrefix}-new`} name="password" aria-required="true" type={show ? "text" : "password"} autoComplete="new-password" maxLength={128}
            value={pw} onChange={(e) => setPw(e.target.value)}
            aria-describedby={`${idPrefix}-rules${serverErrors?.password ? ` ${idPrefix}-err` : ""}`} aria-invalid={pwBad || undefined}
            className="box-border h-[46px] min-w-0 flex-auto border-0 bg-transparent px-3.5 text-[16px] text-[#121826] outline-none"
          />
          <EyeToggle shown={show} onToggle={() => setShow((v) => !v)} label={show ? t("Hide password") : t("Show password")} />
        </div>
        <PasswordMeter id={`${idPrefix}-rules`} pw={pw} email={email} flag={flag} leak={leak} />
        {serverErrors?.password ? <span id={`${idPrefix}-err`} role="alert" className={ui.error}>{t(serverErrors.password[0])}</span> : null}
      </div>

      <div className="mt-3.5 flex flex-col gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-confirm`} required info={t("Type the same password again, so a typo doesn’t lock you out.")}>{t("Confirm password")}</FieldLabel>
        <div className="flex overflow-hidden rounded-[4px] bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2F5FD0]" style={{ border: confirmBad ? "2px solid #B3261E" : matchOk ? "2px solid #18744F" : "1px solid #B7BDC9" }}>
          <input
            id={`${idPrefix}-confirm`} name="confirm" type={show2 ? "text" : "password"} autoComplete="new-password" maxLength={128} aria-required="true"
            value={pw2} onChange={(e) => setPw2(e.target.value)} aria-invalid={confirmBad || undefined}
            aria-describedby={`${idPrefix}-match`}
            className="box-border h-[46px] min-w-0 flex-auto border-0 bg-transparent px-3.5 text-[16px] text-[#121826] outline-none"
          />
          <EyeToggle shown={show2} onToggle={() => setShow2((v) => !v)} label={show2 ? t("Hide password") : t("Show password")} />
        </div>
        <span id={`${idPrefix}-match`} aria-live="polite" className="min-h-[18px] text-[13px]">
          {confirmBad ? <span className="text-[#B3261E]">{t(serverErrors?.confirm?.[0] ?? "The two passwords don't match yet.")}</span> : matchOk ? <span className="text-[#14603F]">✓ {t("Passwords match.")}</span> : null}
        </span>
      </div>
    </>
  );
}
