"use client";

import { useActionState } from "react";
import { forgotPassword, resetPassword } from "@/lib/auth/actions";
import type { FormState } from "@/lib/validation/auth";
import { Field, Notice, SubmitButton } from "@/components/ui";

const initial: FormState = {};

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
