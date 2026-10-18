import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { requireEvent, SETUP_GROUPS, type SectionKey } from "@/lib/manage/data";
import { ManagePage, STATUS_DOT, STATUS_LABEL } from "@/components/manage/chrome";
import { ui } from "@/components/manage/ui";
import { Reveal } from "@/components/motion/reveal";
import { Setup1Skeleton } from "@/components/skeletons/setup1";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Setup checklist") };
}

/* EM02 — the 12 setup sections; the first nine must be ready before go-live (D1). */
const ROWS: { key: SectionKey; label: string; desc: string; needed: "open" | "finals" }[] = [
  { key: "basics", label: "Basics & branding", desc: "Name, logo, colours, public page, gallery", needed: "open" },
  { key: "dates", label: "Dates & phases", desc: "All deadlines in AoE, hard or soft", needed: "open" },
  { key: "submission_types", label: "Submission types", desc: "Regular, invited, late-breaking — limits and fees", needed: "open" },
  { key: "submission_form", label: "Submission form", desc: "Fields, keyword list, questions", needed: "open" },
  { key: "pdf_rules", label: "PDF rules", desc: "Pages, fonts, blind check, PDF eXpress", needed: "open" },
  { key: "review", label: "Review setup", desc: "Blind type, reviews per paper, form, bidding, discussion", needed: "open" },
  { key: "committee", label: "Committee", desc: "Chairs, AEs, deputy chair", needed: "open" },
  { key: "conflicts", label: "Conflicts policy", desc: "Co-author and institution windows", needed: "open" },
  { key: "emails", label: "Emails", desc: "Invitations, reminders, decisions", needed: "open" },
  { key: "copyright", label: "Copyright & publishing", desc: "IEEE eCF, Xplore, ISBN", needed: "finals" },
  { key: "registration", label: "Registration & fees", desc: "Fee table, papers per registration", needed: "finals" },
  { key: "program", label: "Program & rooms", desc: "Rooms, tracks, slot lengths", needed: "finals" },
];

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const supabase = await createClient();
  const { data: open } = await supabase.from("venue_dates").select("starts_at").eq("venue_id", ctx.venue.id).eq("key", "submissions_open").maybeSingle();
  const st = (k: SectionKey) => ctx.sections.find((s) => s.key === k);
  const required = ROWS.filter((r) => r.needed === "open");
  const ready = required.filter((r) => st(r.key)?.status === "ready").length;
  const left = required.length - ready;
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString(t.intl, { timeZone: "Etc/GMT+12", ...o });
  const opensAt = open?.starts_at as string | undefined;
  // eslint-disable-next-line react-hooks/purity -- request-time render; "in N days" is computed per request
  const days = opensAt ? Math.ceil((new Date(opensAt).getTime() - Date.now()) / 864e5) : null;
  const live = ctx.venue.status !== "draft";
  const pathOf = (k: SectionKey) => SETUP_GROUPS.find((g) => g.sections.includes(k))?.path ?? "";

  return (
    <ManagePage ctx={ctx} active="setup" crumb={<>{t("Organizer")} · {ctx.label}</>} title={t("Setup checklist")} sub={t("Finish the sections marked “to open”, then run the go-live review.")}>
      <div className="flex flex-col items-start gap-6 xl:flex-row">
        <div className="w-full min-w-0 flex-auto">
          <section className={ui.card}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="m-0 text-[18px] font-semibold">{t("{n} of {total} required sections ready", { n: ready, total: required.length })}</p>
              {opensAt ? (
                <p className="m-0 text-[14px] text-[#4A5263]">
                  {live ? t("Submissions opened") : t("Submissions open")} <strong className="text-[#121826]">{fmt(opensAt, { day: "numeric", month: "short" })}</strong>
                  {!live && days !== null && days >= 0 ? <> · {t("in {n} days", { n: days })}</> : null}
                </p>
              ) : <Link href={`/manage/${slug}/setup/dates`} className="text-[14px]">{t("Set the opening date")}</Link>}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EEF0EC]" role="progressbar" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={ready} aria-label={t("Required sections ready")}>
              <div className="h-full rounded-full bg-[#18744F] transition-[width] duration-500" style={{ width: `${(ready / required.length) * 100}%` }} />
            </div>
          </section>

          <div className="mt-4 overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
            <table className={ui.table}>
              <thead><tr><th className={ui.th}>{t("Section")}</th><th className={ui.th}>{t("Status")}</th><th className={`${ui.th} hidden md:table-cell`}>{t("Last change (K2)")}</th><th className={ui.th}>{t("Needed")}</th></tr></thead>
              <tbody>
                {ROWS.map((r) => {
                  const s = st(r.key);
                  const status = s?.status ?? "not_started";
                  return (
                    <tr key={r.key} className="hover:bg-[#F7F8F6]">
                      <td className={ui.td}>
                        <Link href={`/manage/${slug}/setup/${pathOf(r.key)}`} className="font-semibold text-[#121826] no-underline hover:underline">{t(r.label)}</Link>
                        <span className="block text-[13px] text-[#4A5263]">{t(r.desc)}</span>
                      </td>
                      <td className={`${ui.td} whitespace-nowrap`}><span className="inline-flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-full" style={{ background: STATUS_DOT[status] }} />{t(STATUS_LABEL[status])}</span></td>
                      <td className={`${ui.td} hidden whitespace-nowrap text-[13px] text-[#4A5263] md:table-cell`}>
                        {s?.updatedAt ? <>{s.updatedBy ?? "—"} · {new Date(s.updatedAt).toLocaleDateString(t.intl, { day: "numeric", month: "short" })}</> : "— · —"}
                      </td>
                      <td className={ui.td}>
                        <span className={`${ui.tag} ${r.needed === "open" ? "bg-[#0E1B3D] text-white" : "bg-[#EEF0EC] text-[#4A5263]"}`}>{r.needed === "open" ? t("To open") : t("Before finals")}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[14px] text-[#4A5263]">
              {live ? t("Submissions are open.") : left ? t("{n} required sections left (D1)", { n: left }) : t("All required sections are ready (D1).")}
            </p>
            <Link href={`/manage/${slug}/setup/go-live`} className={left || live ? ui.navy : ui.primary}>{t("Go-live review →")}</Link>
          </div>
        </div>

        <aside className="flex w-full flex-col gap-3.5 xl:w-[280px] xl:flex-none">
          <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[18px] py-4">
            <p className={ui.kicker}>{ctx.locked ? "🔒 " : ""}{t("Locked after opening")}</p>
            <p className="mb-0 mt-2 text-[14px]">{t("Blind type, review score scale and submission types in use lock when submissions open. Changes then need owner approval and a notice to everyone (K3).")}</p>
          </section>
          <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[18px] py-4">
            <p className={ui.kicker}>{t("Rules on this page")}</p>
            <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0">
              {([["D1", "Submissions open only when all required sections are ready and go-live passes."], ["K2", "Each section shows who changed it last."], ["K3", "Some settings lock after opening."]] as const).map(([c, x]) => (
                <li key={c} className="flex gap-2.5 text-[13px]"><span className="flex-none rounded-[3px] bg-[#EEF0EC] px-1.5 font-mono text-[11px] leading-[18px] text-[#4A5263]">{c}</span><span>{t(x)}</span></li>
              ))}
            </ul>
          </section>
          <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[18px] py-4">
            <p className={ui.kicker}>{t("New event?")}</p>
            <Link href="/manage/new" className="mt-2 inline-block text-[14px]">{t("Create another event")}</Link>
          </section>
        </aside>
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<Setup1Skeleton table />}><Inner {...props} /></Reveal>;
}
