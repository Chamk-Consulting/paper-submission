"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPassword, resetPassword, signIn, signUp } from "@/lib/auth/actions";
import type { FormState } from "@/lib/validation/auth";
import { Field, Notice, SubmitButton } from "@/components/ui";

const initial: FormState = {};

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} noValidate>
      {state.message ? <Notice tone="bad">{state.message}</Notice> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required error={state.fieldErrors?.password} />
      <div className="-mt-2 mb-4 text-right text-sm">
        <Link href="/forgot-password" className="text-navy underline underline-offset-2">Forgot password?</Link>
      </div>
      <SubmitButton pending={pending}>Sign in</SubmitButton>
      {/* TODO(auth): Google, Microsoft and ORCID buttons once providers are configured in Supabase. */}
    </form>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signUp, initial);
  const e = state.fieldErrors;
  return (
    <form action={action} noValidate>
      {state.message ? <Notice tone="bad">{state.message}</Notice> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Given name" name="givenName" autoComplete="given-name" required error={e?.givenName} />
        <Field label="Family name" name="familyName" autoComplete="family-name" required error={e?.familyName} />
      </div>
      <Field label="Email" name="email" type="email" autoComplete="email" required error={e?.email}
        hint="Use the address you publish with — co-authors and chairs find you by it." />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={10} error={e?.password}
        hint="At least 10 characters." />
      <label className="mb-4 flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" name="consent" className="mt-1 accent-navy" aria-describedby="consent-err" />
        <span>
          I accept the <Link href="/legal/terms" className="text-navy underline">terms</Link> and{" "}
          <Link href="/legal/privacy" className="text-navy underline">privacy notice</Link>.
        </span>
      </label>
      {e?.consent ? <p id="consent-err" className="-mt-3 mb-4 text-xs text-bad">{e.consent[0]}</p> : null}
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPassword, initial);
  if (state.ok) return <Notice tone="ok">{state.message}</Notice>;
  return (
    <form action={action} noValidate>
      <Field label="Email" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
      <SubmitButton pending={pending}>Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(resetPassword, initial);
  return (
    <form action={action} noValidate>
      {state.message ? <Notice tone="bad">{state.message}</Notice> : null}
      <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={10} error={state.fieldErrors?.password} hint="At least 10 characters." />
      <Field label="Repeat new password" name="confirm" type="password" autoComplete="new-password" required error={state.fieldErrors?.confirm} />
      <SubmitButton pending={pending}>Save new password</SubmitButton>
    </form>
  );
}
