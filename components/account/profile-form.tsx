"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { addConflict, deleteAffiliation, findPeople, removeConflict, saveAffiliation, saveProfile, type AccountState, type PersonHit } from "@/lib/account/actions";
import type { Affiliation, Conflict, Profile } from "@/lib/account/data";
import { sx } from "@/components/account/styles";
import { AccountSaveBar, FieldErr, useDirty } from "@/components/account/save-bar";

/* Canvas ST01 — Profile & expertise. */

const TOPICS = ["Adaptive control", "Marine systems", "Nonlinear control", "Optimal control", "Robust control", "Networked control", "Estimation", "Learning-based control", "Multi-agent systems", "Autonomous vehicles", "Model predictive control", "Robotics"];
const small = "inline-flex h-8 items-center whitespace-nowrap rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60";
const link = "border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline hover:text-[#1F47A8] disabled:opacity-60";
const tagCls = "rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]";

export function ProfileForm({ p }: { p: Profile }) {
  const t = useT();
  const [state, action] = useActionState<AccountState, FormData>(saveProfile, {});
  const { dirty, onChange, onSubmit } = useDirty();
  const [topics, setTopics] = useState<string[]>(p.topics);
  const all = [...TOPICS, ...p.topics.filter((x) => !TOPICS.includes(x))];
  const F = "pf";

  return (
    <div onChange={onChange} className="flex flex-col gap-[18px]">
      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Name")}</h2>
        <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
          <label className={sx.label}>{t("First name")}<input form={F} name="given_name" defaultValue={p.given_name} autoComplete="given-name" required className={sx.input} /><FieldErr state={state} name="given_name" /></label>
          <label className={sx.label}>{t("Last name")}<input form={F} name="family_name" defaultValue={p.family_name} autoComplete="family-name" required className={sx.input} /><FieldErr state={state} name="family_name" /></label>
          <label className={sx.label}>{t("Name in another script")}<input form={F} name="name_script" defaultValue={p.name_script} className={sx.input} />
            <span className={sx.help}>{t("Shown next to your Latin name in programs. Any script — Arabic, Chinese, Cyrillic…")}</span></label>
          <label className={sx.label}><span>{t("Pronouns")} <span className="font-normal text-[#4A5263]">{t("(optional)")}</span></span><input form={F} name="pronouns" defaultValue={p.pronouns} className={sx.input} /></label>
        </div>
      </section>

      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Identifiers")}</h2>
        <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
          <div>
            <div className="text-[14px] font-medium">{t("Plenary ID")}</div>
            <div className="mt-1.5 font-mono text-[18px]">{p.plenary_id ?? "—"}</div>
          </div>
          <div>
            <div className="text-[14px] font-medium">{t("ORCID")}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {p.orcid ? (<><span className="font-mono text-[14px]">{p.orcid}</span><span className={`${tagCls} bg-[#E1F3EA] text-[#14603F]`}>{t("VERIFIED")}</span></>)
                : <span className="text-[14px] text-[#4A5263]">{t("Not connected")}</span>}
              <span className={`${tagCls} bg-[#EEF0EC] text-[#4A5263]`} title={t("Coming soon")}>{t("Connect · coming soon")}</span>
            </div>
          </div>
          <label className={sx.label}><span>{t("IEEE member number")} <span className="font-normal text-[#4A5263]">{t("(optional)")}</span></span>
            <input form={F} name="ieee_member" defaultValue={p.ieee_member} inputMode="numeric" className={`${sx.input} font-mono text-[14px]`} />
            <span className={sx.help}>{t("Used for registration discounts and copyright.")}</span><FieldErr state={state} name="ieee_member" /></label>
          <label className={sx.label}><span>{t("Google Scholar")} <span className="font-normal text-[#4A5263]">{t("(optional)")}</span></span>
            <input form={F} name="scholar_url" type="url" defaultValue={p.scholar_url} placeholder="https://scholar.google.com/citations?user=…" className={sx.input} /><FieldErr state={state} name="scholar_url" /></label>
        </div>
      </section>

      <Affiliations items={p.affiliations} />

      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Review topics")}</h2>
        <p className={sx.sub + " text-[13px]"}>{t("From the IEEE Control Systems Society keyword list.")}</p>
        <div className="mt-3.5 flex flex-wrap gap-1.5" role="group" aria-label={t("Review topics")}>
          {all.map((x) => {
            const on = topics.includes(x);
            return (
              <button key={x} type="button" aria-pressed={on} onClick={() => { setTopics(on ? topics.filter((y) => y !== x) : [...topics, x]); onChange(); }}
                className={`h-8 rounded-full border px-3 text-[13px] font-semibold ${on ? "border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#4A5263] hover:border-[#B7BDC9]"}`}>
                <span aria-hidden>{on ? "✓" : "+"}</span> {t(x)}
              </button>
            );
          })}
        </div>
        {topics.map((x) => <input key={x} form={F} type="hidden" name="topics" value={x} />)}
        <p className={`mb-0 mt-2.5 text-[13px] ${topics.length < 3 || topics.length > 10 ? "text-[#A8600F]" : "text-[#4A5263]"}`}>
          {t("{n} selected · pick 3–10. Editors invite you to papers with matching keywords.", { n: topics.length })}
        </p>
        <FieldErr state={state} name="topics" />
      </section>

      <Conflicts items={p.conflicts} />

      <form id={F} action={action} onSubmit={onSubmit}>
        <AccountSaveBar state={state} dirty={dirty} />
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- affiliations */
function yearOf(d: string | null) { return d ? d.slice(0, 4) : ""; }

function Affiliations({ items }: { items: Affiliation[] }) {
  const t = useT();
  const [editing, setEditing] = useState<string | null>(null); // id, "new" or null
  return (
    <section className={sx.card}>
      <h2 className={sx.h2}>{t("Affiliations")}</h2>
      <p className={sx.sub + " text-[13px]"}>{t("Your current and past affiliations are used for conflict-of-interest checks.")}</p>
      <div className="mt-3.5">
        {items.length === 0 && editing !== "new" ? <p className="m-0 border-t border-[#EEF0EC] py-2.5 text-[14px] text-[#4A5263]">{t("No affiliations yet.")}</p> : null}
        {items.map((a) => editing === a.id ? <AffEditor key={a.id} a={a} onDone={() => setEditing(null)} /> : (
          <div key={a.id} className="flex items-center justify-between gap-3 border-t border-[#EEF0EC] py-2.5">
            <span className="min-w-0">
              <strong className="text-[14px]">{[a.institution, a.department].filter(Boolean).join(", ")}</strong>
              <span className="block text-[13px] text-[#4A5263]">
                {[a.position_title, a.starts_on || a.ends_on ? `${yearOf(a.starts_on) || "…"} – ${a.ends_on ? yearOf(a.ends_on) : t("now")}` : null].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="flex flex-none items-center gap-2">
              <span className={`${tagCls} ${a.ends_on ? "bg-[#EEF0EC] text-[#4A5263]" : "bg-[#E1F3EA] text-[#14603F]"}`}>{a.ends_on ? t("PAST") : t("CURRENT")}</span>
              <button type="button" className={link} onClick={() => setEditing(a.id)}>{t("Edit")}<span className="sr-only"> {a.institution}</span></button>
            </span>
          </div>
        ))}
        {editing === "new" ? <AffEditor a={null} onDone={() => setEditing(null)} /> : (
          <button type="button" className={`${small} mt-2`} onClick={() => setEditing("new")}>{t("+ Add affiliation")}</button>
        )}
      </div>
    </section>
  );
}

function AffEditor({ a, onDone }: { a: Affiliation | null; onDone: () => void }) {
  const t = useT();
  const [state, action, pending] = useActionState<AccountState, FormData>(async (prev, fd) => {
    const r = await saveAffiliation(prev, fd);
    if (r.ok) onDone();
    return r;
  }, {});
  const [removing, startRemove] = useTransition();
  const [current, setCurrent] = useState(a ? !a.ends_on : true);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form action={action} className="flex flex-col gap-3 border-t border-[#EEF0EC] py-3.5">
      <input type="hidden" name="id" value={a?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={sx.label}>{t("Institution")}<input name="institution" defaultValue={a?.institution ?? ""} required autoFocus className={sx.input} /><FieldErr state={state} name="institution" /></label>
        <label className={sx.label}>{t("Department")} <input name="department" defaultValue={a?.department ?? ""} className={sx.input} /></label>
        <label className={sx.label}>{t("Role")}<input name="position_title" defaultValue={a?.position_title ?? ""} placeholder={t("e.g. Senior lecturer")} className={sx.input} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className={sx.label}>{t("From (year)")}<input name="from" inputMode="numeric" pattern="\d{4}" defaultValue={yearOf(a?.starts_on ?? null)} className={sx.input} /></label>
          <label className={sx.label}>{t("To (year)")}<input name="to" inputMode="numeric" pattern="\d{4}" disabled={current} defaultValue={yearOf(a?.ends_on ?? null)} className={`${sx.input} disabled:bg-[#F7F8F6]`} /><FieldErr state={state} name="to" /></label>
        </div>
      </div>
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="current" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="size-4 accent-[#0E1B3D]" />{t("I work here now")}</label>
      {state.error || err ? <p role="alert" className="m-0 text-[13px] text-[#B3261E]">{t(state.error ?? err ?? "")}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className="inline-flex h-9 items-center rounded-[4px] border-0 bg-[#0E1B3D] px-3.5 text-[14px] font-semibold text-white disabled:opacity-60">{pending ? t("Saving…") : t("Save affiliation")}</button>
        <button type="button" onClick={onDone} className={small + " h-9"}>{t("Cancel")}</button>
        {a ? (
          <button type="button" disabled={removing} className={`${link} ml-auto text-[#B3261E]!`} onClick={() => startRemove(async () => { const r = await deleteAffiliation(a.id); if (r.error) setErr(r.error); else onDone(); })}>{t("Remove")}</button>
        ) : null}
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- conflicts */
function Conflicts({ items }: { items: Conflict[] }) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <section className={sx.card}>
      <h2 className={sx.h2}>{t("Conflicts of interest")}</h2>
      <p className={sx.sub + " text-[13px]"}>{t("People you can't review for, or who can't review your papers. Used on every submission.")}</p>
      <div className="mt-3.5">
        {items.length === 0 && !adding ? <p className="m-0 border-t border-[#EEF0EC] py-2 text-[14px] text-[#4A5263]">{t("None declared. Co-authors and your institutions are checked automatically.")}</p> : null}
        {items.map((c) => (
          <div key={c.id} className="flex justify-between gap-3 border-t border-[#EEF0EC] py-2 text-[14px]">
            <span><strong>{c.other_name ?? c.institution ?? "—"}</strong> <span className="text-[#4A5263]">· {c.reason}{c.until_year ? ` · ${t("until {year}", { year: c.until_year })}` : ""}</span></span>
            <button type="button" disabled={pending} className={link} onClick={() => start(async () => { const r = await removeConflict(c.id); setErr(r.error ?? null); })}>{t("Remove")}<span className="sr-only"> {c.other_name ?? c.institution}</span></button>
          </div>
        ))}
        {err ? <p role="alert" className="m-0 text-[13px] text-[#B3261E]">{t(err)}</p> : null}
        {adding ? <ConflictEditor onDone={() => setAdding(false)} /> : (
          <button type="button" className={`${small} mt-2`} onClick={() => setAdding(true)}>{t("+ Add person or institution")}</button>
        )}
      </div>
    </section>
  );
}

function ConflictEditor({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<"person" | "institution">("person");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [pick, setPick] = useState<PersonHit | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, action, pending] = useActionState<AccountState, FormData>(async (prev, fd) => {
    const r = await addConflict(prev, fd);
    if (r.ok) onDone();
    return r;
  }, {});
  const search = (v: string) => {
    setQ(v); setPick(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => setHits(v.trim().length >= 3 ? await findPeople(v) : []), 250);
  };
  const tab = (on: boolean) => `h-8 rounded-full border px-3 text-[13px] font-semibold ${on ? "border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#4A5263]"}`;
  return (
    <form action={action} className="flex flex-col gap-3 border-t border-[#EEF0EC] py-3.5">
      <div className="flex gap-1.5" role="group" aria-label={t("Conflict with")}>
        <button type="button" aria-pressed={mode === "person"} className={tab(mode === "person")} onClick={() => setMode("person")}>{t("A person")}</button>
        <button type="button" aria-pressed={mode === "institution"} className={tab(mode === "institution")} onClick={() => { setMode("institution"); setPick(null); }}>{t("An institution")}</button>
      </div>
      {mode === "person" ? (
        <div className="relative">
          <label className={sx.label}>{t("Name, email or Plenary ID")}
            <input value={pick ? pick.display_name : q} onChange={(e) => search(e.target.value)} autoComplete="off" role="combobox" aria-expanded={!pick && hits.length > 0} aria-controls="coi-hits" className={sx.input} />
          </label>
          <input type="hidden" name="other_person" value={pick?.person_id ?? ""} />
          {!pick && hits.length ? (
            <ul id="coi-hits" role="listbox" className="absolute left-0 right-0 z-10 m-0 mt-1 list-none overflow-hidden rounded-[6px] border border-[#DADDE3] bg-white p-0 shadow-[0_8px_24px_rgba(18,24,38,.12)]">
              {hits.map((h) => (
                <li key={h.person_id} role="option" aria-selected={false}>
                  <button type="button" onClick={() => { setPick(h); setHits([]); }} className="block w-full border-0 bg-transparent px-3 py-2 text-left text-[14px] hover:bg-[#F3F6FD]">
                    <strong>{h.display_name}</strong> <span className="text-[#4A5263]">{[h.institution, h.plenary_id].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {!pick && q.trim().length >= 3 && !hits.length ? <span className={sx.help}>{t("No match yet. Try their exact email or Plenary ID.")}</span> : null}
        </div>
      ) : (
        <label className={sx.label}>{t("Institution")}<input name="institution" className={sx.input} /></label>
      )}
      {mode === "person" ? <input type="hidden" name="institution" value="" /> : <input type="hidden" name="other_person" value="" />}
      <FieldErr state={state} name="institution" />
      <label className={sx.label}>{t("Why")}<input name="reason" required placeholder={t("e.g. PhD supervisor, co-author in last 3 years")} className={sx.input} /><FieldErr state={state} name="reason" /></label>
      {state.error ? <p role="alert" className="m-0 text-[13px] text-[#B3261E]">{t(state.error)}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending || (mode === "person" && !pick)} className="inline-flex h-9 items-center rounded-[4px] border-0 bg-[#0E1B3D] px-3.5 text-[14px] font-semibold text-white disabled:opacity-60">{pending ? t("Saving…") : t("Add conflict")}</button>
        <button type="button" onClick={onDone} className={small + " h-9"}>{t("Cancel")}</button>
      </div>
    </form>
  );
}
