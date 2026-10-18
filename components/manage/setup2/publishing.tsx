"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { SaveBar } from "@/components/manage/save-bar";
import { savePublishing } from "@/lib/manage/setup2-actions";
import type { ManageState } from "@/lib/manage/actions-util";
import { Stepper, Toggle } from "@/components/manage/setup2/committee";

export type Fee = { name: string; early: number | null; late: number | null; covers: "n" | "0" | "1" | "2" | "3" | "4" | "-" };
type Status = "not_started" | "in_progress" | "ready";
type V = { copyright_mode: "ieee_ecf" | "other_form" | "none"; ieee_record: string; isbn: string; open_access: boolean; papers_per_registration: number; extra_pages_prepaid: boolean; fee_types: Fee[]; currency: string };

const MODES: [V["copyright_mode"], string, string][] = [
  ["ieee_ecf", "IEEE electronic copyright (eCF)", "Authors sign at IEEE; Plenary waits for confirmation"],
  ["other_form", "Other publisher / own form", "Authors upload a signed form"],
  ["none", "No proceedings", "Abstracts only"],
];
const COVERS: [Fee["covers"], string][] = [["n", "N (setting below)"], ["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["-", "—"]];

export function PublishingForm({ slug, v, status, last, canEdit }: { slug: string; v: V; status: Status; last: { at: string | null; by: string | null }; canEdit: boolean }) {
  const t = useT();
  const [state, action] = useActionState<ManageState, FormData>(savePublishing, {});
  const [mode, setMode] = useState(v.copyright_mode);
  const [n, setN] = useState(v.papers_per_registration);
  const [fees, setFees] = useState<Fee[]>(v.fee_types);
  const setFee = (i: number, patch: Partial<Fee>) => setFees((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Number(s)));
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="fee_types" value={JSON.stringify(fees)} />
      <fieldset disabled={!canEdit} className="m-0 flex flex-col gap-5 border-0 p-0">
        <section className={ui.card}>
          <h2 className={ui.h2}>{t("Copyright")}</h2>
          <div role="radiogroup" aria-label={t("Copyright")} className="mt-3 flex flex-col gap-2">
            {MODES.map(([k, label, hint]) => (
              <label key={k} className="flex cursor-pointer items-start gap-3 rounded-[6px] border px-4 py-3"
                style={{ borderColor: mode === k ? "#0E1B3D" : "#DADDE3", background: mode === k ? "#F5F6F3" : "#fff" }}>
                <input type="radio" name="copyright_mode" value={k} checked={mode === k} onChange={() => setMode(k)} className="mt-1 accent-[#0E1B3D]" />
                <span><span className="block font-medium">{t(label)}</span><span className={ui.hint}>{t(hint)}</span></span>
              </label>
            ))}
          </div>
          {mode !== "none" ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={ui.label}>{t("Conference record #")}<input name="ieee_record" defaultValue={v.ieee_record} className={ui.input} maxLength={40} /></label>
              <label className={ui.label}>{t("ISBN")}<input name="isbn" defaultValue={v.isbn} className={ui.input} maxLength={40} /></label>
              {mode === "ieee_ecf" ? (
                <label className={`${ui.label} sm:col-span-2`}>{t("eCF URL")}<input value={t("set automatically")} readOnly disabled className={ui.input} /></label>
              ) : null}
            </div>
          ) : <><input type="hidden" name="ieee_record" value={v.ieee_record} /><input type="hidden" name="isbn" value={v.isbn} /></>}
          <div className="mt-3">
            <Toggle name="open_access" on={v.open_access} label="Open access" />
            <Toggle name="g2" on locked label="Final files lock after the copyright is confirmed" hint="Rule G2 — always on" />
            <Toggle name="g3" on locked label="Authors confirm the final PDF before it's sent to the publisher" hint="Rule G3 — always on" />
          </div>
        </section>

        <section className={ui.card}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className={ui.h2}>{t("Registration & fees")}</h2>
            <label className="flex items-center gap-2 text-[14px] text-[#4A5263]">{t("Currency")}
              <select name="currency" defaultValue={v.currency} className={`${ui.input} mt-0! h-9! w-24!`}>
                {["USD", "EUR", "GBP", "CHF", "CAD", "JPY", "CNY", "INR", "AUD"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className={`${ui.table} min-w-[560px]`}>
              <thead><tr><th className={ui.th}>{t("Type")}</th><th className={ui.th}>{t("Early")}</th><th className={ui.th}>{t("Late")}</th><th className={ui.th}>{t("Covers papers")}</th><th className={ui.th}><span className="sr-only">{t("Remove")}</span></th></tr></thead>
              <tbody>
                {fees.map((f, i) => (
                  <tr key={i}>
                    <td className={ui.td}><input aria-label={t("Type")} value={f.name} onChange={(e) => setFee(i, { name: e.target.value })} className={`${ui.input} mt-0!`} maxLength={60} /></td>
                    <td className={ui.td}><input aria-label={t("Early")} type="number" min={0} value={f.early ?? ""} onChange={(e) => setFee(i, { early: num(e.target.value) })} className={`${ui.input} mt-0! w-28`} /></td>
                    <td className={ui.td}><input aria-label={t("Late")} type="number" min={0} value={f.late ?? ""} onChange={(e) => setFee(i, { late: num(e.target.value) })} className={`${ui.input} mt-0! w-28`} /></td>
                    <td className={ui.td}>
                      <select aria-label={t("Covers papers")} value={f.covers} onChange={(e) => setFee(i, { covers: e.target.value as Fee["covers"] })} className={`${ui.input} mt-0!`}>
                        {COVERS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
                      </select>
                    </td>
                    <td className={`${ui.td} text-right`}>
                      <button type="button" onClick={() => setFees((x) => x.filter((_, j) => j !== i))} className="border-0 bg-transparent p-0 text-[13px] text-[#B3261E] underline">{t("Remove")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => setFees((x) => [...x, { name: t("New fee"), early: null, late: null, covers: "-" }])} className={`${ui.ghost} mt-3`}>+ {t("Add fee type")}</button>
          <div className="mt-3">
            <Stepper name="papers_per_registration" value={n} onChange={setN} min={1} max={4} disabled={!canEdit} label="Papers covered by one author registration (N)" hint="Rule G4" />
            <Toggle name="g5" on locked label="Every accepted paper needs a registration before the program" hint="Rule G5 — always on" />
            <Toggle name="extra_pages_prepaid" on={v.extra_pages_prepaid} label="Extra pages are paid with the registration" hint="Rule G7" />
          </div>
        </section>
      </fieldset>
      <SaveBar state={state} status={status} last={last} readOnly={!canEdit} />
    </form>
  );
}
