"use client";

import Link from "@/components/site/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { saveReview } from "@/lib/review/actions";
import { CONFS, MIN_WORDS, RECS, countdown, fmtDateTime, type Criterion, type Rec, words } from "@/lib/review/shared";
import { Banner, Cols, asideLink, box, kick } from "@/components/review/parts";
import { Pills, ScoreButtons } from "@/components/review/controls";
import { useNow } from "@/components/review/use-now";
import { ui } from "@/components/manage/ui";

/** Default criteria texts, so venue defaults get translated. */
const CRITERIA_TEXT = [
  "Novelty", "Is the contribution new?", "Technical quality", "Are methods and proofs sound?", "Clarity", "Is it well written?", "Relevance", "Does it fit this venue?",
];
void CRITERIA_TEXT;

type Draft = { scores: Record<string, number>; recommendation: Rec | null; confidence: "low" | "medium" | "high" | null; to_authors: string; to_editor: string };

export type ReviewFormProps = {
  id: string; no: string; criteria: Criterion[]; initial: Draft; updatedAt: string | null;
  mode: "edit" | "submitted" | "readonly";
  readonlyReason: "locked" | "withdrawn" | "closed" | null;
  dueAt: string; serverNow: number; ae: string; aiPolicy: string; blind: string; submittedAt: string | null; withdrawnAt: string | null;
  notesInReview: number;
  /** RV03 annotated PDF block (server-rendered by the page). */
  annotation?: ReactNode;
};

type Save = { state: "idle" | "saving" | "saved" | "offline" | "error"; at?: string; error?: string };

export function ReviewForm(p: ReviewFormProps) {
  const t = useT();
  const router = useRouter();
  const { now, tz } = useNow(p.serverNow);
  const [d, setD] = useState<Draft>(p.initial);
  const [save, setSave] = useState<Save>(p.updatedAt ? { state: "saved", at: p.updatedAt } : { state: "idle" });
  const [tried, setTried] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const dirty = useRef(false);
  const latest = useRef(d);
  useEffect(() => { latest.current = d; }, [d]);

  const editable = p.mode !== "readonly";
  const autosave = p.mode === "edit";

  const doSave = useCallback(async (submit: boolean) => {
    const cur = latest.current;
    setSave((s) => ({ ...s, state: "saving" }));
    try {
      const r = await saveReview({ id: p.id, ...cur, submit });
      if (r.error) { setSave({ state: "error", error: r.error }); return r; }
      dirty.current = false;
      setSave({ state: "saved", at: r.savedAt });
      return r;
    } catch {
      setSave({ state: "offline" });
      return { error: "offline" };
    }
  }, [p.id]);

  // Autosave drafts 1.5s after the last change.
  useEffect(() => {
    if (!autosave || !dirty.current) return;
    const h = setTimeout(() => { void doSave(false); }, 1500);
    return () => clearTimeout(h);
  }, [d, autosave, doSave]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const set = (patch: Partial<Draft>) => { dirty.current = true; setD((x) => ({ ...x, ...patch })); };

  const n = words(d.to_authors);
  const scored = p.criteria.filter((c) => d.scores[c.key] >= 1).length;
  const missing: string[] = [];
  if (scored < p.criteria.length) missing.push(t("all scores"));
  if (!d.recommendation) missing.push(t("a recommendation"));
  if (!d.confidence) missing.push(t("confidence"));
  if (n < MIN_WORDS) missing.push(t("{n} more words", { n: MIN_WORDS - n }));

  const submit = () => {
    setTried(true);
    if (missing.length) return;
    startSubmit(async () => {
      const r = await doSave(p.mode === "edit");
      if (!r.error) router.push(`/reviews/${p.id}/submitted`);
    });
  };

  const left = countdown(p.dueAt, now);
  const overdueDays = Math.floor((now - new Date(p.dueAt).getTime()) / 864e5);
  const savedLabel = save.state === "saving" ? t("Saving…") : save.state === "saved" && save.at ? t("Draft saved {t}", { t: fmtDateTime(save.at, t.intl, tz) }) : save.state === "error" ? t("Not saved") : "";

  const main = (
    <>
      {p.readonlyReason === "withdrawn" ? (
        <Banner tone="info">{t("The authors withdrew this paper on {d}. Your review is cancelled — thank you for your time.", { d: fmtDateTime(p.withdrawnAt, t.intl, tz) })}</Banner>
      ) : p.readonlyReason === "locked" ? (
        <Banner tone="info">{t("Read-only — the decision has started. You submitted on {d}. To change something, ask {ae} to reopen your review.", { d: fmtDateTime(p.submittedAt, t.intl, tz), ae: p.ae })}</Banner>
      ) : p.readonlyReason === "closed" ? (
        <Banner tone="info">{t("This review is closed.")}</Banner>
      ) : p.mode === "edit" && overdueDays >= 0 && !left ? (
        <Banner tone="warn">
          {t("Overdue by {n} day(s). {ae} has been told. You can still submit — a late review is better than none.", { n: Math.max(1, overdueDays), ae: p.ae })}{" "}
          <Link href={`/reviews/${p.id}/extension`} className="font-semibold text-[#3B2A07]">{t("Ask for a short extension")}</Link>
        </Banner>
      ) : p.mode === "submitted" ? (
        <Banner tone="ok">{t("Submitted. You can still change your review until the editor starts the decision; changes are logged.")}</Banner>
      ) : null}
      {save.state === "offline" ? (
        <Banner tone="bad">
          {t("Not saved — you seem to be offline. Keep this tab open; we'll try again.")}{" "}
          <button type="button" onClick={() => void doSave(false)} className="border-0 bg-transparent p-0 font-semibold text-[#8C1D18] underline">{t("Retry")}</button>
        </Banner>
      ) : null}

      <section className={ui.card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={ui.h2}>{t("Scores")}</h2>
          <span className="text-[13px] text-[#4A5263]">{t("1 = poor · 5 = excellent. Authors see scores and comments, never your name.")}</span>
        </div>
        <div className="mt-3 flex flex-col">
          {p.criteria.map((c) => (
            <div key={c.key} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF0EC] py-3 first:border-t-0">
              <div className="min-w-[200px]">
                <div className="text-[15px] font-medium">{t(c.name)}</div>
                {c.help ? <div className="text-[13px] text-[#4A5263]">{t(c.help)}</div> : null}
              </div>
              <ScoreButtons label={t(c.name)} value={d.scores[c.key]} disabled={!editable} onChange={(v) => set({ scores: { ...d.scores, [c.key]: v } })} />
            </div>
          ))}
        </div>
      </section>

      <section className={ui.card}>
        <h2 className={ui.h2}>{t("Recommendation")}</h2>
        <div className="mt-3"><Pills label={t("Recommendation")} options={RECS} value={d.recommendation} disabled={!editable} onChange={(v) => set({ recommendation: v })} /></div>
        <p className="mb-1.5 mt-4 text-[14px] font-medium">{t("Your confidence")}</p>
        <Pills label={t("Your confidence")} options={CONFS} value={d.confidence} disabled={!editable} onChange={(v) => set({ confidence: v })} />
      </section>

      <section className={ui.card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={ui.h2}><label htmlFor="rv-authors">{t("Comments to the authors")}</label></h2>
          <span className={`font-mono text-[12px] ${n >= MIN_WORDS ? "text-[#14603F]" : "text-[#A8600F]"}`}>{t("{n} words · min 100", { n })}</span>
        </div>
        <p className="mb-2 mt-1 text-[13px] text-[#4A5263]">{t("Summary, strengths, weaknesses, and specific changes. Don't include your name.")}</p>
        <textarea id="rv-authors" value={d.to_authors} readOnly={!editable} onChange={(e) => set({ to_authors: e.target.value })} rows={14} maxLength={30000}
          className={`${ui.textarea} w-full`} />
        {p.notesInReview ? <p className="mb-0 mt-1.5 text-[13px] text-[#4A5263]">{t("{n} notes from the viewer are marked for the review.", { n: p.notesInReview })} <Link href={`/reviews/${p.id}/paper`} className="text-[#2F5FD0]">{t("Open notes")}</Link></p> : null}
        <label htmlFor="rv-editor" className="mt-5 block text-[15px] font-medium">{t("Confidential comments to the editor (authors never see these)")}</label>
        <textarea id="rv-editor" value={d.to_editor} readOnly={!editable} onChange={(e) => set({ to_editor: e.target.value })} rows={5} maxLength={10000}
          className={`${ui.textarea} mt-1.5 w-full`} />
        {p.annotation}
      </section>

      {editable ? (
        <div className="flex flex-wrap items-center gap-3">
          {p.mode === "edit" ? (
            <button type="button" onClick={async () => { const r = await doSave(false); if (!r.error) router.push("/reviews"); }} className={ui.ghost}>{t("Save and close")}</button>
          ) : null}
          <button type="button" onClick={submit} disabled={submitting} className={ui.primary}>{p.mode === "edit" ? t("Submit review") : t("Save changes")}</button>
          <span role="status" className="text-[13px] text-[#4A5263]">{savedLabel}</span>
          {tried && missing.length ? <p role="alert" className="m-0 w-full text-[14px] text-[#B3261E]">{t("Still needed:")} {missing.join(", ")}.</p> : null}
          {save.state === "error" && save.error ? <p role="alert" className="m-0 w-full text-[14px] text-[#B3261E]">{t(save.error)}</p> : null}
        </div>
      ) : null}
    </>
  );

  const check = (ok: boolean, label: string) => (
    <li className="flex items-center gap-2 text-[14px]">
      <span aria-hidden className={`flex size-4 items-center justify-center rounded-[3px] text-[11px] ${ok ? "bg-[#18744F] text-white" : "border border-[#8A93A6] bg-white"}`}>{ok ? "✓" : ""}</span>
      <span className={ok ? "text-[#121826]" : "text-[#4A5263]"}>{label}</span>
    </li>
  );

  const aside = (
    <>
      <section className={box}>
        <p className={kick}>{t("Due")}</p>
        <div className={`mt-1 font-serif text-[28px] leading-none ${left ? "" : "text-[#B3261E]"}`}>{left ?? t("Overdue")}</div>
        <p className="mb-0 mt-1.5 text-[13px] text-[#4A5263]">{fmtDateTime(p.dueAt, t.intl, "Etc/GMT+12")} AoE · {fmtDateTime(p.dueAt, t.intl, tz)} {t("your time")}</p>
        {p.mode === "edit" ? <Link href={`/reviews/${p.id}/extension`} className="mt-2 block text-[14px] text-[#2F5FD0] no-underline hover:underline">{t("Need more time? →")}</Link> : null}
      </section>
      <section className={box}>
        <p className={kick}>{t("Checklist")}</p>
        <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
          {check(scored === p.criteria.length, t("All {n} scores", { n: p.criteria.length }))}
          {check(!!d.recommendation, t("Recommendation"))}
          {check(!!d.confidence, t("Confidence"))}
          {check(n >= MIN_WORDS, t("At least 100 words to authors"))}
        </ul>
      </section>
      <section className={box}>
        <p className={kick}>{t("Paper")}</p>
        <Link href={`/reviews/${p.id}/paper`} className={asideLink}>{t("Open in reviewer viewer")}</Link>
        <Link href={`/reviews/${p.id}/paper?tab=ask`} className={asideLink}>{t("Ask about the paper")}</Link>
      </section>
      <section className={box}>
        <p className={kick}>{t("Rules")}</p>
        <p className="mb-0 mt-1.5 text-[13px] leading-[1.55] text-[#4A5263]">
          {p.blind === "double" ? `${t("Double-blind: don't look up the authors.")} ` : ""}
          {t("Don't share the paper or use it before it is published.")}{" "}
          {p.aiPolicy === "not_allowed" ? t("Don't use AI tools on this paper.") : p.aiPolicy === "allowed_with_declaration" ? t("AI tools are allowed if you say how you used them in the confidential comments.") : t("AI tools may help with language only; your judgement must be your own.")}
        </p>
      </section>
    </>
  );

  return <Cols main={main} aside={aside} />;
}
