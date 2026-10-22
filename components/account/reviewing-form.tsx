"use client";

import { X } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { saveReviewing, type AccountState } from "@/lib/account/actions";
import { saveAvailability, type ActionState } from "@/lib/review/actions";
import type { Profile } from "@/lib/account/data";
import { sx } from "@/components/account/styles";
import { AccountSaveBar, FieldErr, useDirty } from "@/components/account/save-bar";
import { Conflicts } from "@/components/account/profile-form";

/* Profile › Reviewing tab: topics you can review, languages you review in, how busy you are, conflicts.
   All optional for people who only submit papers. */

const MAX = 10;
const LANGS = ["en", "fr", "ar", "es", "de", "it", "pt", "zh", "ja", "ru", "tr", "ko"];
const chip = "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px]";

export function ReviewingForm({ p, suggestions }: { p: Profile; suggestions: { group: string; keywords: string[] }[] }) {
  const t = useT();
  const [state, action] = useActionState<AccountState, FormData>(saveReviewing, {});
  const { dirty, onChange, onSubmit } = useDirty();
  const [topics, setTopics] = useState<string[]>(p.topics);
  const [langs, setLangs] = useState<string[]>(p.review_languages);
  const [q, setQ] = useState("");
  const names = useMemo(() => { try { return new Intl.DisplayNames([t.intl], { type: "language" }); } catch { return null; } }, [t.intl]);
  const langName = (c: string) => names?.of(c) ?? c;

  const full = topics.length >= MAX;
  const add = (x: string) => {
    const v = x.trim().replace(/\s+/g, " ");
    if (v.length < 2 || full || topics.some((y) => y.toLowerCase() === v.toLowerCase())) return;
    setTopics([...topics, v]); setQ(""); onChange();
  };
  const remove = (x: string) => { setTopics(topics.filter((y) => y !== x)); onChange(); };
  const all = [...new Set(suggestions.flatMap((g) => g.keywords))];
  const matches = q.trim().length >= 2 ? all.filter((k) => k.toLowerCase().includes(q.trim().toLowerCase()) && !topics.includes(k)).slice(0, 8) : [];
  const needle = q.trim().toLowerCase();
  const chosen = needle.length >= 2 ? topics.filter((k) => k.toLowerCase().includes(needle)) : [];
  const exact = all.some((k) => k.toLowerCase() === needle) || topics.some((k) => k.toLowerCase() === needle);

  return (
    <form id="rv" action={action} onSubmit={onSubmit} className="flex flex-col gap-[18px]">
      <section className={sx.card} aria-labelledby="rv-topics">
        <h2 id="rv-topics" className={sx.h2}>{t("Topics you can review")}</h2>
        <p className={sx.sub + " text-[13px]"}>{t("Optional if you don’t review. Pick 3–10 so editors can invite you to papers that match.")}</p>

        <div className="mt-3.5 flex min-h-8 flex-wrap gap-1.5" aria-live="polite">
          {topics.length ? topics.map((x) => (
            <span key={x} className={`${chip} border-[#0E1B3D] bg-[#0E1B3D] font-semibold text-[#F5F6F3]`}>
              {t(x)}
              <button type="button" onClick={() => remove(x)} aria-label={t("Remove {name}", { name: t(x) })} className="-me-1 flex size-5 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[#D6DCEA] hover:bg-white/15 hover:text-white">
                <X size={13} strokeWidth={2.5} aria-hidden />
              </button>
            </span>
          )) : <span className="text-[13px] text-[#4A5263]">{t("No topics yet.")}</span>}
        </div>
        {topics.map((x) => <input key={x} type="hidden" name="topics" value={x} />)}

        <div className="relative mt-3 max-w-[460px]">
          <label htmlFor="rv-q" className="sr-only">{t("Search or add a topic")}</label>
          <input id="rv-q" value={q} disabled={full} onChange={(e) => setQ(e.target.value)} autoComplete="off"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (matches[0]) add(matches[0]); else if (!exact && !chosen.length) add(q); } }}
            placeholder={full ? t("10 topics chosen — remove one to add another") : t("Search or add a topic")} className={`${sx.input} disabled:bg-[#F7F8F6]`} />
          {q.trim().length >= 2 ? (
            <div className="absolute inset-x-0 top-[46px] z-10 rounded-[8px] border border-[#DADDE3] bg-white p-1.5 shadow-[0_12px_32px_rgba(18,24,38,.14)]">
              {matches.map((k) => (
                <button key={k} type="button" onClick={() => add(k)} className="flex h-9 w-full cursor-pointer items-center rounded-[6px] border-0 bg-transparent px-2.5 text-start text-[14px] hover:bg-[#F5F6F3]">{t(k)}</button>
              ))}
              {chosen.map((k) => (
                <span key={k} className="flex h-9 items-center gap-2 px-2.5 text-[14px] text-[#4A5263]"><span aria-hidden className="text-[#14603F]">✓</span>{t("{topic} — already added", { topic: t(k) })}</span>
              ))}
              {!exact ? (
                <button type="button" onClick={() => add(q)} className="flex h-9 w-full cursor-pointer items-center rounded-[6px] border-0 bg-transparent px-2.5 text-start text-[14px] text-[#2F5FD0] hover:bg-[#F5F6F3]">
                  {t("Add “{topic}”", { topic: q.trim() })}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {suggestions.map((g) => {
          const left = g.keywords.filter((k) => !topics.includes(k));
          return left.length ? (
            <div key={g.group} className="mt-3.5">
              <p className="m-0 text-[13px] text-[#4A5263]">{t("Suggested from {source}", { source: t(g.group) })}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {left.map((k) => (
                  <button key={k} type="button" disabled={full} onClick={() => add(k)} className={`${chip} cursor-pointer border-[#DADDE3] bg-white text-[#121826] hover:border-[#B7BDC9] hover:bg-[#F7F8F6] disabled:cursor-default disabled:opacity-50`}>{t(k)}</button>
                ))}
              </div>
            </div>
          ) : null;
        })}
        <p className="mb-0 mt-3 text-[13px] text-[#4A5263]">{t("{n} of {max} chosen", { n: topics.length, max: MAX })}</p>
        <FieldErr state={state} name="topics" />
      </section>

      <section className={sx.card} aria-labelledby="rv-langs">
        <h2 id="rv-langs" className={sx.h2}>{t("Languages you can review in")}</h2>
        <p className={sx.sub + " text-[13px]"}>{t("Chairs use this for papers written in other languages.")}</p>
        <div className="mt-3.5 flex flex-wrap gap-1.5" role="group" aria-label={t("Languages you can review in")}>
          {LANGS.map((c) => {
            const on = langs.includes(c);
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => { setLangs(on ? langs.filter((x) => x !== c) : [...langs, c]); onChange(); }}
                className={`${chip} cursor-pointer ${on ? "border-[#0E1B3D] bg-[#0E1B3D] font-semibold text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#121826] hover:border-[#B7BDC9]"}`}>
                {on ? <span aria-hidden>✓</span> : null}{langName(c)}
              </button>
            );
          })}
        </div>
        {langs.map((c) => <input key={c} type="hidden" name="languages" value={c} />)}
        <FieldErr state={state} name="languages" />
      </section>

      <AccountSaveBar state={state} dirty={dirty} />
    </form>
  );
}

/** "How busy are you?" — the same setting as on the Reviews page; editors see it before inviting you. */
export function BusyCard({ initial }: { initial: { availability: "normal" | "low" | "off"; available_from: string | null } }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAvailability, {});
  const [v, setV] = useState(initial.availability);
  const [from, setFrom] = useState(initial.available_from ?? "");
  const opts: ["normal" | "low" | "off", string][] = [
    ["normal", t("Available — up to 4 papers a month")],
    ["low", t("Busy — 1 paper a month")],
    ["off", t("Not reviewing until")],
  ];
  return (
    <section className={sx.card} aria-labelledby="rv-busy">
      <h2 id="rv-busy" className={sx.h2}>{t("How busy are you?")}</h2>
      <p className={sx.sub + " text-[13px]"}>{t("Editors see this before they invite you.")}</p>
      <form action={action} className="mt-3.5">
        <fieldset className="m-0 flex max-w-[460px] flex-col gap-1.5 border-0 p-0">
          <legend className="sr-only">{t("How busy are you?")}</legend>
          {opts.map(([k, l]) => (
            <label key={k} className={`flex cursor-pointer flex-wrap items-center gap-2 rounded-[6px] border px-3 py-2 text-[14px] ${v === k ? "border-[#2F5FD0] bg-[#FBFCFF]" : "border-[#DADDE3]"}`}>
              <input type="radio" name="availability" value={k} checked={v === k} onChange={() => setV(k)} className="accent-[#2F5FD0]" />
              <span>{l}</span>
              {k === "off" && v === "off" ? (
                <input type="date" name="available_from" aria-label={t("Not reviewing until")} required value={from} onChange={(e) => setFrom(e.target.value)}
                  className="h-8 rounded-[4px] border border-[#B7BDC9] px-2 text-[13px]" />
              ) : null}
            </label>
          ))}
        </fieldset>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={pending} className="inline-flex h-9 cursor-pointer items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60">
            {pending ? t("Saving…") : t("Save")}
          </button>
          <span role="status" className={`text-[13px] ${state.error ? "text-[#B3261E]" : "text-[#14603F]"}`}>{state.error ? t(state.error) : state.ok ? t("Saved") : ""}</span>
        </div>
      </form>
    </section>
  );
}

export { Conflicts };
