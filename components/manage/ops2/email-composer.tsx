"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { FieldErr, StateLine, Submit } from "@/components/manage/ops2/act";
import { audienceCount, sendCampaign, sendTestCampaign, type Ops2State } from "@/lib/manage/ops2-actions";

const ROLE_CHIPS: [string, string][] = [["authors", "Authors"], ["reviewers", "Reviewers"], ["aes", "Associate editors"], ["session_chairs", "Session chairs"], ["committee", "Committee"]];
const COND_CHIPS: [string, string][] = [["acc", "Paper accepted"], ["inc", "Final version incomplete"], ["late", "Review overdue"], ["unsub", "Exclude unsubscribed (I4)"]];
const DEFAULT_SUBJECT = "Final version due [deadline] — what’s still missing for [paper.id]";
const DEFAULT_BODY = "Dear [author.first],\n\nFor [paper.id] we are still missing: [missing.items].\nPlease complete these by [deadline] so your paper appears in IEEE Xplore.\n\n[link]";

function Chip({ name, value, label, on, toggle }: { name: string; value: string; label: string; on: boolean; toggle: () => void }) {
  return (
    <label className={`inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[13px] ${on ? "border-[#0E1B3D] bg-[#0E1B3D] text-white" : "border-[#B7BDC9] bg-white text-[#121826]"}`}>
      <input type="checkbox" name={name} value={value} checked={on} onChange={toggle} className="sr-only" />{on ? "✓ " : ""}{label}
    </label>
  );
}

function Composer({ slug, initialCount, onNew }: { slug: string; initialCount: number; onNew: () => void }) {
  const t = useT();
  const [roles, setRoles] = useState<string[]>(["authors"]);
  const [conds, setConds] = useState<string[]>(["acc", "inc", "unsub"]);
  const [count, setCount] = useState(initialCount);
  const [counting, startCount] = useTransition();
  const [subject, setSubject] = useState(t(DEFAULT_SUBJECT));
  const [body, setBody] = useState(t(DEFAULT_BODY));
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [twice, setTwice] = useState(false);
  const [tested, setTested] = useState<{ key: string; id: string } | null>(null);
  const [test, runTest] = useActionState<Ops2State, FormData>(async (p, fd) => { const r = await sendTestCampaign(p, fd); if (r.ok && r.campaignId) setTested({ key: String(fd.get("_key")), id: r.campaignId }); return r; }, {});
  const [send, runSend] = useActionState<Ops2State, FormData>(sendCampaign, {});

  useEffect(() => {
    let alive = true;
    startCount(async () => { const n = await audienceCount(slug, roles, conds); if (alive) setCount(n); });
    return () => { alive = false; };
  }, [slug, roles, conds]);

  const key = JSON.stringify([roles, conds, subject, body]);
  const testOk = tested?.key === key;
  const big = count > 500;
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (send.ok) return (
    <section className={ui.card}>
      <p className={ui.kicker}>{send.scheduled ? t("Scheduled for") : t("Sending to")}</p>
      <p className="m-0 mt-1 font-serif text-[36px]">{t("{n} people", { n: send.sentTo ?? 0 })}</p>
      <p className={`${ui.hint} mt-2`}>{t("Logged in the audit log with the audience and message (J4). Each person also has it in their Plenary inbox (I2).")}</p>
      <StateLine state={send} />
      <button onClick={onNew} className={`${ui.ghost} mt-3`}>{t("New message")}</button>
    </section>
  );

  return (
    <form action={runSend} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="campaign" value={testOk ? tested!.id : ""} />
      <input type="hidden" name="_key" value={key} />
      <section className={ui.card}>
        <h2 className={ui.h2}>{t("1 · Who gets it")}</h2>
        <p className={`${ui.kicker} mt-4`}>{t("Role")}</p>
        <div className="mt-2 flex flex-wrap gap-2">{ROLE_CHIPS.map(([v, l]) => <Chip key={v} name="roles" value={v} label={t(l)} on={roles.includes(v)} toggle={() => toggle(roles, setRoles, v)} />)}</div>
        <p className={`${ui.kicker} mt-4`}>{t("Only if")}</p>
        <div className="mt-2 flex flex-wrap gap-2">{COND_CHIPS.map(([v, l]) => <Chip key={v} name="conds" value={v} label={t(l)} on={conds.includes(v)} toggle={() => toggle(conds, setConds, v)} />)}</div>
        <p className="m-0 mt-4 text-[15px]" aria-live="polite">
          <strong className="font-serif text-[24px]">{roles.length ? t("{n} recipients", { n: count }) : "—"}</strong>{" "}
          <span className={ui.hint}>{counting ? t("counting…") : roles.length ? t("deduplicated — people with several roles get it once") : t("choose at least one role")}</span>
        </p>
      </section>

      <section className={ui.card}>
        <h2 className={ui.h2}>{t("2 · Message")}</h2>
        <label className={`${ui.label} mt-4`}>{t("Subject")}<input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={ui.input} /><FieldErr state={send.fieldErrors ? send : test} name="subject" /></label>
        <label className={`${ui.label} mt-3`}>{t("Message")}<textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={9} maxLength={20000} className={`${ui.textarea} font-mono text-[13px]`} /><FieldErr state={send.fieldErrors ? send : test} name="body" /></label>
        <p className={`${ui.hint} m-0 mt-2`}>{t("Placeholders: [author.first] [paper.id] [paper.title] [missing.items] [deadline] [venue.short] [link]. Each recipient gets their own values. Also delivered to their Plenary inbox (I2).")}</p>
      </section>

      <section className={ui.card}>
        <h2 className={ui.h2}>{t("3 · Send")}</h2>
        <div role="radiogroup" className="mt-4 flex gap-2">
          {(["now", "schedule"] as const).map((m) => (
            <label key={m} className={`inline-flex h-[34px] cursor-pointer items-center rounded-full border px-3.5 text-[13px] ${mode === m ? "border-[#0E1B3D] bg-[#0E1B3D] text-white" : "border-[#B7BDC9] bg-white"}`}>
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />{m === "now" ? t("Send now") : t("Schedule")}
            </label>
          ))}
        </div>
        {mode === "schedule" ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className={ui.label}>{t("Date")}<input type="date" name="day" required className={ui.input} /></label>
            <label className={ui.label}>{t("Time (event time zone)")}<input type="time" name="time" required defaultValue="09:00" className={ui.input} /></label>
            <FieldErr state={send} name="when" />
          </div>
        ) : null}
        {big ? (
          <label className="mt-3 flex items-start gap-2 text-[14px]">
            <input type="checkbox" name="confirm_twice" checked={twice} onChange={(e) => setTwice(e.target.checked)} className="mt-0.5 size-4" />
            <span>{t("Yes — send to {n} people (second confirmation)", { n: count })}<span className={`${ui.hint} block`}>{t("Required over 500 recipients (I3)")}</span></span>
          </label>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="submit" formAction={runTest} disabled={!roles.length} className={ui.ghost}>{testOk ? t("Test sent ✓") : t("Send test to me")}</button>
          <Submit className={ui.primary} disabled={!testOk || !count || (big && !twice)} pendingLabel={t("Sending…")}>
            {mode === "now" ? t("Send to {n}", { n: count }) : t("Schedule for {n}", { n: count })}
          </Submit>
        </div>
        {!testOk ? <p className={`${ui.hint} m-0 mt-2`}>{t("Send a test to yourself first — sending unlocks after the test (I3).")}</p> : null}
        <div className="mt-2 flex flex-col gap-1"><StateLine state={test.error || test.info ? test : {}} /><StateLine state={send} /></div>
      </section>
    </form>
  );
}

export function EmailComposer({ slug, initialCount }: { slug: string; initialCount: number }) {
  const [k, setK] = useState(0);
  return <Composer key={k} slug={slug} initialCount={initialCount} onNew={() => setK((x) => x + 1)} />;
}
