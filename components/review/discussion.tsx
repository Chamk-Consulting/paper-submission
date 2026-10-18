"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { postDiscussion, saveReview, type ActionState } from "@/lib/review/actions";
import type { Post } from "@/lib/review/data";
import { RECS, fmtDateTime, partyLabel, type Criterion, type Rec } from "@/lib/review/shared";
import { Pills, ScoreButtons } from "@/components/review/controls";
import { box, kick } from "@/components/review/parts";
import { ui } from "@/components/manage/ui";

const initials = (label: string) => label.startsWith("Associate") ? "AE" : label.startsWith("Reviewer") ? `R${label.match(/\d+/)?.[0] ?? ""}` : "PC";
const avatar = (label: string, me: boolean) => me ? "#2F5FD0" : label.startsWith("Associate") ? "#0E1B3D" : "#6B7385";

/** RV07 thread + reply box. */
export function Thread({ id, submissionId, posts, me, canPost }: { id: string; submissionId: string; posts: Post[]; me: string; canPost: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(postDiscussion, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <section className={ui.card}>
      <h2 className={ui.h2}>{t("Thread")}</h2>
      {posts.length === 0 ? <p className="mb-0 mt-2 text-[14px] text-[#4A5263]">{t("No messages yet. The editor usually starts the discussion.")}</p> : null}
      <ol className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
        {posts.map((m) => (
          <li key={m.id} className={`flex gap-3 rounded-[6px] border px-3.5 py-3 ${m.is_me ? "border-[#C9D6F5] bg-[#FBFCFF]" : "border-[#EEF0EC] bg-white"}`}>
            <span aria-hidden className="flex size-8 flex-none items-center justify-center rounded-full font-mono text-[11px] font-semibold text-white" style={{ background: avatar(m.label, m.is_me) }}>{initials(m.label)}</span>
            <div className="min-w-0">
              <div className="text-[13px]"><strong>{partyLabel(t, m.label)}</strong> <span className="text-[#4A5263]">· {fmtDateTime(m.created_at, t.intl)}</span></div>
              <p className="mb-0 mt-1 whitespace-pre-line text-[15px]">{m.body}</p>
            </div>
          </li>
        ))}
      </ol>
      {canPost ? (
        <form ref={ref} action={action} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="submission" value={submissionId} />
          <label htmlFor="disc-body" className="text-[14px] font-medium">{t("Reply as {who}", { who: me })}</label>
          <textarea id="disc-body" name="body" rows={4} maxLength={8000} required className={ui.textarea} />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className={ui.navy}>{t("Post")}</button>
            {state.error ? <span role="alert" className="text-[14px] text-[#B3261E]">{t(state.error)}</span> : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}

/** RV07 aside — edit my submitted scores + recommendation (changes are logged, B9). */
export function MyScores({ id, criteria, initial }: {
  id: string; criteria: Criterion[];
  initial: { scores: Record<string, number>; recommendation: Rec | null; confidence: "low" | "medium" | "high" | null; to_authors: string; to_editor: string };
}) {
  const t = useT();
  const [d, setD] = useState(initial);
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const changed = JSON.stringify(d.scores) !== JSON.stringify(initial.scores) || d.recommendation !== initial.recommendation;
  return (
    <section className={box}>
      <p className={kick}>{t("Your scores")}</p>
      <p className="mb-2 mt-1 text-[13px] text-[#4A5263]">{t("Changes are logged and shown to the editor.")}</p>
      <div className="flex flex-col gap-2">
        {criteria.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2">
            <span className="text-[13px]">{t(c.name)}</span>
            <ScoreButtons size={30} label={t(c.name)} value={d.scores[c.key]} onChange={(v) => { setMsg(null); setD({ ...d, scores: { ...d.scores, [c.key]: v } }); }} />
          </div>
        ))}
      </div>
      <p className="mb-1.5 mt-3 text-[13px] font-medium">{t("Recommendation")}</p>
      <Pills label={t("Recommendation")} options={RECS.slice(0, 5)} value={d.recommendation} onChange={(v) => { setMsg(null); setD({ ...d, recommendation: v }); }} />
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={!changed || pending} className="inline-flex h-9 items-center rounded-[4px] border-0 bg-[#0E1B3D] px-3 text-[14px] font-semibold text-white disabled:opacity-50"
          onClick={() => start(async () => { const r = await saveReview({ id, ...d, submit: false }); setMsg(r.error ? { error: r.error } : { ok: true }); })}>
          {t("Update my review")}
        </button>
        {msg?.ok ? <span role="status" className="text-[13px] text-[#14603F]">{t("Saved")}</span> : null}
      </div>
      {msg?.error ? <p role="alert" className="mb-0 mt-1.5 text-[13px] text-[#B3261E]">{t(msg.error)}</p> : null}
    </section>
  );
}
