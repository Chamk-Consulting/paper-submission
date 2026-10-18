"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { Act, StateLine, Submit } from "@/components/manage/ops2/act";
import { archiveEvent, markProceedingsStep, setNoshowDecision, type Ops2State } from "@/lib/manage/ops2-actions";

export function StepButton({ slug, step, label, done, disabled }: { slug: string; step: string; label: string; done: string | null; disabled: boolean }) {
  const t = useT();
  return (
    <Act action={markProceedingsStep} fields={{ slug, step }} disabled={disabled}
      className={done ? `${ui.ghost} h-10!` : `${ui.navy} h-10!`} pendingLabel={t("Working…")}
      done={<span className={`${ui.tag} bg-[#E1F3EA] text-[#14603F]`}>{t("Done ✓")}</span>}>
      {done ? t("Run again") : label}
    </Act>
  );
}

export function NoshowDecision({ slug, submission, decision }: { slug: string; submission: string; decision: string | null }) {
  const t = useT();
  const on = "border-[#0E1B3D] bg-[#0E1B3D] text-white", off = "border-[#B7BDC9] bg-white text-[#121826]";
  return (
    <div className="flex flex-wrap gap-1.5">
      <Act action={setNoshowDecision} fields={{ slug, submission, decision: "keep" }} className={`h-8 cursor-pointer rounded-full border px-3 text-[12px] ${decision === "keep" ? on : off}`}>{t("Exception — keep")}</Act>
      <Act action={setNoshowDecision} fields={{ slug, submission, decision: "leave_out" }} className={`h-8 cursor-pointer rounded-full border px-3 text-[12px] ${decision === "leave_out" ? on : off}`}>{t("Leave out")}</Act>
    </div>
  );
}

export function ArchiveForm({ slug, archived, canArchive }: { slug: string; archived: boolean; canArchive: boolean }) {
  const t = useT();
  const [state, run] = useActionState<Ops2State, FormData>(archiveEvent, {});
  const [typed, setTyped] = useState("");
  if (archived || state.ok) return <p className={`${ui.ok} m-0`}>{t("Archived ✓ (read-only)")}</p>;
  if (!canArchive) return <p className={`${ui.hint} m-0`}>{t("Only the owner or general chair can archive the event.")}</p>;
  return (
    <form action={run} className="flex flex-col gap-2">
      <input type="hidden" name="slug" value={slug} />
      <label className={ui.label}>{t("Type “archive” to confirm")}<input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} className={ui.input} autoComplete="off" /></label>
      <StateLine state={state} />
      <Submit className={ui.ghost} disabled={typed !== "archive"} pendingLabel={t("Archiving…")}>{t("Archive event")}</Submit>
    </form>
  );
}
