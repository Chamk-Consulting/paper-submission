"use client";

import { useActionState, useEffect } from "react";
import { useT } from "@/lib/i18n/client";
import { verifyTwoStep, type SecState } from "@/lib/account/security-actions";
import { signOut } from "@/lib/auth/actions";
import { ui } from "@/components/auth/split-layout";

/** Authenticator code after a password / email-code sign-in. */
export function TwoStepForm({ next }: { next: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<SecState, FormData>(verifyTwoStep, {});
  useEffect(() => {
    // Full navigation so the upgraded session cookie is sent with the next request.
    if (state.ok) window.location.assign(`/auth/continue?next=${encodeURIComponent(next)}`);
  }, [state.ok, next]);
  return (
    <>
      <form action={action} noValidate className="mt-[22px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ts-code" className={ui.label}>{t("6-digit code")}</label>
          <input id="ts-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000 000" autoFocus
            aria-invalid={state.error ? true : undefined} aria-describedby="ts-err"
            className="box-border h-[46px] rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 font-mono text-[20px] tracking-[0.3em] text-[#121826] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]"
            style={state.error ? { borderColor: "#B3261E" } : undefined} />
          {state.error ? <span id="ts-err" role="alert" data-form-error className={ui.error}>{t(state.error)}</span> : null}
        </div>
        <button type="submit" disabled={pending || state.ok} className={`mt-4 ${ui.primary}`}>{pending || state.ok ? t("Checking…") : t("Verify and continue")}</button>
      </form>
      <details className="mt-6 rounded-[6px] border border-[#DADDE3] bg-white px-3.5 py-3 text-[14px]">
        <summary className="cursor-pointer font-semibold">{t("Lost your phone?")}</summary>
        <p className="mb-0 mt-2 text-[#4A5263]">{t("Use the backup authenticator app if you added one. Otherwise contact Plenary support from the email on your account — we’ll check it’s you before removing two-step sign-in.")}</p>
      </details>
      <form action={signOut} className="mt-4">
        <button type="submit" className={`border-0 bg-transparent p-0 text-[14px] ${ui.link}`}>{t("Sign out and use another account")}</button>
      </form>
    </>
  );
}
