"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { FieldError } from "@/components/manage/save-bar";
import { addDeclaredConflict, removeDeclaredConflict } from "@/lib/manage/setup2-actions";
import type { ManageState } from "@/lib/manage/actions-util";

export type ConflictRow = { id: string | null; who: string; source: "auto" | "declared"; reason: string; until: number | null };

export function ConflictsCard({ rows }: { rows: ConflictRow[] }) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [state, action, saving] = useActionState<ManageState, FormData>(addDeclaredConflict, {});
  const form = useRef<HTMLFormElement>(null);
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (state.ok && state.savedAt !== seen.current) {
      seen.current = state.savedAt;
      form.current?.reset();
      router.refresh();
    }
  }, [state, router]);
  const remove = (id: string) => start(async () => {
    setErr(null);
    const r = await removeDeclaredConflict(id);
    if (r.error) setErr(r.error);
    else router.refresh();
  });
  return (
    <section className={ui.card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={ui.h2}>{t("My conflicts")}</h2>
        <button type="button" onClick={() => setEditing((e) => !e)} aria-expanded={editing} className={ui.ghost}>{editing ? t("Done") : t("Edit declared conflicts")}</button>
      </div>
      {err ? <p role="alert" className={`${ui.bad} mt-3`}>{t(err)}</p> : null}
      {rows.length ? (
        <ul className="m-0 mt-3 flex list-none flex-col p-0">
          {rows.map((r, i) => (
            <li key={r.id ?? `a-${i}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0EC] py-3 last:border-0">
              <span>
                <span className="block font-semibold">{r.who}</span>
                <span className="text-[13px] text-[#4A5263]">{r.reason}{r.until ? ` · ${t("until {year}", { year: r.until })}` : ""}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className={ui.tag} style={r.source === "auto" ? { background: "#E6EDFC", color: "#1F47A8" } : { background: "#FBEFDD", color: "#7A4508" }}>
                  {r.source === "auto" ? t("AUTO · B6") : t("DECLARED")}
                </span>
                {editing && r.id ? (
                  <button type="button" disabled={pending} onClick={() => remove(r.id!)} className="border-0 bg-transparent p-0 text-[13px] text-[#B3261E] underline">{t("Remove")}</button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className={`${ui.hint} mt-3`}>{t("No conflicts found or declared.")}</p>}
      {editing ? (
        <form ref={form} action={action} className="mt-4 grid gap-3 border-t border-[#EEF0EC] pt-4 sm:grid-cols-2">
          <fieldset className="m-0 flex gap-4 border-0 p-0 sm:col-span-2">
            <legend className={ui.label}>{t("Conflict with")}</legend>
            <label className="flex items-center gap-2"><input type="radio" name="kind" value="person" defaultChecked className="accent-[#0E1B3D]" />{t("A person")}</label>
            <label className="flex items-center gap-2"><input type="radio" name="kind" value="institution" className="accent-[#0E1B3D]" />{t("An institution")}</label>
          </fieldset>
          <label className={ui.label}>{t("Email, Plenary ID or institution")}
            <input name="who" className={ui.input} maxLength={200} />
            <FieldError state={state} name="who" />
          </label>
          <label className={ui.label}>{t("Reason")}
            <input name="reason" placeholder={t("e.g. Former PhD supervisor")} className={ui.input} maxLength={200} />
            <FieldError state={state} name="reason" />
          </label>
          <label className={ui.label}>{t("Until (year, optional)")}
            <input name="until_year" inputMode="numeric" pattern="\d{4}" className={ui.input} />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={saving} className={ui.navy}>{t("Declare conflict")}</button>
          </div>
          {state.error ? <p role="alert" className={`${ui.bad} sm:col-span-2`}>{t(state.error)}</p> : null}
          <p className={`${ui.hint} sm:col-span-2`}>{t("Declared conflicts are private. Organizers only see that a conflict exists (B7).")}</p>
        </form>
      ) : null}
    </section>
  );
}
