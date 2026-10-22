"use client";

import Link from "@/components/site/link";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client";
import { openSubmissions, sendGoLiveTest } from "@/lib/manage/setup1-actions";
import { ui } from "@/components/manage/ui";
import type { ManageState } from "@/lib/manage/actions-util";

/* EM13 — automatic checks with Fix links, two acknowledgements, then "Open submissions now" → Live state. */

export type Check = { key: string; ok: boolean; note: string; label: string; fix: string; advisory?: boolean };

function OpenButton({ disabled }: { disabled: boolean }) {
  const t = useT();
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending} className={`${ui.primary} w-full`}>{pending ? t("Opening…") : t("Open submissions now")}</button>;
}

export function GoLiveForm({ slug, checks, committee, canOpen, live, liveSince, opensLabel, myEmail, testPanel }: {
  slug: string; checks: Check[]; committee: number; canOpen: boolean; live: boolean; liveSince: string | null; opensLabel: string | null; myEmail: string | null; testPanel?: ReactNode;
}) {
  const t = useT();
  const [state, action] = useActionState<ManageState, FormData>(openSubmissions, {});
  const [ack, setAck] = useState(false);
  const [test, setTest] = useState<ManageState | null>(null);
  const [testing, start] = useTransition();
  const failing = checks.filter((c) => !c.ok && !c.advisory).length;
  const isLive = live || !!state.ok;

  if (isLive) {
    return (
      <section className="rounded-[8px] border border-[#B9E0CB] bg-white p-[22px]">
        <span className={`${ui.tag} bg-[#E1F3EA] text-[#14603F]`}>● {t("Live")}{liveSince ? ` · ${liveSince}` : ""}</span>
        <h2 className={`${ui.h2} mt-3`}>{t("Submissions are open")}</h2>
        <p className="mb-0 mt-2 text-[15px]">{t("The public page shows “Submit a paper”. Locked settings are now marked with a padlock in setup.")}</p>
        {state.info ? <p className={`mb-0 mt-3 ${ui.ok}`}>{t(state.info)}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/manage/${slug}`} className={ui.navy}>{t("Go to dashboard")}</Link>
          <Link href={`/venues/${slug}`} className={ui.ghost}>{t("View public page")}</Link>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className={ui.card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={ui.h2}>{t("Automatic checks")}</h2>
          <span className={`${ui.tag} ${failing ? "bg-[#FBEFDD] text-[#7A4508]" : "bg-[#E1F3EA] text-[#14603F]"}`}>{failing ? t("{n} to fix", { n: failing }) : t("All passed")}</span>
        </div>
        <ul className="m-0 mt-3 list-none p-0">
          {checks.map((c) => (
            <li key={c.key} className="flex items-start gap-3 border-b border-[#EEF0EC] py-3 last:border-0">
              <span aria-hidden className={`mt-0.5 grid size-6 flex-none place-items-center rounded-full text-[13px] font-bold ${c.ok ? "bg-[#E1F3EA] text-[#14603F]" : c.advisory ? "bg-[#FBEFDD] text-[#7A4508]" : "bg-[#FDECEA] text-[#8C1D18]"}`}>{c.ok ? "✓" : c.advisory ? "–" : "!"}</span>
              <span className="min-w-0 flex-auto"><strong className="block text-[15px]">{t(c.label)}</strong><span className="block text-[13px] text-[#4A5263]">{t(c.note)}</span></span>
              <span className="sr-only">{c.ok ? t("Passed") : c.advisory ? t("Recommended") : t("Not passed")}</span>
              {!c.ok ? <Link href={c.fix} className="flex-none text-[14px] font-medium">{c.advisory ? t("Run it") : t("Fix")}</Link> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className={ui.card}>
        <h2 className={ui.h2}>{t("Try it yourself")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link href={`/venues/${slug}`} target="_blank" className="rounded-[8px] border border-[#DADDE3] px-4 py-3 text-[#121826] no-underline hover:bg-[#F7F8F6]"><strong className="block">{t("Public page")}</strong><span className="text-[13px] text-[#4A5263]">{t("As visitors see it")} ↗</span></Link>
          <Link href={`/manage/${slug}/setup/emails`} className="rounded-[8px] border border-[#DADDE3] px-4 py-3 text-[#121826] no-underline hover:bg-[#F7F8F6]"><strong className="block">{t("Email previews")}</strong><span className="text-[13px] text-[#4A5263]">{t("Confirmation, reminders")}</span></Link>
        </div>
        {testPanel ? <div id="test">{testPanel}</div> : null}
        {myEmail ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={testing} onClick={() => start(async () => setTest(await sendGoLiveTest(slug, myEmail)))} className={ui.ghost}>{testing ? t("Sending…") : t("Send a test email to me")}</button>
            {test ? <span role="status" className={`text-[13px] ${test.error ? "text-[#B3261E]" : "text-[#4A5263]"}`}>{t(test.error ?? test.info ?? "")}</span> : null}
          </div>
        ) : null}
      </section>

      <form action={action} className={ui.card}>
        <input type="hidden" name="slug" value={slug} />
        {state.error ? <p role="alert" className={`m-0 mb-3 ${ui.bad}`}>{t(state.error)}</p> : null}
        <label className="flex cursor-pointer items-start gap-3 text-[15px]">
          <input type="checkbox" name="ack" checked={ack} onChange={(e) => setAck(e.target.checked)} disabled={!canOpen} className="mt-1 size-4 accent-[#0E1B3D]" />
          <span>{t("I understand blind type, score scale and submission types lock when submissions open")} <span className="text-[13px] text-[#4A5263]">· {t("Rule K3")}</span>
            {state.fieldErrors?.ack ? <span className="block text-[13px] text-[#B3261E]">{t(state.fieldErrors.ack)}</span> : null}</span>
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-[15px]">
          <input type="checkbox" name="notify" defaultChecked disabled={!canOpen || !committee} className="mt-1 size-4 accent-[#0E1B3D]" />
          <span>{t("Notify the {n} committee members that submissions are open", { n: committee })}</span>
        </label>
        <div className="mt-5"><OpenButton disabled={!canOpen || !ack || failing > 0} /></div>
        <p className="mb-0 mt-2 text-[13px] text-[#4A5263]" aria-live="polite">
          {!canOpen ? t("Only owners and program chairs can open submissions.") : failing ? t("Fix the checks above first (D1).") : !ack ? t("Tick the first box to continue.") : t("Ready to open.")}
        </p>
        {opensLabel ? <p className="mb-0 mt-4 border-t border-[#EEF0EC] pt-3 text-[13px] text-[#4A5263]">{t("Opens")} <strong className="text-[#121826]">{opensLabel}</strong> · {t("Or open now — the date on the public page updates.")}</p> : null}
      </form>
    </div>
  );
}
