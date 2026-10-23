import Link from "@/components/site/link";
import { RichTextView } from "@/components/rich-text/view";
import { OpenFile } from "@/components/submission/status-bits";
import { wordCount } from "@/lib/rich-text/plain";
import type { Ctx, SubFile } from "@/lib/submission/data";
import type { getT } from "@/lib/i18n/server";

/*
 * Paper status › "What you submitted": everything the authors entered, in full, on one card
 * (title, abstract, type and track, keywords, authors, files, conflicts, declarations, confirmations),
 * so nobody has to open the edit steps to see what the organizers received.
 */

type T = Awaited<ReturnType<typeof getT>>;

const ROLE: Record<SubFile["role"], string> = {
  paper: "Paper", appendix: "Appendix", source: "Source files", data: "Data", video: "Video", revision: "Revised paper",
  highlighted: "Changes highlighted", final: "Final version", slides: "Slides", supplementary: "Supplementary material",
};
const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function SubmissionContent({ ctx, t, pageLimit, editHref }: { ctx: Ctx; t: T; pageLimit: string | null; editHref: string | null }) {
  const { sub, venue, authors, files, conflicts } = ctx;
  const when = (iso: string) => new Date(iso).toLocaleString(t.intl, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const words = wordCount(sub.abstract);
  const shown = files.filter((f) => f.current).sort((a, b) => (a.role === "paper" ? -1 : b.role === "paper" ? 1 : a.role.localeCompare(b.role)));
  const older = files.length - shown.length;
  const label = "font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]";
  const row = "grid gap-1 border-b border-[#EEF0EC] py-3.5 last:border-b-0 sm:grid-cols-[150px_1fr] sm:gap-4";
  const yes = (ok: boolean | undefined, text: string) => (
    <li className="flex gap-2"><span className={ok ? "text-[#14603F]" : "text-[#6B7385]"} aria-hidden>{ok ? "✓" : "—"}</span><span className={ok ? "" : "text-[#4A5263]"}>{t(text)}{ok ? "" : ` (${t("no")})`}</span></li>
  );

  return (
    <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[22px] py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 font-serif text-[22px] font-normal">{t("What you submitted")}</h2>
        {editHref ? <Link href={editHref} className="text-[14px] text-[#2F5FD0] underline">{t("Edit")}</Link> : null}
      </div>
      <p className="mb-1 mt-1 text-[14px] text-[#4A5263]">
        {sub.submittedAt ? t("Submitted on {date} (UTC).", { date: when(sub.submittedAt) }) : t("Not submitted yet.")}
        {sub.submittedAt && Date.parse(sub.updatedAt) - Date.parse(sub.submittedAt) > 60000 ? ` ${t("Last changed on {date}.", { date: when(sub.updatedAt) })}` : ""}
      </p>

      <div className={row}>
        <span className={label}>{t("Title")}</span>
        <div>
          <p className="m-0 font-serif text-[18px] leading-[1.3]">{sub.title}</p>
          {sub.shortTitle ? <p className="m-0 mt-1 text-[14px] text-[#4A5263]">{t("Short title")}: {sub.shortTitle}</p> : null}
        </div>
      </div>

      <div className={row}>
        <span className={label}>{t("Abstract")}</span>
        <div className="min-w-0">
          {sub.abstract ? <RichTextView text={sub.abstract} mode="abstract" className="text-[15px] leading-[1.65] [overflow-wrap:anywhere]" /> : <p className="m-0 text-[#B3261E]">{t("No abstract yet")}</p>}
          <p className="m-0 mt-1.5 font-mono text-[12px] text-[#4A5263]">{t("{n} words", { n: words })}</p>
        </div>
      </div>

      <div className={row}>
        <span className={label}>{t("Type & track")}</span>
        <div>
          <p className="m-0"><strong>{t(sub.paperType)}</strong>{venue.reviewMode ? ` · ${t(venue.reviewMode).toLowerCase()}` : ""}{pageLimit ? ` · ${t("limit {limit}", { limit: pageLimit })}` : ""}</p>
          <p className="m-0 text-[14px] text-[#4A5263]">{t("Track")}: {sub.track ? t(sub.track) : "—"} · {venue.acr} · {venue.name}</p>
        </div>
      </div>

      <div className={row}>
        <span className={label}>{t("Keywords")}</span>
        <div className="flex flex-wrap gap-1.5">
          {sub.keywords.length ? sub.keywords.map((k, i) => (
            <span key={k} className={`rounded-full px-2.5 py-0.5 text-[13px] ${i === 0 ? "bg-[#0E1B3D] text-white" : "bg-[#EEF0EC] text-[#121826]"}`}>{t(k)}{i === 0 ? ` · ${t("main")}` : ""}</span>
          )) : <span className="text-[#B3261E]">{t("None yet")}</span>}
          {sub.ownKeywords.map((k) => <span key={`own-${k}`} className="rounded-full border border-dashed border-[#B7BDC9] px-2.5 py-0.5 text-[13px]">{k} · {t("your own")}</span>)}
        </div>
      </div>

      <div className={row}>
        <span className={label}>{t("Authors")}</span>
        <ol className="m-0 list-none p-0">
          {authors.map((a) => (
            <li key={a.personId} className="border-b border-dashed border-[#EEF0EC] py-1.5 first:pt-0 last:border-b-0 last:pb-0">
              <span className="font-semibold">{a.position}. {a.name}</span>
              {a.isYou ? <span className="text-[#4A5263]"> {t("(you)")}</span> : null}
              {a.corresponding ? <span className="ml-1.5 rounded-[2px] bg-[#E6EDFC] px-1.5 py-0.5 font-mono text-[11px] text-[#1F47A8]">{t("CORRESPONDING")}</span> : null}
              {!a.hasAccount ? <span className="ml-1.5 rounded-[2px] bg-[#FBEFDD] px-1.5 py-0.5 font-mono text-[11px] text-[#7A4508]">{t("NO ACCOUNT YET")}</span> : null}
              <span className="block text-[14px] text-[#4A5263]">{[a.institution, a.email, a.plenaryId].filter(Boolean).join(" · ") || "—"}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className={row}>
        <span className={label}>{t("Files")}</span>
        <div>
          {shown.length ? shown.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-dashed border-[#EEF0EC] py-1.5 first:pt-0 last:border-b-0">
              <span className="min-w-0">
                <span className="block text-[13px] text-[#4A5263]">{t(ROLE[f.role] ?? f.role)}{f.version > 1 ? ` · v${f.version}` : ""}</span>
                <span className="block truncate">{f.name}</span>
                <span className="block text-[13px] text-[#4A5263]">{[f.pages != null ? t("{n} pages", { n: f.pages }) : "", size(f.size), new Date(f.createdAt).toLocaleDateString(t.intl, { day: "numeric", month: "short", timeZone: "UTC" })].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="flex flex-none items-center gap-3">
                {f.mime === "application/pdf" ? (
                  <span className="rounded-[2px] px-1.5 font-mono text-[11px]" style={{ background: f.check.status === "failed" ? "#FDECEA" : "#E1F3EA", color: f.check.status === "failed" ? "#B3261E" : "#14603F" }}>{f.check.status === "failed" ? t("× PROBLEMS") : t("✓ PASSED")}</span>
                ) : null}
                <OpenFile path={f.path} className="border-0 bg-transparent p-0 text-[14px] text-[#2F5FD0]">{t("Open")}</OpenFile>
              </span>
            </div>
          )) : <span className="text-[#B3261E]">{t("No files yet.")}</span>}
          {older > 0 ? <p className="m-0 mt-1 text-[13px] text-[#4A5263]">{t(older === 1 ? "{n} earlier version kept" : "{n} earlier versions kept", { n: older })}</p> : null}
        </div>
      </div>

      <div className={row}>
        <span className={label}>{t("Conflicts")}</span>
        <div>
          {conflicts.length ? (
            <ul className="m-0 list-none p-0">
              {conflicts.map((c) => <li key={c.id} className="py-0.5">{c.institution ?? t("A person you listed")} <span className="text-[#4A5263]">· {t(c.reason)}</span></li>)}
            </ul>
          ) : <p className="m-0">{t("No extra conflicts declared.")}</p>}
          <p className="m-0 mt-1 text-[13px] text-[#4A5263]">{t("Your co-authors' institutions are excluded from review automatically.")}{sub.conflictsOkAt ? ` ${t("Checked on {date}.", { date: when(sub.conflictsOkAt) })}` : ""}</p>
        </div>
      </div>

      <div className={row}>
        <span className={label}>{t("Declarations")}</span>
        <ul className="m-0 list-none p-0">
          {yes(sub.declarations.original, "Not published or under review elsewhere")}
          {yes(sub.declarations.preprint, "An earlier version is on a preprint server")}
          {yes(sub.declarations.student_award, "Considered for the Best Student Paper award")}
        </ul>
      </div>

      <div className={row}>
        <span className={label}>{t("Confirmations")}</span>
        <ul className="m-0 list-none p-0">
          {yes(sub.confirmations.agree, "Agreed to the event's policies")}
          {yes(sub.confirmations.present, "One author will register and present")}
          {sub.confirmations.at ? <li className="text-[13px] text-[#4A5263]">{t("Confirmed on {date}.", { date: when(sub.confirmations.at) })}</li> : null}
        </ul>
      </div>
    </section>
  );
}
