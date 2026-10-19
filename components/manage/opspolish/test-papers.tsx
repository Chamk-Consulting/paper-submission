"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { deleteTestSubmission, startTestSubmission } from "@/lib/manage/opspolish-actions";
import { ui } from "@/components/manage/ui";

export type TestPaper = { id: string; title: string; createdAt: string; passedAt: string | null; by: string | null; files: number };

/** One-click delete for a test paper (files + row). */
export function DeleteTestButton({ slug, id, after, className }: { slug: string; id: string; after?: string; className?: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={busy} className={className ?? `${ui.ghost} h-9! px-3! text-[14px]! text-[#B3261E]!`}
        onClick={() => start(async () => {
          setErr(null);
          const r = await deleteTestSubmission(slug, id);
          if (r.error) { setErr(r.error); return; }
          if (after) router.push(after); else router.refresh();
        })}>
        {busy ? t("Deleting…") : t("Delete test paper")}
      </button>
      {err ? <span role="alert" className="text-[13px] text-[#B3261E]">{t(err)}</span> : null}
    </span>
  );
}

/** EM13 "Run a test submission": create a test paper as yourself, go through the real wizard, then delete it. */
export function TestPapers({ slug, rows, canRun }: { slug: string; rows: TestPaper[]; canRun: boolean }) {
  const t = useT();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const passed = rows.some((r) => r.passedAt);
  return (
    <div className={`mt-3 rounded-[8px] border px-4 py-3 ${passed ? "border-[#B9E0CB] bg-[#F3FAF6]" : "border-[#9DB3E8] bg-[#FBFCFF]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          <strong className="block">{passed ? t("Test submission ✓") : t("Run a test submission")}</strong>
          <span className="text-[13px] text-[#4A5263]">{t("As yourself, through the real author steps. Test papers are labelled TEST, never numbered, counted, reviewed or emailed.")}</span>
        </span>
        {canRun ? (
          <button type="button" disabled={busy || rows.length >= 3} className={ui.navy}
            onClick={() => start(async () => { setErr(null); const r = await startTestSubmission(slug); if (r?.error) setErr(r.error); })}>
            {busy ? t("Starting…") : rows.length ? t("Start another test") : t("Start test submission")}
          </button>
        ) : null}
      </div>
      {err ? <p role="alert" className={`mb-0 mt-2 ${ui.bad}`}>{t(err)}</p> : null}
      {rows.length ? (
        <ul className="m-0 mt-3 list-none border-t border-[#DADDE3] p-0">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 border-b border-[#EEF0EC] py-2.5 last:border-0">
              <span className={`${ui.tag} bg-[#0E1B3D] text-[#F2A93B]`}>{t("TEST")}</span>
              <span className="min-w-0 flex-auto">
                <span className="block truncate font-medium">{r.title === "Untitled paper" ? t("Untitled paper") : r.title}</span>
                <span className="block text-[13px] text-[#4A5263]">
                  {r.passedAt ? t("Passed every check") : t("In progress")} · {new Date(r.createdAt).toLocaleString(t.intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{r.by ? ` · ${r.by}` : ""}
                </span>
              </span>
              <Link href={`/submissions/${r.id}/${r.passedAt ? "submitted" : "details"}`} className="text-[14px] font-medium">{r.passedAt ? t("Open") : t("Continue")}</Link>
              <DeleteTestButton slug={slug} id={r.id} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
