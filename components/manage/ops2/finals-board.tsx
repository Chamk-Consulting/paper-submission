"use client";

import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { Act, StateLine, Submit } from "@/components/manage/ops2/act";
import { chaseIncomplete, finalAdminAction, type Ops2State } from "@/lib/manage/ops2-actions";
import { paperNo } from "@/lib/manage/ops2-time";

export type FinalRow = {
  submission_id: string; number: number; title: string; decision: string | null; presenter: string | null; pdf: boolean; copyright: string;
  registered: boolean; extra_pages: number; extra_paid: boolean; locked: boolean; status: string; missing: string[];
};

const statusTag: Record<string, [string, string]> = {
  complete: ["COMPLETE", "bg-[#E1F3EA] text-[#14603F]"], in_progress: ["IN PROGRESS", "bg-[#FFF6E6] text-[#7A4508]"],
  incomplete: ["INCOMPLETE", "bg-[#FDECEA] text-[#8C1D18]"], dropped: ["DROPPED", "bg-[#EEF0EC] text-[#4A5263]"],
};

const DECISION: Record<string, string> = { accept_oral: "Oral", accept_poster: "Poster", conditional: "Conditional" };

function Tick({ v, title }: { v: "done" | "needed" | "na"; title: string }) {
  const cls = v === "done" ? "text-[#14603F]" : v === "needed" ? "text-[#B3261E] font-semibold" : "text-[#6B7385]";
  return <span title={title} className={`font-mono text-[15px] ${cls}`}>{v === "done" ? "✓" : v === "needed" ? "!" : "–"}</span>;
}

export function FinalsBoard({ slug, rows, deadline, pastDeadline, daysLeft }: { slug: string; rows: FinalRow[]; deadline: string | null; pastDeadline: boolean; daysLeft: number | null }) {
  const t = useT();
  const [filter, setFilter] = useState<"incomplete" | "complete" | "all">("incomplete");
  const [chase, runChase] = useActionState<Ops2State, FormData>(chaseIncomplete, {});
  const open = rows.filter((r) => r.status === "in_progress" || r.status === "incomplete");
  const chaseable = open.filter((r) => r.missing.length);
  const shown = rows.filter((r) => filter === "all" || (filter === "complete" ? r.status === "complete" : r.status !== "complete"));
  const by = (d: string) => rows.filter((r) => r.decision === d).length;
  const complete = rows.filter((r) => r.status === "complete").length;
  const noCopyright = rows.filter((r) => r.status !== "dropped" && r.copyright !== "signed").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={ui.card}><p className={ui.kicker}>{t("Accepted")}</p><p className="m-0 mt-1 font-serif text-[32px]">{rows.length}</p><p className={`${ui.hint} m-0`}>{t("{o} oral · {p} poster · {c} conditional", { o: by("accept_oral"), p: by("accept_poster"), c: by("conditional") })}</p></div>
        <div className={ui.card}><p className={ui.kicker}>{t("Complete")}</p><p className="m-0 mt-1 font-serif text-[32px] text-[#14603F]">{complete}</p><p className={`${ui.hint} m-0`}>{t("PDF + © + REG")}</p></div>
        <div className={ui.card}><p className={ui.kicker}>{t("Missing copyright")}</p><p className="m-0 mt-1 font-serif text-[32px] text-[#B3261E]">{noCopyright}</p><p className={`${ui.hint} m-0`}>{t("IEEE not confirmed (G3)")}</p></div>
        <div className={ui.card}>
          <p className={ui.kicker}>{t("Deadline")}</p>
          {pastDeadline
            ? <><p className="m-0 mt-1 font-serif text-[22px] text-[#8C1D18]">{t("Passed")}</p><p className={`${ui.hint} m-0`}>{t("Incomplete · chair decides (G6)")}</p></>
            : deadline ? <><p className="m-0 mt-1 font-serif text-[22px]">{deadline}</p><p className={`${ui.hint} m-0`}>{daysLeft !== null ? t("in {n} days · hard", { n: daysLeft }) : t("hard")}</p></>
            : <><p className="m-0 mt-1 font-serif text-[22px]">—</p><p className={`${ui.hint} m-0`}><Link href={`/manage/${slug}/setup/dates`}>{t("Set the finals deadline")}</Link></p></>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-1.5">
          {(["incomplete", "complete", "all"] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={`h-[34px] rounded-full border px-3.5 text-[13px] ${filter === f ? "border-[#0E1B3D] bg-[#0E1B3D] text-white" : "border-[#B7BDC9] bg-white text-[#121826]"}`}>
              {t(f === "incomplete" ? "Incomplete" : f === "complete" ? "Complete" : "All")} · {f === "incomplete" ? rows.length - complete : f === "complete" ? complete : rows.length}
            </button>
          ))}
        </div>
        <form action={runChase} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="slug" value={slug} />
          {chase.ok ? <p role="status" className="m-0 text-[13px] text-[#14603F]">{t("Reminder sent to the corresponding authors of {n} papers, listing exactly what is missing.", { n: chase.count ?? 0 })}</p> : null}
          <StateLine state={chase} />
          <Submit className={ui.primary} disabled={!chaseable.length || chase.ok} pendingLabel={t("Sending…")}>{t("Chase {n} incomplete", { n: chaseable.length })}</Submit>
        </form>
      </div>

      <div className="overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
        <table className={ui.table}>
          <thead><tr>
            <th className={ui.th}>{t("ID")}</th><th className={ui.th}>{t("Paper")}</th><th className={`${ui.th} text-center`}>PDF</th><th className={`${ui.th} text-center`}>©</th>
            <th className={`${ui.th} text-center`}>REG</th><th className={`${ui.th} text-center`}>{t("Extra pp")}</th><th className={`${ui.th} text-center`}>{t("Lock")}</th><th className={ui.th}>{t("Status")}</th>
          </tr></thead>
          <tbody>
            {shown.length === 0 ? <tr><td colSpan={8} className={`${ui.td} text-center text-[#4A5263]`}>{t("Nothing here.")}</td></tr> : shown.map((r) => {
              const [label, cls] = statusTag[r.status] ?? statusTag.in_progress;
              return (
                <tr key={r.submission_id} className={r.status === "dropped" ? "opacity-60" : ""}>
                  <td className={`${ui.td} font-mono text-[12px]`}>{paperNo(r.number)}</td>
                  <td className={ui.td}>
                    <span className="font-medium">{r.title}</span>
                    <span className="block text-[12px] text-[#4A5263]">{t(DECISION[r.decision ?? ""] ?? "Accepted")} · {r.presenter ? t("presenter {name}", { name: r.presenter }) : t("no presenter yet")}</span>
                    {r.missing.length && r.status !== "dropped" ? <span className="block text-[12px] text-[#8C1D18]">{t("Missing:")} {r.missing.map((m) => t(m)).join(", ")}</span> : null}
                  </td>
                  <td className={`${ui.td} text-center`}><Tick v={r.pdf ? "done" : "needed"} title={t("Final PDF")} /></td>
                  <td className={`${ui.td} text-center`}>
                    <Tick v={r.copyright === "signed" ? "done" : "needed"} title={t("Copyright")} />
                    {r.copyright !== "signed" && r.status !== "dropped" ? (
                      <div className="mt-1"><Act action={finalAdminAction} fields={{ slug, submission: r.submission_id, action: "copyright_signed" }} className="cursor-pointer border-0 bg-transparent p-0 text-[11px] text-[#2F5FD0] underline" confirm={t("Mark copyright as confirmed by IEEE for {id}?", { id: paperNo(r.number) })}>{t("Confirm")}</Act></div>
                    ) : null}
                  </td>
                  <td className={`${ui.td} text-center`}><Tick v={r.registered ? "done" : "needed"} title={t("Registration")} /></td>
                  <td className={`${ui.td} text-center`}>{r.extra_pages > 0 ? <span className="font-mono text-[12px]">{r.extra_pages} <Tick v={r.extra_paid ? "done" : "needed"} title={t("Extra-page payment")} /></span> : <Tick v="na" title={t("Not needed")} />}</td>
                  <td className={`${ui.td} text-center`}><Tick v={r.locked ? "done" : "needed"} title={t("Title and authors lock")} /></td>
                  <td className={ui.td}>
                    <span className={`${ui.tag} ${cls}`}>{t(label)}</span>
                    {r.status === "incomplete" ? <div className="mt-1.5"><Act action={finalAdminAction} fields={{ slug, submission: r.submission_id, action: "drop" }} className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#B3261E] underline" confirm={t("Drop {id} from the program? You can undo this.", { id: paperNo(r.number) })}>{t("Drop from program")}</Act></div> : null}
                    {r.status === "dropped" ? <div className="mt-1.5"><Act action={finalAdminAction} fields={{ slug, submission: r.submission_id, action: "undrop" }} className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#2F5FD0] underline">{t("Undo")}</Act></div> : null}
                    {r.locked && r.status !== "dropped" ? <div className="mt-1.5"><Act action={finalAdminAction} fields={{ slug, submission: r.submission_id, action: "unlock" }} className="cursor-pointer border-0 bg-transparent p-0 text-[11px] text-[#4A5263] underline" confirm={t("Unlock the title and authors of {id}? The authors can edit them again.", { id: paperNo(r.number) })}>{t("Unlock")}</Act></div> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={`${ui.hint} m-0`}>{t("✓ done · ! needed · – not needed. Copyright counts only when IEEE confirms (G3). After the deadline, incomplete papers are marked and the chair decides whether they stay in the program (G6).")}</p>
    </div>
  );
}
