"use client";

import Link from "@/components/site/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { resendSignupCode, signupStatus, verifySignupCode } from "@/lib/auth/onboarding-actions";
import { resendResetCode, verifyResetCode } from "@/lib/auth/reset-actions";
import { ui } from "@/components/auth/split-layout";
import { useT } from "@/lib/i18n/client";
import { EMAIL_CODE_LENGTH, EMAIL_CODE_MAX, EMAIL_CODE_MIN } from "@/lib/auth/code-length";

type Mode = "wait" | "sent" | "wrong" | "ok" | "expired" | "locked";
const EXPIRES = 15 * 60; // matches Supabase Auth "Email OTP expiration" = 900 s (plan D1)
const WAITS = [60, 60, 120, 120, 120, 120]; // Supabase allows a new email to the same address after 60 s
const MAX_RESENDS = 5;
const MAX_TRIES = 5;

const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
const stamp = (intl: string) => new Date().toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" });

type Props = {
  email: string;
  onSuccessHref: string;
  changeHref: string;
  /** signup = PR07 (confirm email), recovery = PR10b (password reset code). */
  kind?: "signup" | "recovery";
  /** Domain the emails come from (lib/config/site senderDomain()). */
  senderDomain?: string;
  /** Sign-up: where the person was heading (carried through every step). */
  next?: string;
};

const COPY = {
  signup: {
    submit: "Confirm email",
    linkNote: "Or click the link in the email — it confirms you and continues here." as string | null,
    change: "Wrong email? Change it",
    tips: ["Check spam, “Other” or “Promotions” folders.", "Universities sometimes hold automated mail for a few minutes.", "ask-it"],
  },
  recovery: {
    submit: "Continue",
    linkNote: null as string | null,
    change: "Wrong account? Change it",
    tips: ["Check spam, “Other” or “Promotions” folders.", "Try the other emails you publish with.", "recover"],
  },
};

/** Canvas PR07 / PR10b: code boxes (as many as the emailed code has) with paste, resend timer, wrong/expired/locked states. */
export function OtpVerify({ email, onSuccessHref, changeHref, kind = "signup", senderDomain = "[sender domain]", next }: Props) {
  const copy = COPY[kind];
  const verify = (e: string, c: string) => (kind === "recovery" ? verifyResetCode(e, c) : verifySignupCode(e, c, next));
  const resendCode = kind === "recovery" ? resendResetCode : resendSignupCode;
  // box count follows the emailed code; a pasted/autofilled code of another length (6–10) re-sizes the boxes
  const [len, setLen] = useState(EMAIL_CODE_LENGTH);
  const blank = (n = len) => Array<string>(n).fill("");
  const [digits, setDigits] = useState<string[]>(() => Array<string>(EMAIL_CODE_LENGTH).fill(""));
  const [mode, setMode] = useState<Mode>("wait");
  const [tries, setTries] = useState(MAX_TRIES);
  const [resends, setResends] = useState(0);
  const [left, setLeft] = useState(WAITS[0]);
  const [exp, setExp] = useState(EXPIRES);
  const [lock, setLock] = useState(0);
  const [sentAt, setSentAt] = useState("");
  const [note, setNote] = useState("");
  const [back, setBack] = useState(false);
  const [elsewhere, setElsewhere] = useState(false);
  const [pending, startTransition] = useTransition();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const t = useT();

  // one clock for resend wait, code expiry and lock-out
  useEffect(() => {
    const id = setInterval(() => {
      setLeft((v) => (v > 0 ? v - 1 : 0));
      setLock((v) => (v > 0 ? v - 1 : 0));
      setExp((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // C2: confirmed with the link on another device? Check every 5 s and when this tab comes back into view.
  useEffect(() => {
    if (kind !== "signup" || elsewhere || mode === "ok") return;
    let stop = false;
    const check = async () => {
      if (stop || document.visibilityState === "hidden") return;
      const r = await signupStatus(email).catch(() => ({ confirmed: false }));
      if (!stop && r.confirmed) setElsewhere(true);
    };
    const id = setInterval(check, 5000);
    const onFocus = () => { void check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { stop = true; clearInterval(id); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [kind, email, elsewhere, mode]);

  const locked = mode === "locked" && lock > 0;
  const expired = !locked && mode !== "ok" && exp === 0;
  const limit = resends >= MAX_RESENDS;
  const focus = (i: number) => setTimeout(() => { const el = refs.current[i]; el?.focus(); el?.select(); }, 0);

  function submit(d: string[]) {
    const code = d.join("");
    if (code.length < EMAIL_CODE_MIN || pending) return;
    startTransition(async () => {
      const r = await verify(email, code);
      if (r.ok) {
        setMode("ok");
        const dest: string = ("href" in r && typeof r.href === "string" && r.href) || onSuccessHref;
        // An existing account that used "Create account": it is simply signed in (plan B3).
        // A full page load: the person is signed in from here on, and every part of the page (header, menus)
        // must start from the new session rather than from what was cached while signed out.
        const go = () => window.location.assign(dest);
        if ("returning" in r && r.returning) { setBack(true); setTimeout(go, 1400); return; }
        go();
        return;
      }
      if (r.reason === "locked" || tries - 1 <= 0) {
        setMode("locked"); setLock(15 * 60); setTries(0); setDigits(blank());
        return;
      }
      setTries((n) => n - 1); setMode("wrong"); focus(0);
    });
  }

  // Auto-checks only a complete code: all boxes filled and at least the length the emails use, so a code is never
  // sent half-typed. Shorter codes (6–7 digits) are checked with the button.
  function update(d: string[], nextFocus?: number, whole = false) {
    setDigits(d);
    if (mode === "wrong" || mode === "ok") setMode("wait");
    if (nextFocus !== undefined) focus(nextFocus);
    if (d.every(Boolean) && (whole || d.length >= EMAIL_CODE_LENGTH)) submit(d);
  }

  function resend(force = false) {
    if (limit || locked || (!force && left > 0)) return;
    startTransition(async () => {
      const r = await resendCode(email);
      if (!r.ok) { setNote(r.message ?? ""); return; }
      const n = resends + 1;
      setResends(n); setLeft(WAITS[Math.min(n, WAITS.length - 1)]); setExp(EXPIRES); setTries(MAX_TRIES);
      setDigits(blank()); setSentAt(stamp(t.intl)); setMode("sent"); setNote(""); focus(0);
    });
  }

  let msg = t("You can paste the whole code. It expires in {time}.", { time: mmss(exp) });
  let msgInk = "#4A5263";
  if (mode === "sent") { msg = t("New code sent to {email} at {sentAt}. Older codes no longer work · expires in {time}.", { email, sentAt, time: mmss(exp) }); msgInk = "#14603F"; }
  if (mode === "wrong") { msg = tries === 1 ? t("That code doesn’t match. 1 try left — use the code from the latest email.") : t("That code doesn’t match. {n} tries left — use the code from the latest email.", { n: tries }); msgInk = "#B3261E"; }
  if (mode === "ok") { msg = back ? `✓ ${t("Welcome back — you already had a Plenary account, so you're now signed in.")}` : `✓ ${t("Code accepted.")}`; msgInk = "#14603F"; }
  const firstEmpty = digits.indexOf("");

  return (
    <>
      {elsewhere && mode !== "ok" ? (
        <div role="status" className="mt-4 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3.5 py-3 text-[14px] text-[#14603F]">
          <p className="m-0 font-semibold">{t("Your email was confirmed on another device.")}</p>
          <p className="m-0 mt-1 text-[#1F4E37]">{t("To continue on this device, we’ll email you a sign-in code. Enter it below.")}</p>
          <button type="button" onClick={() => resend(true)} disabled={pending || mode === "sent"} className={`mt-2.5 h-10 ${ui.primary}`}>{mode === "sent" ? t("Code sent") : t("Email me a sign-in code")}</button>
        </div>
      ) : null}
      {!locked && !expired ? (
        <fieldset className="m-0 mt-4 border-0 p-0">
          <legend className="mb-2 text-[14px] font-medium">{t("Code from the email")}</legend>
          <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${len}, minmax(0, 1fr))` }}>
            {digits.map((v, i) => {
              const border = mode === "wrong" ? "2px solid #B3261E" : mode === "ok" ? "2px solid #18744F" : i === firstEmpty ? "2px solid #2F5FD0" : v ? "1px solid #121826" : "1px solid #B7BDC9";
              const bg = mode === "wrong" ? "#FFF7F6" : mode === "ok" ? "#F3FAF6" : "#FFFFFF";
              return (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  type="text" inputMode="numeric" pattern="[0-9]*" maxLength={i === 0 ? 10 : 2}
                  autoComplete={i === 0 ? "one-time-code" : "off"} aria-label={t("Digit {n} of {total}", { n: i + 1, total: len })} aria-invalid={mode === "wrong" || undefined}
                  value={v} disabled={pending}
                  onChange={(e) => {
                    let raw = e.target.value.replace(/[^0-9]/g, "");
                    const whole = raw.length >= EMAIL_CODE_MIN && raw.length <= 10 && raw.length !== len && i === 0;
                    if (whole) { setLen(raw.length); update(raw.split(""), raw.length - 1, true); return; }
                    const base = mode === "wrong" ? blank() : digits.slice();
                    // Typing past the last box: the code is longer than expected, so add a box instead of overwriting.
                    if (i === len - 1 && digits[i] && raw.length === 2 && raw[0] === digits[i] && len < EMAIL_CODE_MAX && mode !== "wrong") {
                      setLen(len + 1);
                      update([...base, raw[1]], len);
                      return;
                    }
                    if (raw.length === 2 && raw[0] === digits[i]) raw = raw[1];
                    if (raw.length > 1) {
                      let j = i;
                      for (const ch of raw) if (j < len) base[j++] = ch;
                      update(base, Math.min(j, len - 1));
                      return;
                    }
                    base[i] = raw;
                    update(base, raw && i < len - 1 ? i + 1 : undefined);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !digits[i] && i > 0) { const d = digits.slice(); d[i - 1] = ""; setDigits(d); focus(i - 1); }
                    if (e.key === "ArrowLeft" && i > 0) focus(i - 1);
                    if (e.key === "ArrowRight" && i < len - 1) focus(i + 1);
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 10);
                    if (!pasted) return;
                    e.preventDefault();
                    const n = pasted.length >= EMAIL_CODE_MIN ? pasted.length : len;
                    if (n !== len) setLen(n);
                    const d = blank(n);
                    pasted.split("").forEach((ch, k) => { if (k < n) d[k] = ch; });
                    update(d, Math.min(pasted.length, n - 1), pasted.length >= EMAIL_CODE_MIN);
                  }}
                  className={`box-border h-14 w-full rounded-[6px] text-center font-mono ${len > 6 ? "text-[20px]" : "text-[24px]"} font-medium text-[#121826] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]`}
                  style={{ border, background: bg }}
                />
              );
            })}
          </div>
          <p role={mode === "wrong" ? "alert" : "status"} aria-live="polite" className="mt-2 text-[13px]" style={{ color: msgInk }}>{msg}</p>
          {resends >= 3 && !limit ? (
            <p className="mt-1.5 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-2.5 py-2 text-[13px] text-[#3B2A07]">
              {t("Still nothing after {n} tries? Check spam, or ask IT to allow mail from", { n: resends })} <span className="font-mono">{senderDomain}</span>. {t("Resend now waits a little longer each time.")}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {expired ? (
        <div role="alert" className="mt-4 rounded-[6px] border border-l-4 border-[#DADDE3] border-l-[#A8600F] bg-white p-4">
          <div className="font-semibold">{t("This code expired")}</div>
          <p className={`mt-1 text-[14px] ${ui.muted}`}>{t("Codes and links last 15 minutes. We'll send a fresh one to {email}.", { email })}</p>
          <button type="button" onClick={() => resend(true)} disabled={pending} className={`mt-3 h-11 ${ui.primary}`}>{t("Send a new code")}</button>
        </div>
      ) : null}

      {locked ? (
        <div role="alert" className="mt-4 rounded-[6px] border border-l-4 border-[#F3C3BE] border-l-[#B3261E] bg-[#FDECEA] p-4 text-[#5C1A15]">
          <div className="font-semibold">{t("Too many tries")}</div>
          <p className="mt-1 text-[14px]">{t("To keep your account safe, codes are paused. Try again in")} <span className="font-mono font-semibold">{mmss(lock)}</span>.</p>
          <div className="mt-2.5 flex flex-wrap gap-4 text-[14px]"><Link href="/account-help" className={ui.link}>{t("Contact support")}</Link></div>
        </div>
      ) : null}

      {note ? <p role="status" className="mt-3 text-[13px] text-[#7A4508]">{t(note)}</p> : null}

      {!locked && !expired ? (
        <button type="button" onClick={() => submit(digits)} disabled={pending || digits.join("").length < EMAIL_CODE_MIN} className={`mt-5 h-12 ${ui.primary}`}>
          {pending ? t("Checking…") : t(copy.submit)}
        </button>
      ) : null}
      {copy.linkNote ? <p className={`mt-3.5 text-[14px] ${ui.muted}`}>{t(copy.linkNote)}</p> : null}

      <div className="mt-[18px] flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
        {left === 0 && !limit && !locked && !expired ? (
          <button type="button" onClick={() => resend()} disabled={pending} className="min-h-6 border-0 bg-transparent p-0 text-[14px] font-semibold text-[#2F5FD0] underline">{t("Resend code")}</button>
        ) : null}
        {left > 0 && !limit && !locked && !expired ? (
          <span className={`font-mono text-[13px] ${ui.muted}`} aria-label={t("You can ask for a new code in {n} seconds", { n: left })}>{t("Resend in {time}", { time: mmss(left) })}</span>
        ) : null}
        {limit && !locked ? <span className={`text-[13px] ${ui.muted}`}>{t("Resend limit reached")} · <Link href="/account-help" className={ui.link}>{t("Recover your account")}</Link></span> : null}
        <span aria-hidden className="text-[#B7BDC9]">·</span>
        <Link href={changeHref} className={ui.link}>{t(copy.change)}</Link>
      </div>

      <details className="mt-6 rounded-[6px] border border-[#DADDE3] bg-white px-3.5 py-3 text-[14px]">
        <summary className="cursor-pointer font-semibold">{t("Email not arriving?")}</summary>
        <ul className={`mt-2.5 flex flex-col gap-1.5 pl-[18px] ${ui.muted}`}>
          {copy.tips.map((tip) =>
            tip === "ask-it" ? (
              <li key={tip}>{t("Ask IT to allow mail from")} <span className="font-mono">{senderDomain}</span>.</li>
            ) : tip === "recover" ? (
              <li key={tip}>{t("Still stuck?")} <Link href="/account-help" className={ui.link}>{t("Recover your account")}</Link> {t("with ORCID or help from support.")}</li>
            ) : (
              <li key={tip}>{t(tip)}</li>
            ),
          )}
        </ul>
      </details>
    </>
  );
}
