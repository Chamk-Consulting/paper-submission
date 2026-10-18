"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client";
import type { Ops2State } from "@/lib/manage/ops2-actions";

type Action = (prev: Ops2State, fd: FormData) => Promise<Ops2State>;

function Btn({ className, children, pendingLabel, disabled, confirm }: { className: string; children: ReactNode; pendingLabel?: string; disabled?: boolean; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** One-button form for a server action, with its error shown next to it. */
export function Act({ action, fields, className, children, pendingLabel, disabled, confirm, done }: {
  action: Action; fields: Record<string, string>; className: string; children: ReactNode; pendingLabel?: string; disabled?: boolean; confirm?: string; done?: ReactNode;
}) {
  const t = useT();
  const [state, run] = useActionState<Ops2State, FormData>(action, {});
  return (
    <form action={run} className="inline-flex flex-col items-start gap-1">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {state.ok && done ? done : <Btn className={className} pendingLabel={pendingLabel} disabled={disabled} confirm={confirm}>{children}</Btn>}
      {state.error ? <span role="alert" className="text-[12px] text-[#B3261E]">{t(state.error)}</span> : null}
    </form>
  );
}

export function StateLine({ state }: { state: Ops2State }) {
  const t = useT();
  if (state.error) return <p role="alert" className="m-0 text-[13px] text-[#B3261E]">{t(state.error)}</p>;
  if (state.info) return <p role="status" className="m-0 text-[13px] text-[#4A5263]">{t(state.info)}</p>;
  return null;
}

export function FieldErr({ state, name }: { state: Ops2State; name: string }) {
  const t = useT();
  const m = state.fieldErrors?.[name];
  return m ? <span className="text-[12px] font-normal text-[#B3261E]">{t(m)}</span> : null;
}

export function Submit({ className, children, pendingLabel, disabled, name, value }: { className: string; children: ReactNode; pendingLabel?: string; disabled?: boolean; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" name={name} value={value} disabled={pending || disabled} className={className}>{pending && pendingLabel ? pendingLabel : children}</button>;
}
