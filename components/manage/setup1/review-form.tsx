"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { saveReviewSetup } from "@/lib/manage/setup1-actions";
import { slugKey, type Criterion } from "@/lib/manage/setup1-shared";
import { ui } from "@/components/manage/ui";
import { SaveBar } from "@/components/manage/save-bar";
import { LockTag, RadioCards, Rules, Stepper, Switch } from "@/components/manage/setup1/bits";
import type { ManageState } from "@/lib/manage/actions-util";

/* EM07 — blind type, numbers, review form (criteria), process switches, AI policy. Blind type + criteria lock at opening (K3). */

const BLIND = [
  { value: "double", title: "Double-blind", desc: "Authors and reviewers don't see each other (E6)" },
  { value: "single", title: "Single-blind", desc: "Reviewers see authors" },
  { value: "open", title: "Open", desc: "Everyone sees names" },
];
const AI = [
  { value: "language_only", title: "Language help only", desc: "Grammar and wording; no content" },
  { value: "allowed_with_declaration", title: "Allowed with declaration", desc: "Reviewers state how they used it" },
  { value: "not_allowed", title: "Not allowed", desc: "No AI tools on submitted papers" },
];

export type ReviewSettings = {
  blind_type: string; min_reviews: number; max_reviewers: number; ae_cap: number; invite_days: number; ai_policy: string; criteria: Criterion[];
  bidding: boolean; discussion: boolean; named_discussion: boolean; rebuttal: boolean; round2: boolean;
};

export function ReviewForm({ slug, s, status, last, canEdit, lockedForMe, locked }: {
  slug: string; s: ReviewSettings; status: "not_started" | "in_progress" | "ready"; last: { at: string | null; by: string | null }; canEdit: boolean; lockedForMe: boolean; locked: boolean;
}) {
  const t = useT();
  const [state, action] = useActionState<ManageState, FormData>(saveReviewSetup, {});
  const [criteria, setCriteria] = useState<Criterion[]>(s.criteria);
  const fe = state.fieldErrors ?? {};
  const lockedEdit = !canEdit || lockedForMe;
  const set = (i: number, p: Partial<Criterion>) => setCriteria((c) => c.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const lockNote = locked ? <p className={`mb-0 mt-3 ${ui.warn}`}>{lockedForMe ? t("Locked since submissions opened — only an owner can change this (K3).") : t("Locked for others since submissions opened. As owner you can still change it; everyone will be told (K3).")}</p> : null;

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="criteria" value={JSON.stringify(criteria)} />
      {lockedForMe ? <input type="hidden" name="blind_type" value={s.blind_type} /> : null}
      <div className="flex flex-col items-start gap-6 xl:flex-row">
        <div className="flex w-full min-w-0 flex-auto flex-col gap-5">
          <section className={ui.card}>
            <h2 className={ui.h2}>{t("Blind type")}<LockTag /></h2>
            <div className="mt-4"><RadioCards name="blind_type" options={BLIND} defaultValue={s.blind_type} disabled={lockedEdit} /></div>
            {fe.blind_type ? <p className="mb-0 mt-2 text-[13px] text-[#B3261E]">{t(fe.blind_type)}</p> : null}
            {lockNote}
          </section>

          <section className={ui.card}>
            <h2 className={ui.h2}>{t("Numbers")}</h2>
            <div className="mt-2">
              <Stepper name="min_reviews" label={t("Reviews needed for a decision")} hint={t("Minimum (E3, F2)")} defaultValue={s.min_reviews} min={1} max={6} disabled={!canEdit} error={fe.min_reviews} />
              <Stepper name="max_reviewers" label={t("Maximum reviewers per paper")} hint={t("Stops extra invitations")} defaultValue={s.max_reviewers} min={1} max={8} disabled={!canEdit} error={fe.max_reviewers} />
              <Stepper name="ae_cap" label={t("Papers per associate editor")} hint={t("Over this needs PC approval (E2)")} defaultValue={Math.min(40, Math.max(5, s.ae_cap))} min={5} max={40} disabled={!canEdit} error={fe.ae_cap} />
              <Stepper name="invite_days" label={t("Days to answer an invitation")} hint={t("Then it expires and the AE is told (E5)")} defaultValue={s.invite_days} min={1} max={14} disabled={!canEdit} error={fe.invite_days} />
            </div>
          </section>

          <section className={ui.card}>
            <h2 className={ui.h2}>{t("Review form")}<LockTag /></h2>
            <ul className="m-0 mt-3 list-none p-0">
              {criteria.map((c, i) => (
                <li key={i} className="flex flex-wrap items-start gap-2 border-b border-[#EEF0EC] py-3 last:border-0">
                  <div className="flex min-w-[220px] flex-auto flex-col gap-1.5">
                    <input aria-label={t("Criterion {n} name", { n: i + 1 })} value={c.name} disabled={lockedEdit} maxLength={60} onChange={(e) => set(i, { name: e.target.value })} className={`${ui.input} font-semibold`} />
                    <input aria-label={t("Criterion {n} help text", { n: i + 1 })} value={c.help} disabled={lockedEdit} maxLength={160} placeholder={t("A question that helps reviewers score")} onChange={(e) => set(i, { help: e.target.value })} className={`${ui.input} h-9 text-[14px]`} />
                  </div>
                  <span className="mt-2.5 rounded-[3px] bg-[#EEF0EC] px-2 py-0.5 font-mono text-[12px] text-[#4A5263]">1–5</span>
                  {!lockedEdit ? (
                    <span className="flex gap-1">
                      <button type="button" aria-label={t("Move up")} disabled={i === 0} onClick={() => setCriteria((cs) => { const n = [...cs]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} className="size-9 rounded-[4px] border border-[#B7BDC9] bg-white disabled:opacity-40">↑</button>
                      <button type="button" aria-label={t("Remove criterion")} disabled={criteria.length <= 1} onClick={() => setCriteria((cs) => cs.filter((_, j) => j !== i))} className="size-9 rounded-[4px] border border-[#B7BDC9] bg-white disabled:opacity-40">×</button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {fe.criteria ? <p className="mb-0 mt-2 text-[13px] text-[#B3261E]">{t(fe.criteria)}</p> : null}
            {!lockedEdit && criteria.length < 10 ? (
              <button type="button" onClick={() => setCriteria((cs) => [...cs, { key: slugKey(`criterion ${cs.length + 1}`), name: "", help: "" }])} className={`${ui.ghost} mt-3`}>{t("+ Add criterion")}</button>
            ) : null}
            <p className="mb-0 mt-4 text-[13px] text-[#4A5263]">{t("Recommendation: Accept · Weak accept · Borderline · Weak reject · Reject · Major revision")}</p>
          </section>

          <section className={ui.card}>
            <h2 className={ui.h2}>{t("Process")}</h2>
            <div className="mt-2">
              <Switch name="bidding" defaultChecked={s.bidding} disabled={!canEdit} label={t("Bidding")} hint={t("Reviewers bid on abstracts before assignment")} />
              <Switch name="discussion" defaultChecked={s.discussion} disabled={!canEdit} label={t("Discussion after all reviews are in")} hint={t("Reviewers can see and discuss each other's reviews (E7)")} />
              <Switch name="named_discussion" defaultChecked={s.named_discussion} disabled={!canEdit} label={t("Named discussion")} hint={t("Reviewers see each other's names inside the discussion (E8)")} />
              <Switch name="rebuttal" defaultChecked={s.rebuttal} disabled={!canEdit} label={t("Author rebuttal")} hint={t("Authors reply to reviews before the decision")} />
              <Switch name="round2" defaultChecked={s.round2} disabled={!canEdit} label={t("Round 2 for conditional accepts")} hint={t("Reviewers check the revision (RV09)")} />
            </div>
          </section>

          <section className={ui.card}>
            <h2 className={ui.h2}>{t("AI policy")}</h2>
            <div className="mt-4"><RadioCards name="ai_policy" options={AI} defaultValue={s.ai_policy} disabled={!canEdit} /></div>
            {fe.ai_policy ? <p className="mb-0 mt-2 text-[13px] text-[#B3261E]">{t(fe.ai_policy)}</p> : null}
          </section>
        </div>
        <Rules rules={[["E2", "AE load cap; over it needs PC approval."], ["E3", "Minimum reviews needed for a decision."], ["E5", "Unanswered invitations expire."], ["E6", "Double-blind hides identities everywhere."], ["E7", "Others' reviews only after your own."], ["E10", "Overdue reminders can't be turned off."], ["E12", "AI policy is per event."], ["K3", "Blind type and score scale lock at opening."]]} />
      </div>
      <SaveBar state={state} status={status} last={last} readOnly={!canEdit} />
    </form>
  );
}
