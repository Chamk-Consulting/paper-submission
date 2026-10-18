"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { startPasswordReset, type ForgotState } from "@/lib/auth/reset-actions";
import { ui } from "@/components/auth/split-layout";

/** Canvas PR10 form. */
export function ForgotForm({ initial = "" }: { initial?: string }) {
  const [state, action, pending] = useActionState<ForgotState, FormData>(startPasswordReset, {});
  const [id, setId] = useState(initial);
  const err = state.fieldErrors?.identifier?.[0];

  return (
    <form action={action} noValidate>
      <div className="mt-[22px] flex flex-col gap-1.5">
        <label htmlFor="pr10-id" className={ui.label}>Email, phone, Plenary ID or alias</label>
        <input
          id="pr10-id" name="identifier" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
          placeholder="name@uni.edu · PL-4821-0937 · a.researcher"
          value={id} onChange={(e) => setId(e.target.value)}
          aria-invalid={err ? true : undefined} aria-describedby={err ? "pr10-id-err" : undefined}
          className={`${ui.input} h-12`}
          style={err ? { border: "2px solid #B3261E" } : undefined}
        />
        {err ? <span id="pr10-id-err" className={ui.error}>{err}</span> : null}
      </div>
      {state.message ? <p role="alert" className="mt-3 text-[13px] text-[#7A4508]">{state.message}</p> : null}
      <button type="submit" disabled={pending} className={`mt-[18px] h-12 ${ui.primary}`}>
        {pending ? "Sending…" : "Send reset code"}
      </button>
      <div className="mt-[22px] rounded-[6px] border border-[#DADDE3] bg-white px-4 py-3.5 text-[14px] text-[#4A5263]">
        <strong className="text-[#121826]">You may not need a password.</strong> Plenary can sign you in with a code by email or a passkey.{" "}
        <Link href="/sign-in" className={ui.link}>Email me a sign-in code instead</Link>
      </div>
      <p className={`mt-[18px] text-[14px] ${ui.muted}`}>
        No longer have access to that email? <Link href="/account-help" className={ui.link}>Recover your account</Link>
      </p>
    </form>
  );
}
