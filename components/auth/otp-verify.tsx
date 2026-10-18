"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { resendSignupCode, verifySignupCode } from "@/lib/auth/onboarding-actions";
import { ui } from "@/components/auth/split-layout";

type Mode = "wait" | "sent" | "wrong" | "ok" | "expired" | "locked";
const EXPIRES = 15 * 60; // TODO(auth): set Supabase Auth "Email OTP expiration" to 900s so this matches.
const WAITS = [30, 60, 120, 120, 120, 120];
const MAX_RESENDS = 5;
const MAX_TRIES = 5;

const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
const stamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Canvas PR07: six code boxes with paste, resend timer, wrong/expired/locked states. */
export function OtpVerify({ email, onSuccessHref, changeHref }: { email: string; onSuccessHref: string; changeHref: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [mode, setMode] = useState<Mode>("wait");
  const [tries, setTries] = useState(MAX_TRIES);
  const [resends, setResends] = useState(0);
  const [left, setLeft] = useState(WAITS[0]);
  const [exp, setExp] = useState(EXPIRES);
  const [lock, setLock] = useState(0);
  const [sentAt, setSentAt] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // one clock for resend wait, code expiry and lock-out
  useEffect(() => {
    const id = setInterval(() => {
      setLeft((v) => (v > 0 ? v - 1 : 0));
      setLock((v) => (v > 0 ? v - 1 : 0));
      setExp((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const locked = mode === "locked" && lock > 0;
  const expired = !locked && mode !== "ok" && exp === 0;
  const limit = resends >= MAX_RESENDS;
  const focus = (i: number) => setTimeout(() => { const el = refs.current[i]; el?.focus(); el?.select(); }, 0);

  function submit(d: string[]) {
    const code = d.join("");
    if (code.length < 6 || pending) return;
    startTransition(async () => {
      const r = await verifySignupCode(email, code);
      if (r.ok) {
        setMode("ok");
        router.replace(onSuccessHref);
        return;
      }
      if (r.reason === "locked" || tries - 1 <= 0) {
        setMode("locked"); setLock(15 * 60); setTries(0); setDigits(["", "", "", "", "", ""]);
        return;
      }
      setTries((t) => t - 1); setMode("wrong"); focus(0);
    });
  }

  function update(d: string[], nextFocus?: number) {
    setDigits(d);
    if (mode === "wrong" || mode === "ok") setMode("wait");
    if (nextFocus !== undefined) focus(nextFocus);
    if (d.every(Boolean)) submit(d);
  }

  function resend(force = false) {
    if (limit || locked || (!force && left > 0)) return;
    startTransition(async () => {
      const r = await resendSignupCode(email);
      if (!r.ok) { setNote(r.message ?? ""); return; }
      const n = resends + 1;
      setResends(n); setLeft(WAITS[Math.min(n, WAITS.length - 1)]); setExp(EXPIRES); setTries(MAX_TRIES);
      setDigits(["", "", "", "", "", ""]); setSentAt(stamp()); setMode("sent"); setNote(""); focus(0);
    });
  }

  let msg = `You can paste the whole code. It expires in ${mmss(exp)}.`;
  let msgInk = "#4A5263";
  if (mode === "sent") { msg = `New code sent to ${email} at ${sentAt}. Older codes no longer work · expires in ${mmss(exp)}.`; msgInk = "#14603F"; }
  if (mode === "wrong") { msg = `That code doesn’t match. ${tries} ${tries === 1 ? "try" : "tries"} left — use the code from the latest email.`; msgInk = "#B3261E"; }
  if (mode === "ok") { msg = "✓ Code accepted."; msgInk = "#14603F"; }
  const firstEmpty = digits.indexOf("");

  return (
    <>
      {!locked && !expired ? (
        <fieldset className="m-0 mt-4 border-0 p-0">
          <legend className="mb-2 text-[14px] font-medium">6-digit code</legend>
          <div className="grid grid-cols-6 gap-2">
            {digits.map((v, i) => {
              const border = mode === "wrong" ? "2px solid #B3261E" : mode === "ok" ? "2px solid #18744F" : i === firstEmpty ? "2px solid #2F5FD0" : v ? "1px solid #121826" : "1px solid #B7BDC9";
              const bg = mode === "wrong" ? "#FFF7F6" : mode === "ok" ? "#F3FAF6" : "#FFFFFF";
              return (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  type="text" inputMode="numeric" pattern="[0-9]*" maxLength={i === 0 ? 6 : 2}
                  autoComplete={i === 0 ? "one-time-code" : "off"} aria-label={`Digit ${i + 1} of 6`} aria-invalid={mode === "wrong" || undefined}
                  value={v} disabled={pending}
                  onChange={(e) => {
                    let raw = e.target.value.replace(/[^0-9]/g, "");
                    const base = mode === "wrong" ? ["", "", "", "", "", ""] : digits.slice();
                    if (raw.length === 2 && raw[0] === digits[i]) raw = raw[1];
                    if (raw.length > 1) {
                      let j = i;
                      for (const ch of raw) if (j < 6) base[j++] = ch;
                      update(base, Math.min(j, 5));
                      return;
                    }
                    base[i] = raw;
                    update(base, raw && i < 5 ? i + 1 : undefined);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !digits[i] && i > 0) { const d = digits.slice(); d[i - 1] = ""; setDigits(d); focus(i - 1); }
                    if (e.key === "ArrowLeft" && i > 0) focus(i - 1);
                    if (e.key === "ArrowRight" && i < 5) focus(i + 1);
                  }}
                  onPaste={(e) => {
                    const t = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
                    if (!t) return;
                    e.preventDefault();
                    const d = ["", "", "", "", "", ""];
                    t.split("").forEach((ch, k) => { d[k] = ch; });
                    update(d, Math.min(t.length, 5));
                  }}
                  className="box-border h-14 w-full rounded-[6px] text-center font-mono text-[24px] font-medium text-[#121826] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]"
                  style={{ border, background: bg }}
                />
              );
            })}
          </div>
          <p role={mode === "wrong" ? "alert" : "status"} aria-live="polite" className="mt-2 text-[13px]" style={{ color: msgInk }}>{msg}</p>
          {resends >= 3 && !limit ? (
            <p className="mt-1.5 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-2.5 py-2 text-[13px] text-[#3B2A07]">
              {/* TODO(domain): real sender domain */}
              Still nothing after {resends} tries? Check spam, or ask IT to allow mail from <span className="font-mono">[sender domain]</span>. Resend now waits a little longer each time.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {expired ? (
        <div role="alert" className="mt-4 rounded-[6px] border border-l-4 border-[#DADDE3] border-l-[#A8600F] bg-white p-4">
          <div className="font-semibold">This code expired</div>
          <p className={`mt-1 text-[14px] ${ui.muted}`}>Codes and links last 15 minutes. We&apos;ll send a fresh one to {email}.</p>
          <button type="button" onClick={() => resend(true)} disabled={pending} className={`mt-3 h-11 ${ui.primary}`}>Send a new code</button>
        </div>
      ) : null}

      {locked ? (
        <div role="alert" className="mt-4 rounded-[6px] border border-l-4 border-[#F3C3BE] border-l-[#B3261E] bg-[#FDECEA] p-4 text-[#5C1A15]">
          <div className="font-semibold">Too many tries</div>
          <p className="mt-1 text-[14px]">To keep your account safe, codes are paused. Try again in <span className="font-mono font-semibold">{mmss(lock)}</span>.</p>
          <div className="mt-2.5 flex flex-wrap gap-4 text-[14px]"><Link href="/account-help" className={ui.link}>Contact support</Link></div>
        </div>
      ) : null}

      {note ? <p role="status" className="mt-3 text-[13px] text-[#7A4508]">{note}</p> : null}

      {!locked && !expired ? (
        <button type="button" onClick={() => submit(digits)} disabled={pending || digits.join("").length < 6} className={`mt-5 h-12 ${ui.primary}`}>
          {pending ? "Checking…" : "Confirm email"}
        </button>
      ) : null}
      <p className={`mt-3.5 text-[14px] ${ui.muted}`}>Or click the link in the email — it confirms you and continues here.</p>

      <div className="mt-[18px] flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
        {left === 0 && !limit && !locked && !expired ? (
          <button type="button" onClick={() => resend()} disabled={pending} className="min-h-6 border-0 bg-transparent p-0 text-[14px] font-semibold text-[#2F5FD0] underline">Resend code</button>
        ) : null}
        {left > 0 && !limit && !locked && !expired ? (
          <span className={`font-mono text-[13px] ${ui.muted}`} aria-label={`You can ask for a new code in ${left} seconds`}>Resend in {mmss(left)}</span>
        ) : null}
        {limit && !locked ? <span className={`text-[13px] ${ui.muted}`}>Resend limit reached · <Link href="/account-help" className={ui.link}>Recover your account</Link></span> : null}
        <span aria-hidden className="text-[#B7BDC9]">·</span>
        <Link href={changeHref} className={ui.link}>Wrong email? Change it</Link>
      </div>

      <details className="mt-6 rounded-[6px] border border-[#DADDE3] bg-white px-3.5 py-3 text-[14px]">
        <summary className="cursor-pointer font-semibold">Email not arriving?</summary>
        <ul className={`mt-2.5 flex flex-col gap-1.5 pl-[18px] ${ui.muted}`}>
          <li>Check spam, “Other” or “Promotions” folders.</li>
          <li>Universities sometimes hold automated mail for a few minutes.</li>
          <li>Ask IT to allow mail from <span className="font-mono">[sender domain]</span>.</li>
        </ul>
      </details>
    </>
  );
}
