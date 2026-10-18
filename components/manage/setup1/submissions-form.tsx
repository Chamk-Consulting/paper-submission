"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { deleteType, saveSubmissionSettings, saveType, toggleType } from "@/lib/manage/setup1-actions";
import { FORM_FIELDS, PDF_RULES, type CustomQuestion } from "@/lib/manage/setup1-shared";
import { ui } from "@/components/manage/ui";
import { SaveBar } from "@/components/manage/save-bar";
import { LockTag, Rules, Switch } from "@/components/manage/setup1/bits";
import type { ManageState } from "@/lib/manage/actions-util";

/* EM05 — submission types (own small forms), then one form for fields, questions, PDF rules and the per-author cap. */

export type SubType = {
  id: string; name: string; description: string | null; pages: number; extra_pages: number; extra_page_fee: number | null;
  revision_pages: number | null; deadline: string | null; blind_override: string | null; enabled: boolean; inUse: boolean;
};
type Settings = { form_fields: Record<string, string>; custom_questions: CustomQuestion[]; pdf_rules: Record<string, boolean>; max_papers: number | null; keyword_list: string };
const ALWAYS = new Set(["title", "abstract", "authors"]);

function TypeEditor({ slug, type, onDone }: { slug: string; type: SubType | null; onDone: () => void }) {
  const t = useT();
  const [state, action, pending] = useActionState<ManageState, FormData>(saveType, {});
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => { if (state.ok) done.current(); }, [state]);
  const fe = (k: string) => (state.fieldErrors?.[k] ? <span className="text-[13px] font-normal text-[#B3261E]">{t(state.fieldErrors[k])}</span> : null);
  return (
    <form action={action} className="mt-4 rounded-[8px] border border-[#DADDE3] bg-[#F7F8F6] p-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={type?.id ?? ""} />
      <p className="m-0 mb-3 text-[15px] font-semibold">{type ? t("Edit {name}", { name: type.name }) : t("New submission type")}</p>
      {state.error ? <p role="alert" className={`m-0 mb-3 ${ui.bad}`}>{t(state.error)}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ui.label}>{t("Name")}<input name="name" required defaultValue={type?.name} placeholder={t("Regular paper")} className={ui.input} />{fe("name")}</label>
        <label className={ui.label}>{t("Short description")}<input name="description" defaultValue={type?.description ?? ""} maxLength={200} className={ui.input} /></label>
        <label className={ui.label}>{t("Pages")}<input name="pages" type="number" min={1} max={60} required defaultValue={type?.pages ?? 6} className={ui.input} />{fe("pages")}</label>
        <label className={ui.label}>{t("Extra pages allowed")}<input name="extra_pages" type="number" min={0} max={20} defaultValue={type?.extra_pages ?? 0} className={ui.input} />{fe("extra_pages")}</label>
        <label className={ui.label}>{t("Fee per extra page")}<input name="extra_page_fee" type="number" min={0} defaultValue={type?.extra_page_fee ?? ""} className={ui.input} /></label>
        <label className={ui.label}>{t("Pages for the revision")}<input name="revision_pages" type="number" min={1} max={80} defaultValue={type?.revision_pages ?? ""} className={ui.input} /></label>
        <label className={ui.label}>{t("Own deadline (AoE)")}<input name="deadline" type="date" defaultValue={type?.deadline ?? ""} className={ui.input} /><span className={ui.hint}>{t("Empty = the paper deadline")}</span></label>
        <label className={ui.label}>{t("Blind type")}
          <select name="blind_override" defaultValue={type?.blind_override ?? ""} className={ui.input}>
            <option value="">{t("Same as the event")}</option><option value="double">{t("Double-blind")}</option><option value="single">{t("Single-blind")}</option><option value="open">{t("Open")}</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onDone} className={ui.ghost}>{t("Cancel")}</button>
        <button type="submit" disabled={pending} className={ui.navy}>{pending ? t("Saving…") : type ? t("Save type") : t("Add type")}</button>
      </div>
    </form>
  );
}

function TypesCard({ slug, types, canEdit, locked }: { slug: string; types: SubType[]; canEdit: boolean; locked: boolean }) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState<SubType | "new" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (p: Promise<ManageState>) => start(async () => { const r = await p; setMsg(r.error ?? null); router.refresh(); });
  return (
    <section className={ui.card}>
      <h2 className={ui.h2}>{t("Submission types")}<LockTag /></h2>
      <p className="mb-0 mt-1 text-[14px] text-[#4A5263]">{t("Each type has its own limits, fees and deadline (D2).")}</p>
      {msg ? <p role="alert" className={`mb-0 mt-3 ${ui.bad}`}>{t(msg)}</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className={ui.table} aria-busy={pending}>
          <thead><tr><th className={ui.th}>{t("Type")}</th><th className={ui.th}>{t("Pages")}</th><th className={`${ui.th} hidden sm:table-cell`}>{t("Extra pages")}</th><th className={`${ui.th} hidden md:table-cell`}>{t("Deadline")}</th><th className={ui.th}>{t("On")}</th><th className={ui.th}><span className="sr-only">{t("Actions")}</span></th></tr></thead>
          <tbody>
            {types.map((x) => (
              <tr key={x.id} className={x.enabled ? undefined : "text-[#4A5263]"}>
                <td className={ui.td}><strong>{x.name}</strong>{x.inUse && locked ? <span className="ml-1.5" title={t("In use — locked (K3)")}>🔒</span> : null}{x.description ? <span className="block text-[13px] text-[#4A5263]">{x.description}</span> : null}</td>
                <td className={ui.td}>{x.pages}</td>
                <td className={`${ui.td} hidden sm:table-cell`}>{x.extra_pages ? `+${x.extra_pages}${x.extra_page_fee != null ? ` · ${x.extra_page_fee}` : ""}` : "—"}</td>
                <td className={`${ui.td} hidden md:table-cell`}>{x.deadline ?? t("Paper deadline")}</td>
                <td className={ui.td}>
                  <input type="checkbox" role="switch" aria-label={t("{name} on", { name: x.name })} checked={x.enabled} disabled={!canEdit || pending} onChange={(e) => run(toggleType(slug, x.id, e.target.checked))} className="size-4 accent-[#18744F]" />
                </td>
                <td className={`${ui.td} whitespace-nowrap text-right`}>
                  {canEdit && !(x.inUse && locked) ? <button type="button" onClick={() => setEditing(x)} className="border-0 bg-transparent p-0 text-[14px] text-[#1F47A8] underline">{t("Edit")}</button> : null}
                  {canEdit && !x.inUse ? <button type="button" disabled={pending} onClick={() => { if (confirm(t("Delete {name}?", { name: x.name }))) run(deleteType(slug, x.id)); }} className="ml-3 border-0 bg-transparent p-0 text-[14px] text-[#B3261E] underline">{t("Delete")}</button> : null}
                </td>
              </tr>
            ))}
            {!types.length ? <tr><td colSpan={6} className={`${ui.td} text-[#4A5263]`}>{t("No types yet — add at least one.")}</td></tr> : null}
          </tbody>
        </table>
      </div>
      {editing ? <TypeEditor key={editing === "new" ? "new" : editing.id} slug={slug} type={editing === "new" ? null : editing} onDone={() => { setEditing(null); router.refresh(); }} />
        : canEdit ? <button type="button" onClick={() => setEditing("new")} className={`${ui.ghost} mt-4`}>{t("+ Add type")}</button> : null}
    </section>
  );
}

export function SubmissionsForm({ slug, types, settings, status, last, canEdit, locked }: {
  slug: string; types: SubType[]; settings: Settings; status: "not_started" | "in_progress" | "ready"; last: { at: string | null; by: string | null }; canEdit: boolean; locked: boolean;
}) {
  const t = useT();
  const [state, action] = useActionState<ManageState, FormData>(saveSubmissionSettings, {});
  const [questions, setQuestions] = useState<CustomQuestion[]>(settings.custom_questions);
  const [maxOn, setMaxOn] = useState(settings.max_papers != null);
  const setQ = (i: number, patch: Partial<CustomQuestion>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <div className="flex flex-col items-start gap-6 xl:flex-row">
      <div className="flex w-full min-w-0 flex-auto flex-col gap-5">
        <TypesCard slug={slug} types={types} canEdit={canEdit} locked={locked} />
        <form action={action} className="flex flex-col gap-5">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="custom_questions" value={JSON.stringify(questions)} />
          <section className={ui.card}>
            <h2 className={ui.h2}>{t("Submission form")}</h2>
            <p className="mb-0 mt-1 text-[14px] text-[#4A5263]">{t("R = required · O = optional · — = hidden")}</p>
            <ul className="m-0 mt-3 list-none p-0">
              {FORM_FIELDS.map((f) => {
                const v = settings.form_fields[f.key] ?? "optional";
                return (
                  <li key={f.key} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0EC] py-3 last:border-0">
                    <span><strong className="text-[15px]">{t(f.label)}</strong>{f.hint ? <span className="block text-[13px] text-[#4A5263]">{t(f.hint)}</span> : null}</span>
                    <span role="radiogroup" aria-label={t(f.label)} className="inline-flex overflow-hidden rounded-[4px] border border-[#B7BDC9]">
                      {([["required", "R"], ["optional", "O"], ["hidden", "—"]] as const).map(([val, lab]) => {
                        const off = !canEdit || (ALWAYS.has(f.key) && val !== "required");
                        return (
                          <label key={val} title={t(val === "required" ? "Required" : val === "optional" ? "Optional" : "Hidden")} className={`relative grid h-9 w-11 place-items-center border-l border-[#B7BDC9] text-[14px] font-semibold first:border-0 has-[:checked]:bg-[#0E1B3D] has-[:checked]:text-white ${off ? "opacity-50" : "cursor-pointer"}`}>
                            <input type="radio" name={`f_${f.key}`} value={val} defaultChecked={(ALWAYS.has(f.key) ? "required" : v) === val} disabled={off} className="sr-only" />{lab}
                          </label>
                        );
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
            {questions.length ? <p className="mb-1 mt-4 text-[14px] font-medium">{t("Your questions")}</p> : null}
            {questions.map((q, i) => (
              <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                <input aria-label={t("Question {n}", { n: i + 1 })} value={q.label} disabled={!canEdit} onChange={(e) => setQ(i, { label: e.target.value })} placeholder={t("e.g. Is this paper part of a special session?")} className={`${ui.input} min-w-[220px] flex-auto`} />
                <select aria-label={t("Answer type")} value={q.kind} disabled={!canEdit} onChange={(e) => setQ(i, { kind: e.target.value as CustomQuestion["kind"] })} className={ui.input}>
                  <option value="text">{t("Text")}</option><option value="yesno">{t("Yes / no")}</option>
                </select>
                <label className="inline-flex items-center gap-1.5 text-[14px]"><input type="checkbox" checked={q.required} disabled={!canEdit} onChange={(e) => setQ(i, { required: e.target.checked })} className="size-4 accent-[#0E1B3D]" />{t("Required")}</label>
                {canEdit ? <button type="button" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} aria-label={t("Remove question")} className="h-9 w-9 rounded-[4px] border border-[#B7BDC9] bg-white">×</button> : null}
              </div>
            ))}
            {state.fieldErrors?.custom_questions ? <p className="mb-0 mt-2 text-[13px] text-[#B3261E]">{t(state.fieldErrors.custom_questions)}</p> : null}
            {canEdit && questions.length < 20 ? <button type="button" onClick={() => setQuestions((qs) => [...qs, { label: "", kind: "text", required: false }])} className={`${ui.ghost} mt-3`}>{t("+ Add question")}</button> : null}
            <label className={`${ui.label} mt-5`}>{t("Keyword list")}
              <input name="keyword_list" defaultValue={settings.keyword_list} disabled={!canEdit} maxLength={200} placeholder={t("e.g. IEEE CSS 2027 (64 keywords)")} className={ui.input} />
            </label>
          </section>

          <section className={ui.card}>
            <h2 className={ui.h2}>{t("PDF rules")}</h2>
            <div className="mt-2">
              {PDF_RULES.map((r) => <Switch key={r.key} name={`p_${r.key}`} defaultChecked={settings.pdf_rules[r.key] ?? true} disabled={!canEdit} label={t(r.label)} hint={r.hint ? t(r.hint) : undefined} />)}
            </div>
          </section>

          <section className={ui.card}>
            <Switch name="max_on" defaultChecked={maxOn} disabled={!canEdit} onChange={setMaxOn} label={t("Maximum papers per author")} hint={t("As presenting author (D11)")} />
            {maxOn ? (
              <label className={`${ui.label} mt-2 max-w-[200px]`}>{t("Papers")}
                <input name="max_papers" type="number" min={1} max={20} defaultValue={settings.max_papers ?? 3} disabled={!canEdit} className={ui.input} />
              </label>
            ) : <input type="hidden" name="max_papers" value="" />}
            {state.fieldErrors?.max_papers ? <p className="mb-0 mt-2 text-[13px] text-[#B3261E]">{t(state.fieldErrors.max_papers)}</p> : null}
          </section>
          <SaveBar state={state} status={status} last={last} readOnly={!canEdit} />
        </form>
      </div>
      <Rules rules={[["D2", "Each type has its own limits, fees, deadline."], ["D3", "IDs are given at first submit, never reused."], ["D4", "PDF checks before submit; blind check for double-blind."], ["D9", "Similarity flags only."], ["D11", "Optional max papers per author."], ["K3", "Types in use lock at opening."]]} />
    </div>
  );
}
