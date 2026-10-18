"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { FieldError, SaveBar } from "@/components/manage/save-bar";
import { resetTemplate, saveTemplate, sendTestTemplate } from "@/lib/manage/setup2-actions";
import type { ManageState } from "@/lib/manage/actions-util";

export type Template = { key: string; name: string; recipients: string; subject: string; body: string; overridden: boolean; defSubject: string; defBody: string };
type Status = "not_started" | "in_progress" | "ready";

const RECIPIENTS: Record<string, string> = { authors: "Authors", co_authors: "Co-authors", accepted_authors: "Accepted authors",reviewers: "Reviewers", committee: "Committee", everyone: "Everyone" };
const CHIPS = ["[paper.id]", "[paper.title]", "[author.first]", "[deadline]", "[venue.short]", "[venue.contact]", "[link]"];

export function EmailsEditor({ slug, templates, sample, contactMissing, sendAs, senderName, status, last, canEdit }: {
  slug: string; templates: Template[]; sample: Record<string, string>; contactMissing: boolean; sendAs: boolean; senderName: string;
  status: Status; last: { at: string | null; by: string | null }; canEdit: boolean;
}) {
  const t = useT();
  const [key, setKey] = useState(templates[0]?.key ?? "");
  const current = templates.find((x) => x.key === key) ?? templates[0];
  if (!current) return <p className={ui.hint}>{t("No email templates found.")}</p>;
  return (
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label={t("Templates")} className={`${ui.card} p-2!`}>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {templates.map((x) => {
            const attention = contactMissing && (x.body.includes("[venue.contact]") || x.subject.includes("[venue.contact]"));
            return (
              <li key={x.key}>
                <button type="button" aria-current={x.key === current.key ? "true" : undefined} onClick={() => setKey(x.key)}
                  className="flex w-full items-start justify-between gap-2 rounded-[6px] border-0 px-3 py-2.5 text-left"
                  style={{ background: x.key === current.key ? "#EEF0EC" : "transparent" }}>
                  <span>
                    <span className="block text-[14px] font-semibold text-[#0E1B3D]">{t(x.name)}</span>
                    <span className="block text-[12px] text-[#4A5263]">{t(RECIPIENTS[x.recipients] ?? x.recipients)}{x.overridden ? ` · ${t("edited")}` : ""}</span>
                  </span>
                  {attention ? <span aria-label={t("Needs attention")} className="mt-1.5 size-2 flex-none rounded-full bg-[#B3261E]" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <TemplateForm key={current.key} slug={slug} tpl={current} sample={sample} contactMissing={contactMissing} sendAs={sendAs} senderName={senderName} status={status} last={last} canEdit={canEdit} />
    </div>
  );
}

function render(text: string, sample: Record<string, string>) {
  return text.replace(/\[([a-z]+(?:\.[a-z]+)?)\]/g, (m, k: string) => sample[k] ?? m);
}

function TemplateForm({ slug, tpl, sample, contactMissing, sendAs, senderName, status, last, canEdit }: {
  slug: string; tpl: Template; sample: Record<string, string>; contactMissing: boolean; sendAs: boolean; senderName: string;
  status: Status; last: { at: string | null; by: string | null }; canEdit: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [state, action] = useActionState<ManageState, FormData>(saveTemplate, {});
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const usesContact = useMemo(() => (subject + body).includes("[venue.contact]"), [subject, body]);
  const insert = (chip: string) => {
    const el = bodyRef.current;
    if (!el) return setBody((b) => b + chip);
    const s = el.selectionStart ?? body.length, e = el.selectionEnd ?? body.length;
    setBody(body.slice(0, s) + chip + body.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + chip.length, s + chip.length); });
  };
  const test = () => start(async () => {
    const r = await sendTestTemplate(slug, render(subject, sample), render(body, sample));
    setMsg(r.error ? { ok: false, text: t(r.error) } : r.skipped ? { ok: false, text: t("Email sending isn't configured yet, so nothing was sent to {to}.", { to: r.to ?? "" }) } : { ok: true, text: t("Test sent to {to}.", { to: r.to ?? "" }) });
  });
  const reset = () => {
    if (!tpl.overridden) { setSubject(tpl.defSubject); setBody(tpl.defBody); return; }
    if (!confirm(t("Go back to the Plenary default text for this email?"))) return;
    start(async () => {
      const r = await resetTemplate(slug, tpl.key);
      if (r.error) setMsg({ ok: false, text: t(r.error) });
      else { setSubject(tpl.defSubject); setBody(tpl.defBody); router.refresh(); }
    });
  };
  return (
    <form action={action} className="min-w-0">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="key" value={tpl.key} />
      <section className={ui.card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={ui.h2}>{t(tpl.name)}</h2>
          <span className={ui.hint}>{t("To: {who}", { who: t(RECIPIENTS[tpl.recipients] ?? tpl.recipients) })}</span>
        </div>
        {contactMissing && usesContact ? (
          <p role="alert" className={`${ui.bad} mt-3`}>{t("[venue.contact] has no value yet — sending is blocked until it's filled in Basics (I5).")}</p>
        ) : null}
        <fieldset disabled={!canEdit} className="m-0 mt-4 flex flex-col gap-4 border-0 p-0">
          <label className={ui.label}>{t("Subject")}
            <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={ui.input} maxLength={200} />
            <FieldError state={state} name="subject" />
          </label>
          <div>
            <span className={ui.label}>{t("Insert a placeholder")}</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CHIPS.map((c) => (
                <button key={c} type="button" onClick={() => insert(c)} className="rounded-[4px] border border-[#DADDE3] bg-[#F5F6F3] px-2 py-1 font-mono text-[12px] text-[#1F47A8]">{c}</button>
              ))}
            </div>
          </div>
          <label className={ui.label}>{t("Message")}
            <textarea ref={bodyRef} name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={12} className={`${ui.textarea} font-mono text-[14px]`} />
            <FieldError state={state} name="body" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={test} disabled={pending} className={ui.ghost}>{t("Send test to me")}</button>
            <button type="button" onClick={reset} disabled={pending} className={ui.ghost}>{t("Reset to default")}</button>
          </div>
          {msg ? <p role="status" className={msg.ok ? ui.ok : ui.warn}>{msg.text}</p> : null}
        </fieldset>
      </section>

      <section className={`${ui.card} mt-5`} aria-label={t("Preview")}>
        <p className={ui.kicker}>{t("Preview as {name}, {paper}", { name: `${sample["author.first"]} ${sample["author.last"] ?? ""}`.trim(), paper: sample["paper.id"] })}</p>
        <div className="mt-3 rounded-[6px] border border-[#DADDE3] bg-[#FAFAF8] p-4">
          <p className="m-0 text-[13px] text-[#4A5263]">{t("From")}: {sendAs ? senderName : "Plenary"}</p>
          <p className="m-0 mt-1 font-semibold text-[#0E1B3D]">{render(subject, sample)}</p>
          <div className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-[#1B2232]">{render(body, sample)}</div>
        </div>
      </section>

      <section className={`${ui.card} mt-5`}>
        <h2 className={ui.h2}>{t("Sender")}</h2>
        <label className="mt-2 flex items-center justify-between gap-4 border-b border-[#EEF0EC] py-3">
          <span><span className="block font-medium">{t("Send from “{name}”", { name: senderName })}</span><span className={ui.hint}>{t("Replies go to the event contact address.")}</span></span>
          <input type="checkbox" name="send_as_event" defaultChecked={sendAs} disabled={!canEdit} className="size-5 flex-none accent-[#18744F]" />
          {/* after the checkbox: FormData.get returns the first value, so "off" only counts when unchecked */}
          {canEdit ? <input type="hidden" name="send_as_event" value="off" /> : null}
        </label>
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="font-medium">{t("Copy in the Plenary inbox")}</span>
          <span className="text-[14px] text-[#14603F]">{t("Always on (I2)")}</span>
        </div>
      </section>
      <SaveBar state={state} status={status} last={last} readOnly={!canEdit} />
    </form>
  );
}
