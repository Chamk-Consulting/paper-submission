"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { cancelDeletion } from "@/lib/data/actions";
import type { DataReq, ExportPage } from "@/lib/data/data";

/* Canvas ST05 — your data export. */

const card = "rounded-[8px] border border-[#DADDE3] bg-white px-6 py-5";
const primary = "inline-flex h-[42px] items-center justify-center rounded-[4px] border-0 bg-[#F2A93B] px-[18px] text-[15px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26] disabled:opacity-60";
const ghost = "inline-flex h-8 items-center whitespace-nowrap rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60";

const STATUS: Record<string, [string, string, string]> = {
  ready: ["READY", "#E1F3EA", "#14603F"],
  preparing: ["PREPARING", "#E6EDFC", "#1F47A8"],
  requested: ["REQUESTED", "#E6EDFC", "#1F47A8"],
  expired: ["EXPIRED", "#EEF0EC", "#4A5263"],
  done: ["DONE", "#EEF0EC", "#4A5263"],
  blocked: ["NOT POSSIBLE YET", "#FBEFDD", "#7A4508"],
  cancelled: ["CANCELLED", "#EEF0EC", "#4A5263"],
};
const KIND: Record<string, string> = { export: "Export", delete: "Delete account", merge: "Merge accounts", import: "Import" };

export function ExportPanel({ page, expiredHint }: { page: ExportPage; expiredHint: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(expiredHint ? "That download link has expired. Make a new export." : null);
  const latest = page.latest;
  const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(t.intl, { day: "numeric", month: "short", year: "numeric" }) : "—");
  const mb = (b?: number) => (b ? (b / 1048576 < 1 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`) : "");
  const ready = latest?.status === "ready";
  const preparing = pending || latest?.status === "preparing";

  const make = () => start(async () => {
    setErr(null);
    const res = await fetch("/api/account/export", { method: "POST" }).catch(() => null);
    if (!res || !res.ok) {
      const j = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setErr(j.error === "limit" ? "You made 5 exports today. Try again tomorrow." : "The export failed. Please try again.");
    }
    router.refresh();
  });

  const inside: [string, string, string][] = [
    ["Profile", "Name, affiliations, topics, emails, ORCID", "profile.json"],
    ["Papers", page.counts.papers === null ? "Every paper you are an author of, with every version you uploaded" : t("{n} papers with every version you uploaded", { n: page.counts.papers }), "papers/ + papers.json"],
    ["Reviews you wrote", page.counts.reviews === null ? "Scores and comments" : t("{n} reviews with scores and comments", { n: page.counts.reviews }), "reviews.json"],
    ["Messages", page.counts.threads === null ? "Inbox threads you are part of" : t("{n} inbox threads you are part of", { n: page.counts.threads }), "inbox.json"],
    ["Activity", "Sign-ins and consents with dates", "activity.csv"],
    ["Registrations", page.counts.registrations === null ? "Event registrations" : t("{n} event registrations", { n: page.counts.registrations }), "registrations.json"],
  ];

  return (
    <div className="flex min-w-0 max-w-[860px] flex-col gap-[18px]">
      <section className={card}>
        {ready && latest ? (
          <div className="flex flex-wrap items-start gap-4">
            <span aria-hidden className="flex size-12 flex-none items-center justify-center rounded-[8px] bg-[#E6EDFC] font-mono text-[12px] font-semibold text-[#1F47A8]">ZIP</span>
            <div className="min-w-0 flex-[1_1_260px]">
              <h2 className="m-0 text-[19px] font-semibold">{t("Your export is ready")}</h2>
              <p className="m-0 mt-0.5 text-[14px] text-[#4A5263]">
                plenary-export.zip · {mb(latest.detail?.bytes)} · {t("made {date}", { date: fmtDate(latest.created_at) })} · {t("link works until {date}", { date: fmtDate(latest.detail?.expires_at) })}
              </p>
              {latest.detail?.files_skipped ? <p className="m-0 mt-1 text-[13px] text-[#7A4508]">{t("{n} large files were left out to keep it under 50 MB — README.txt lists them.", { n: latest.detail.files_skipped })}</p> : null}
            </div>
            <a href={`/api/account/export/${latest.id}`} className={primary}>{t("Download ZIP")}</a>
          </div>
        ) : preparing ? (
          <div aria-live="polite">
            <h2 className="m-0 text-[19px] font-semibold">{t("Preparing your export…")}</h2>
            <p className="m-0 mt-1 text-[14px] text-[#4A5263]">{t("This usually takes under a minute. Keep this page open.")}</p>
            <div aria-hidden className="mt-3 h-2 overflow-hidden rounded-[4px] bg-[#EEF0EC]"><div className="h-2 w-[35%] animate-pulse rounded-[4px] bg-[#2F5FD0] motion-reduce:animate-none" /></div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-[1_1_260px]">
              <h2 className="m-0 text-[19px] font-semibold">{t("Download everything")}</h2>
              <p className="m-0 mt-0.5 text-[14px] text-[#4A5263]">{t("We put it together now. The download link works for 7 days.")}</p>
            </div>
            <button type="button" onClick={make} disabled={pending} className={primary}>{t("Make my export")}</button>
          </div>
        )}
        {err ? <p role="alert" className="mb-0 mt-3 text-[13px] text-[#B3261E]">{t(err)}</p> : null}
      </section>

      <section className={card}>
        <h2 className="m-0 text-[17px] font-semibold">{t("What's inside")}</h2>
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {inside.map(([title, d, f]) => (
            <div key={title} className="rounded-[6px] border border-[#EEF0EC] px-3.5 py-3">
              <p className="m-0 text-[14px] font-semibold">{t(title)}</p>
              <p className="m-0 mt-0.5 text-[13px] text-[#4A5263]">{t(d)}</p>
              <p className="m-0 mt-1 font-mono text-[12px] text-[#4A5263]">{f}</p>
            </div>
          ))}
        </div>
        <p className="mb-0 mt-3 text-[13px] text-[#4A5263]">{t("Not included: other people's reviews of your papers before release, and reviewer identities in blind venues (rule A3).")}</p>
      </section>

      <Requests requests={page.requests} fmtDate={fmtDate} />
    </div>
  );
}

function Requests({ requests, fmtDate }: { requests: DataReq[]; fmtDate: (iso: string | null | undefined) => string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <section className="overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
      <div className="border-b border-[#EEF0EC] px-5 py-4"><h2 className="m-0 text-[17px] font-semibold">{t("Your requests")}</h2></div>
      {requests.length ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <thead><tr className="bg-[#F7F8F6] text-left">
              <th scope="col" className="px-4 py-2.5 font-semibold">{t("Request")}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">{t("Asked")}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">{t("Status")}</th>
              <th scope="col" className="px-4 py-2.5"><span className="sr-only">{t("Action")}</span></th>
            </tr></thead>
            <tbody>
              {requests.map((r) => {
                const scheduled = r.kind === "delete" && r.status === "requested";
                const [label, bg, ink] = scheduled ? [t("DELETES ON {date}", { date: fmtDate(r.scheduled_for).toUpperCase() }), "#FDECEA", "#B3261E"] : (STATUS[r.status] ?? [r.status.toUpperCase(), "#EEF0EC", "#4A5263"]);
                return (
                  <tr key={r.id} className="border-t border-[#EEF0EC]">
                    <td className="px-4 py-2.5 font-semibold">{t(KIND[r.kind] ?? r.kind)}{r.status === "blocked" && r.blocked_reason ? <span className="block text-[12px] font-normal text-[#7A4508]">{r.blocked_reason}</span> : null}</td>
                    <td className="px-4 py-2.5">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-2.5"><span className="rounded-[3px] px-2 py-0.5 font-mono text-[11px]" style={{ background: bg, color: ink }}>{scheduled ? label : t(label)}</span></td>
                    <td className="px-4 py-2.5 text-right">
                      {scheduled ? (
                        <button type="button" disabled={pending} onClick={() => start(async () => { const x = await cancelDeletion(r.id); setErr(x.error ?? null); router.refresh(); })}
                          className={`${ghost} border-[#F3C3BE]! text-[#B3261E]!`}>{t("Cancel deletion")}</button>
                      ) : r.kind === "export" && r.status === "ready" ? (
                        <a href={`/api/account/export/${r.id}`} className="text-[13px] font-semibold text-[#2F5FD0]">{t("Download")}</a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="m-0 px-5 py-4 text-[14px] text-[#4A5263]">{t("No requests yet.")}</p>}
      {err ? <p role="alert" className="m-0 px-5 pb-4 text-[13px] text-[#B3261E]">{t(err)}</p> : null}
    </section>
  );
}
