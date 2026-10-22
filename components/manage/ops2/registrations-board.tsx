"use client";

import { RowMenu } from "@/components/manage/row-menu";
import { useActionState, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { Act, FieldErr, StateLine, Submit } from "@/components/manage/ops2/act";
import { deleteRegistration, importRegistrations, saveRegistration, unlinkPaper, type Ops2State } from "@/lib/manage/ops2-actions";
import { paperNo } from "@/lib/manage/ops2-time";
import { markRegistrationPaid } from "@/lib/attend/actions";
import { fmtMoney } from "@/lib/attend/money";

const tagGreen = "bg-[#E1F3EA] text-[#14603F]", tagAmber = "bg-[#FFF6E6] text-[#7A4508]";

export type RegRow = {
  id: string; number: string; reg_type: string; full_name: string | null; email: string | null; affiliation: string | null; covers_papers: number;
  paid_at: string | null; checked_in_at: string | null; source: string; papers: { id: string; number: number; title: string }[];
  // online registrations (RG01)
  status?: string; invoice_number?: string | null; amount_cents?: number | null; currency?: string | null; payment_method?: string | null;
};

function RegForm({ slug, row, onDone }: { slug: string; row: RegRow | null; onDone: () => void }) {
  const t = useT();
  const [state, run] = useActionState<Ops2State, FormData>(async (p, fd) => { const r = await saveRegistration(p, fd); if (r.ok && !r.info) onDone(); return r; }, {});
  return (
    <form action={run} className="flex flex-col gap-3" key={row?.id ?? "new"}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={row?.id ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <label className={ui.label}>{t("Number")}<input name="number" defaultValue={row?.number ?? ""} required className={ui.input} placeholder="R-0001" /><FieldErr state={state} name="number" /></label>
        <label className={ui.label}>{t("Type")}<input name="reg_type" defaultValue={row?.reg_type ?? "Full"} list="reg-types" required className={ui.input} /><FieldErr state={state} name="reg_type" /></label>
      </div>
      <datalist id="reg-types"><option value="Full" /><option value="Student" /><option value="IEEE member" /><option value="Life member" /><option value="One day" /></datalist>
      <label className={ui.label}>{t("Full name")}<input name="full_name" defaultValue={row?.full_name ?? ""} required className={ui.input} /><FieldErr state={state} name="full_name" /></label>
      <label className={ui.label}>{t("Email")}<input name="email" type="email" defaultValue={row?.email ?? ""} className={ui.input} /><FieldErr state={state} name="email" /></label>
      <label className={ui.label}>{t("Affiliation")}<input name="affiliation" defaultValue={row?.affiliation ?? ""} className={ui.input} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className={ui.label}>{t("Covers papers")}<input name="covers_papers" type="number" min={0} max={4} defaultValue={row?.covers_papers ?? 1} className={ui.input} /></label>
        <label className="flex items-center gap-2 self-end pb-3 text-[14px]"><input type="checkbox" name="paid" defaultChecked={!!row?.paid_at || !row} className="size-4" /> {t("Paid")}</label>
      </div>
      <label className={ui.label}>{t("Link papers")}<input name="papers" className={ui.input} placeholder="#0012, #0140" /><span className={ui.hint}>{t("Paper numbers, separated by commas. A linked paper counts as registered (EM28).")}</span></label>
      <StateLine state={state} />
      <div className="flex gap-2">
        <Submit className={ui.navy} pendingLabel={t("Saving…")}>{row ? t("Save changes") : t("Add registration")}</Submit>
        {row ? <button type="button" onClick={onDone} className={ui.ghost}>{t("Cancel")}</button> : null}
      </div>
    </form>
  );
}

function ImportForm({ slug }: { slug: string }) {
  const t = useT();
  const [state, run] = useActionState<Ops2State, FormData>(importRegistrations, {});
  return (
    <form action={run} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <p className={`${ui.hint} m-0`}>{t("Export from your registration system as CSV. Columns: number, name, email, affiliation, type, papers, paid. Existing numbers are updated.")}</p>
      <input type="file" name="file" accept=".csv,text/csv,text/plain" className="text-[13px]" />
      <textarea name="csv" rows={4} className={`${ui.textarea} font-mono text-[12px]`} placeholder={"number,name,email,affiliation,type,papers,paid\nR-0001,Amina Rahman,amina@lab.org,ETH Zürich,Full,#0012,yes"} />
      {state.ok ? <p role="status" className="m-0 text-[13px] text-[#14603F]">{t("Imported {n} registrations.", { n: state.count ?? 0 })}</p> : null}
      <StateLine state={state} />
      <Submit className={ui.ghost} pendingLabel={t("Importing…")}>{t("Import CSV")}</Submit>
    </form>
  );
}

export function RegistrationsBoard({ slug, rows }: { slug: string; rows: RegRow[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<RegRow | null>(null);
  const [tab, setTab] = useState<"add" | "import">("add");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => [r.number, r.full_name, r.email, r.affiliation, ...r.papers.map((p) => paperNo(p.number))].some((x) => x?.toLowerCase().includes(s)));
  }, [q, rows]);
  const paid = rows.filter((r) => r.paid_at).length;
  const linked = new Set(rows.flatMap((r) => r.papers.map((p) => p.id))).size;
  const checked = rows.filter((r) => r.checked_in_at).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={ui.card}><p className={ui.kicker}>{t("Registered")}</p><p className="m-0 mt-1 font-serif text-[32px]">{rows.length}</p></div>
        <div className={ui.card}><p className={ui.kicker}>{t("Paid")}</p><p className="m-0 mt-1 font-serif text-[32px]">{paid}</p></div>
        <div className={ui.card}><p className={ui.kicker}>{t("Papers covered")}</p><p className="m-0 mt-1 font-serif text-[32px]">{linked}</p></div>
        <div className={ui.card}><p className={ui.kicker}>{t("Checked in")}</p><p className="m-0 mt-1 font-serif text-[32px]">{checked}</p></div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-3">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search name, email, number or paper")} aria-label={t("Search registrations")} className={`${ui.input} w-full`} />
          <div className="overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
            <table className={ui.table}>
              <thead><tr><th className={ui.th}>#</th><th className={ui.th}>{t("Person")}</th><th className={ui.th}>{t("Type")}</th><th className={ui.th}>{t("Papers")}</th><th className={ui.th}>{t("Status")}</th><th className={ui.th}><span className="sr-only">{t("Actions")}</span></th></tr></thead>
              <tbody>
                {shown.length === 0 ? <tr><td colSpan={6} className={`${ui.td} text-center text-[#4A5263]`}>{rows.length ? t("No registration matches.") : t("No registrations yet. Add one or import a CSV.")}</td></tr> : shown.slice(0, 300).map((r) => (
                  <tr key={r.id} className={edit?.id === r.id ? "bg-[#FFF6E6]" : ""}>
                    <td className={`${ui.td} font-mono text-[12px]`}>{r.number}</td>
                    <td className={ui.td}><span className="font-medium">{r.full_name ?? "—"}</span><span className="block text-[12px] text-[#4A5263]">{[r.email, r.affiliation].filter(Boolean).join(" · ")}</span></td>
                    <td className={`${ui.td} text-[13px]`}>{r.reg_type}<span className="block text-[11px] text-[#4A5263]">{t("covers {n}", { n: r.covers_papers })}{r.source !== "manual" ? ` · ${t(r.source === "import" ? "imported" : "at desk")}` : ""}</span></td>
                    <td className={ui.td}>
                      <div className="flex flex-wrap gap-1">
                        {r.papers.map((p) => (
                          <span key={p.id} title={p.title} className="inline-flex items-center gap-1 rounded-[3px] bg-[#EEF0EC] px-1.5 py-px font-mono text-[11px]">
                            {paperNo(p.number)}
                            <Act action={unlinkPaper} fields={{ slug, reg: r.id, sub: p.id }} className="cursor-pointer border-0 bg-transparent p-0 text-[11px] text-[#B3261E]">×</Act>
                          </span>
                        ))}
                        {r.papers.length > r.covers_papers ? <span className={`${ui.tag} bg-[#FFF6E6] text-[#7A4508]`}>{t("over limit")}</span> : null}
                      </div>
                    </td>
                    <td className={ui.td}>
                      {r.status === "cancelled" ? <span className={`${ui.tag} bg-[#EEF0EC] text-[#4A5263]`}>{t("CANCELLED")}</span>
                        : <span className={`${ui.tag} ${r.paid_at ? tagGreen : tagAmber}`}>{t(r.paid_at ? "PAID" : r.status === "awaiting_payment" ? "AWAITING PAYMENT" : "UNPAID")}</span>}
                      {r.checked_in_at ? <span className={`${ui.tag} ml-1 bg-[#E8EEFB] text-[#1F47A8]`}>{t("CHECKED IN")}</span> : null}
                      {r.invoice_number ? (
                        <span className="mt-1 block text-[11px] text-[#4A5263]">
                          <a href={`/venues/${slug}/register/document?r=${r.id}&kind=invoice`} className="font-mono">{r.invoice_number}</a>
                          {r.amount_cents != null && r.currency ? ` · ${fmtMoney(r.amount_cents, r.currency, t.intl)}` : ""}{r.payment_method === "card" ? ` · ${t("card")}` : ""}
                        </span>
                      ) : null}
                      {r.status === "awaiting_payment" && !r.paid_at ? (
                        <div className="mt-1"><Act action={markRegistrationPaid} fields={{ slug, id: r.id, paid: "1" }} className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-[#14603F] underline" pendingLabel={t("Saving…")}>{t("Mark paid")}</Act></div>
                      ) : null}
                    </td>
                    <td className={`${ui.td} whitespace-nowrap text-right`}>
                      <RowMenu label={t("Registration {n}", { n: r.number })} actions={[
                        { label: t("Edit"), onClick: () => { setEdit(r); setTab("add"); } },
                        { label: t("Delete"), danger: true, onClick: () => document.getElementById(`reg-del-${r.id}`)?.querySelector("button")?.click() },
                      ]} />
                      {/* The delete form stays in the row (it asks for confirmation and shows any error); the menu presses it. */}
                      <span id={`reg-del-${r.id}`} className="[&_button]:hidden">
                        <Act action={deleteRegistration} fields={{ slug, id: r.id }} className="" confirm={t("Delete registration {n}?", { n: r.number })}>{t("Delete")}</Act>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length > 300 ? <p className={`${ui.hint} m-0`}>{t("Showing the first 300 — search to narrow down.")}</p> : null}
        </div>
        <aside className={ui.card}>
          <div role="tablist" className="mb-4 flex gap-1.5">
            {(["add", "import"] as const).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-[32px] rounded-full border px-3 text-[13px] ${tab === k ? "border-[#0E1B3D] bg-[#0E1B3D] text-white" : "border-[#B7BDC9] bg-white"}`}>
                {k === "add" ? (edit ? t("Edit registration") : t("Add registration")) : t("Import CSV")}
              </button>
            ))}
          </div>
          {tab === "add" ? <RegForm slug={slug} row={edit} onDone={() => setEdit(null)} /> : <ImportForm slug={slug} />}
        </aside>
      </div>
    </div>
  );
}
