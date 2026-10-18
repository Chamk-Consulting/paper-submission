"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveNewPassword, type NewPasswordState } from "@/lib/auth/reset-actions";
import { maskEmail, scorePassword } from "@/lib/auth/password-rules";
import { NavyAside, SetupSteps, ShieldNote, SplitLayout, ui } from "@/components/auth/split-layout";
import { useT } from "@/lib/i18n/client";

const COLORS = ["#DADDE3", "#B3261E", "#A8600F", "#2F5FD0", "#18744F"];
const LABELS = ["—", "Too weak", "Could be stronger", "Good", "Strong"];
const stamp = (intl: string) => new Date().toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" });

/** Canvas PR11: choose a new password, then the "You're all set" state. */
export function NewPasswordFlow({ email, acceptedAt }: { email: string; acceptedAt: string }) {
  const [state, action, pending] = useActionState<NewPasswordState, FormData>(saveNewPassword, {});
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [tried, setTried] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const t = useT();
  const masked = maskEmail(email);
  const done = !!state.done;

  const r = scorePassword(pw, email);
  const mismatch = pw2.length > 0 && pw2 !== pw;
  const matchOk = pw2.length > 0 && pw2 === pw;
  const triedOrServer = tried || !!state.fieldErrors?.password;
  const rule = (pass: boolean, label: string) => ({ t: t(label), mark: pass ? "✓" : triedOrServer ? "!" : "·", ink: pass ? "#14603F" : triedOrServer ? "#B3261E" : "#4A5263" });
  const rules = [rule(r.long, "At least 12 characters"), rule(r.notCommon, "Not a common or leaked password"), rule(r.notEmail, "Doesn’t contain your name or email")];
  const newBorder = triedOrServer && !r.ok ? "2px solid #B3261E" : "1px solid #B7BDC9";
  const confirmBorder = mismatch || state.fieldErrors?.confirm ? "2px solid #B3261E" : matchOk ? "2px solid #18744F" : "1px solid #B7BDC9";

  const steps = [
    { title: t("Find your account"), text: email, state: "done" as const },
    { title: t("Check your email"), text: `${t("Code accepted")}${acceptedAt ? ` ${acceptedAt}` : ""}.`, state: "done" as const },
    done
      ? { title: t("Choose a new password"), text: `${t("Saved {time}", { time: savedAt })}${state.signedOutOthers ? ` · ${t("other devices signed out.")}` : "."}`, state: "done" as const }
      : { title: t("Choose a new password"), text: t("Then you go straight back to where you were."), state: "current" as const },
  ];

  const aside = (
    <NavyAside label={t("Password reset progress")} kicker={t("Resetting your password")} title={t("Almost back in.")}>
      <SetupSteps steps={steps} doneLabel={t("Done")} />
      <ShieldNote>
        <strong className="text-[#F5F6F3]">{t("We’ll email you when your password changes.")}</strong> {t("If it wasn’t you, the email has a link to lock your account straight away.")}
      </ShieldNote>
    </NavyAside>
  );

  if (done) {
    return (
      <SplitLayout aside={aside}>
        <p className="m-0 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#18744F]">{t("Password updated")}</p>
        <h1 className={`mt-1.5 ${ui.h1}`}>{t("You're all set")}</h1>
        <p className={`mt-2.5 ${ui.muted}`}>
          {t("Your new password works now.")}{" "}
          {state.signedOutOthers ? t("We've signed you out on your other devices and sent a confirmation to {email}.", { email: masked }) : t("We've sent a confirmation to {email}.", { email: masked })}
        </p>
        <Link href="/workspace" className={`mt-[22px] h-12 ${ui.primary}`}>{t("Continue to My workspace")}</Link>
        <div className="mt-[18px] rounded-[6px] border border-[#DADDE3] bg-white p-4">
          <div className="font-semibold">{t("Skip passwords next time?")}</div>
          <p className={`mt-1 text-[14px] ${ui.muted}`}>{t("Add a passkey and sign in with your fingerprint, face or device PIN.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {/* TODO(auth): passkeys (WebAuthn) — Supabase Auth doesn't ship them yet; plan via ST02 Security. */}
            <button type="button" disabled title={t("Coming soon")} className="h-[38px] rounded-[4px] border-0 bg-[#F2A93B] px-3.5 text-[14px] font-semibold text-[#0E1B3D] disabled:opacity-60">{t("Add a passkey")}</button>
            <Link href="/workspace" className="flex h-[38px] items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-medium text-[#121826] no-underline">{t("Not now")}</Link>
          </div>
        </div>
      </SplitLayout>
    );
  }

  return (
    <SplitLayout aside={aside}>
      <form
        action={(fd) => { setSavedAt(stamp(t.intl)); return action(fd); }}
        onSubmit={(e) => {
          if (!r.ok || pw !== pw2) { e.preventDefault(); setTried(true); }
        }}
        noValidate
      >
        <div className="flex items-center gap-2 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3 py-2 text-[14px] text-[#14603F]">
          <span aria-hidden className="font-semibold">✓</span><span><strong>{t("Code accepted.")}</strong> {t("Resetting for {email}", { email: masked })}</span>
        </div>
        <p className={`mt-5 ${ui.kicker}`}>{t("Password reset")}</p>
        <h1 className={`mt-1.5 ${ui.h1}`}>{t("Choose a new password")}</h1>
        <p className={`mt-2.5 ${ui.muted}`}>{t("Use something long you don't use anywhere else. A short phrase works well.")}</p>

        {/* Hidden username helps password managers save the right account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />

        <div className="mt-[22px] flex flex-col gap-1.5">
          <label htmlFor="pr11-new" className={ui.label}>{t("New password")}</label>
          <div className="flex overflow-hidden rounded-[4px] bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2F5FD0]" style={{ border: newBorder }}>
            <input
              id="pr11-new" name="password" type={show ? "text" : "password"} autoComplete="new-password" maxLength={128}
              value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby="pr11-rules"
              aria-invalid={triedOrServer && !r.ok ? true : undefined}
              className="box-border h-[46px] min-w-0 flex-auto border-0 bg-transparent px-3.5 text-[16px] text-[#121826] outline-none"
            />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? t("Hide password") : t("Show password")}
              className="w-[68px] border-0 border-l border-[#B7BDC9] bg-[#F2F3F0] text-[13px] font-medium text-[#4A5263]">
              {show ? t("Hide") : t("Show")}
            </button>
          </div>
          <div aria-hidden className="mt-1 grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((i) => <span key={i} className="h-1 rounded-sm" style={{ background: r.sc >= i ? COLORS[r.sc] : "#DADDE3" }} />)}
          </div>
          <div className="flex justify-between text-[13px]">
            <span className={ui.muted}>{t("Strength")}</span>
            <span className="font-semibold" style={{ color: r.sc ? COLORS[r.sc] : "#4A5263" }}>{t(LABELS[r.sc])}</span>
          </div>
          <ul id="pr11-rules" className="m-0 mt-1 flex list-none flex-col gap-1 p-0 text-[13px]">
            {rules.map((x) => (
              <li key={x.t} className="flex items-center gap-2" style={{ color: x.ink }}>
                <span aria-hidden className="w-4 text-center font-semibold">{x.mark}</span>{x.t}
              </li>
            ))}
          </ul>
          {state.fieldErrors?.password ? <span role="alert" className={ui.error}>{t(state.fieldErrors.password[0])}</span> : null}
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor="pr11-confirm" className={ui.label}>{t("Type it again")}</label>
          <input
            id="pr11-confirm" name="confirm" type={show ? "text" : "password"} autoComplete="new-password" maxLength={128}
            value={pw2} onChange={(e) => setPw2(e.target.value)} aria-invalid={mismatch || undefined}
            className={`${ui.input} h-[46px]`} style={{ border: confirmBorder }}
          />
          {mismatch || (tried && pw2 !== pw) ? <span className={ui.error}>{t("The two passwords don't match yet.")}</span> : null}
          {matchOk ? <span className="text-[13px] text-[#14603F]">✓ {t("Passwords match.")}</span> : null}
        </div>

        <label className="mt-4 flex items-start gap-2.5 text-[14px]">
          <input type="checkbox" name="signOutOthers" defaultChecked className="mt-0.5 size-[18px] flex-none accent-[#0E1B3D]" />
          <span>{t("Sign out of all other devices")}<span className={`block text-[13px] ${ui.muted}`}>{t("Recommended if you think someone else knew your password.")}</span></span>
        </label>

        {state.message ? (
          <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">
            {t(state.message)} <Link href="/forgot-password" className={ui.link}>{t("Get a new code")}</Link>
          </p>
        ) : null}

        <button type="submit" disabled={pending} className={`mt-[18px] h-12 ${ui.primary}`}>{pending ? t("Saving…") : t("Save new password")}</button>
      </form>
    </SplitLayout>
  );
}
