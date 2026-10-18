import type { Invitation } from "@/lib/review/data";
import { Tag } from "@/components/review/parts";
import { daysUntil, fmtDayYear, paperNo } from "@/lib/review/shared";
import type { T } from "@/lib/i18n/translate";

const BLIND: Record<string, string> = { double: "DOUBLE-BLIND", single: "SINGLE-BLIND", open: "OPEN REVIEW" };

/** Paper card of RV02 / RV02e: number, blind type, title, keywords, abstract, key facts. */
export function InvitationPaper({ inv, t, intl, now, long = false }: { inv: Invitation; t: T; intl: string; now: number; long?: boolean }) {
  const dueDays = daysUntil(inv.due_at, now);
  const blind = inv.blind_type ?? "double";
  return (
    <section className="rounded-[8px] border border-[#DADDE3] bg-white p-[22px]">
      <div className="flex flex-wrap gap-1.5">
        <Tag tone="n">{paperNo(inv.paper_number)}</Tag>
        <Tag tone="b">{t(BLIND[blind] ?? "DOUBLE-BLIND")}</Tag>
        {inv.paper_type || inv.pages ? <Tag tone="n">{[inv.paper_type?.toUpperCase(), inv.pages ? t("{n} PAGES", { n: inv.pages }) : null].filter(Boolean).join(" · ")}</Tag> : null}
      </div>
      <h2 className="mb-0 mt-3 font-serif text-[24px] font-normal leading-[1.25]">{inv.title}</h2>
      <p className="mb-0 mt-1.5 text-[13px] text-[#4A5263]">
        {blind === "double" ? `${t("Authors are hidden.")} ` : ""}
        {inv.keywords?.length ? `${t("Keywords:")} ${inv.keywords.join(", ")}` : ""}
      </p>
      {inv.abstract ? <p className="mb-0 mt-3 whitespace-pre-line text-[15px] leading-[1.6]">{inv.abstract}</p> : null}
      <dl className="mb-0 mt-4 grid gap-3 border-t border-[#EEF0EC] pt-4 sm:grid-cols-3">
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Review due")}</dt>
          <dd className="m-0 mt-0.5 text-[15px] font-medium">{fmtDayYear(inv.due_at, intl)} · {t("{n} days", { n: Math.max(0, dueDays) })}</dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Reply by")}</dt>
          <dd className="m-0 mt-0.5 text-[15px] font-medium">{fmtDayYear(inv.reply_by, intl)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{long ? t("Length") : t("Venue")}</dt>
          <dd className="m-0 mt-0.5 text-[15px] font-medium">{long ? t("About 2–3 hours") : inv.venue_short ?? inv.venue_name}</dd>
        </div>
      </dl>
    </section>
  );
}
