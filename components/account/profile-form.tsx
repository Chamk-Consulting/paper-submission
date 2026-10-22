"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { addConflict, deleteAffiliation, findPeople, removeConflict, saveAffiliation, saveProfile, type AccountState, type PersonHit } from "@/lib/account/actions";
import type { Affiliation, Conflict, Profile } from "@/lib/account/data";
import { searchOrganizations, type Org } from "@/lib/auth/onboarding-actions";
import { sx } from "@/components/account/styles";
import { FieldErr, ManualSaveBar, useDirty } from "@/components/account/save-bar";
import { IdentifiersSection, NameSection } from "@/components/account/profile-identity";

/* Canvas ST01 — Profile › About you. Topics and conflicts live on the Reviewing tab (reviewing-form.tsx). */

const small = "inline-flex h-8 items-center whitespace-nowrap rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60";
const link = "border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline hover:text-[#1F47A8] disabled:opacity-60";
const tagCls = "rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]";

export function ProfileForm({ p }: { p: Profile }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(saveProfile, {});
  const { dirty, onChange, onSubmit } = useDirty();
  const F = "pf";

  return (
    <div onChange={onChange} className="flex flex-col gap-[18px]">
      <NameSection p={p} state={state} form={F} onChange={onChange} />

      <IdentifiersSection p={p} state={state} form={F} />

      <Affiliations items={p.affiliations} />


      {/* The fields above belong to this form by id; the bar sits outside it so it stays pinned while you scroll. */}
      <form id={F} action={action} onSubmit={onSubmit} />
      <ManualSaveBar form={F} pending={pending} dirty={dirty} savedAt={state.savedAt}
        error={state.error ?? (state.fieldErrors && Object.keys(state.fieldErrors).length ? "Check the highlighted fields." : undefined)}
        note="Affiliations are saved as you add or edit them." />
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
              {a.ror_id ? <a href={a.ror_id} target="_blank" rel="noopener noreferrer" className={`${tagCls} ml-2 bg-[#E1F3EA] text-[#14603F] no-underline`} title={a.ror_id}>{t("ROR ✓")}</a> : null}
              {a.position_title || a.starts_on || a.ends_on ? (
                <span className="block text-[13px] text-[#4A5263]">
                  {[a.position_title, a.starts_on || a.ends_on ? `${yearOf(a.starts_on) || "…"} – ${a.ends_on ? yearOf(a.ends_on) : t("now")}` : null].filter(Boolean).join(" · ")}
                </span>
              ) : (
                <button type="button" className={`${link} block`} onClick={() => setEditing(a.id)}>{t("Add your role and years")}</button>
              )}
              {a.ror_id ? null : (
                <span className="mt-1 block text-[13px] text-[#7A4508]">{t("Not matched to the institutions list. Edit it and pick your institution from the suggestions, so conflict checks recognise it.")}</span>
              )}
            </span>
            <span className="flex flex-none items-center gap-2">
              <span className={`rounded-full px-2 py-px text-[12px] font-semibold ${a.ends_on ? "bg-[#EEF0EC] text-[#4A5263]" : "bg-[#E1F3EA] text-[#14603F]"}`}>{a.ends_on ? t("Past") : t("Current")}</span>
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
        <InstitutionPicker a={a} state={state} />
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

/** Institution with a search of the ROR registry; free text still allowed. Picking a result stores its ROR ID. */
function InstitutionPicker({ a, state }: { a: Affiliation | null; state: AccountState }) {
  const t = useT();
  const [name, setName] = useState(a?.institution ?? "");
  const [ror, setRor] = useState(a?.ror_id ?? "");
  const [hits, setHits] = useState<Org[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const type = (v: string) => {
    setName(v); setRor("");
    if (timer.current) clearTimeout(timer.current);
    const n = ++seq.current;
    timer.current = setTimeout(async () => {
      const r = v.trim().length >= 3 ? await searchOrganizations(v) : [];
      if (n === seq.current) { setHits(r.filter((o) => o.id)); setOpen(true); }
    }, 300);
  };
  return (
    <div className="relative">
      <label className={sx.label}>
        <span className="flex items-center gap-2">{t("Institution")}{ror ? <span className={`${tagCls} bg-[#E1F3EA] text-[#14603F]`} title={ror}>{t("ROR ✓")}</span> : null}</span>
        <input name="institution" value={name} onChange={(e) => type(e.target.value)} onBlur={() => setTimeout(() => setOpen(false), 150)} onFocus={() => hits.length && setOpen(true)}
          required autoFocus autoComplete="off" role="combobox" aria-expanded={open && hits.length > 0} aria-controls="aff-hits" aria-autocomplete="list" className={sx.input} />
      </label>
      <input type="hidden" name="ror_id" value={ror} />
      {open && hits.length ? (
        <ul id="aff-hits" role="listbox" className="absolute left-0 right-0 z-10 m-0 mt-1 max-h-[260px] list-none overflow-auto rounded-[6px] border border-[#DADDE3] bg-white p-0 shadow-[0_8px_24px_rgba(18,24,38,.12)]">
          {hits.map((o) => (
            <li key={o.id} role="option" aria-selected={ror === o.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setName(o.name); setRor(o.id ?? ""); setOpen(false); }}
                className="block w-full border-0 bg-transparent px-3 py-2 text-left text-[14px] hover:bg-[#F3F6FD]">
                <strong>{o.name}</strong> <span className="block text-[12px] text-[#4A5263]">{o.place}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <span className={sx.help}>{ror ? t("Matched in the ROR registry — used for conflict checks.") : t("Type to search the ROR registry, or keep your own wording.")}</span>
      <FieldErr state={state} name="institution" />
    </div>
  );
}

/* ---------------------------------------------------------------- conflicts */
export function Conflicts({ items }: { items: Conflict[] }) {
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
          <label className={sx.label}>{t("Email or Plenary ID")}
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
