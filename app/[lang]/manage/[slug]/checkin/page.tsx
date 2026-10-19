import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { createClient } from "@/lib/supabase/server";
import { paperNo } from "@/lib/manage/ops2-time";
import { ManagePage, ui } from "@/components/manage/chrome";
import { CheckInDesk, type DeskRow } from "@/components/manage/ops2/live-desk";
import { DeskScanner } from "@/components/attend/scanner";
import { Reveal } from "@/components/motion/reveal";
import { CheckinSkeleton } from "@/components/skeletons/attend";

/* Canvas BD01 (organizer side) — badges & check-in: scan a badge QR, or search by name when there is no badge. */

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Badges & check-in") };
}

type RawReg = Omit<DeskRow, "papers" | "presents" | "paid"> & { paid_at: string | null; registration_papers: { submissions: { number: number } | null }[] };

async function Inner({ params, searchParams }: P) {
  const [{ slug }, { q: rawQ }] = await Promise.all([params, searchParams]);
  const ctx = await requireEvent(slug);
  const t = await getT();
  const supabase = await createClient();
  const id = ctx.venue.id;
  const q = (rawQ ?? "").replace(/[%,()*\\]/g, " ").trim().slice(0, 80);
  let rows: DeskRow[] = [];
  if (q) {
    const { data } = await supabase.from("registrations")
      .select("id, number, full_name, email, affiliation, reg_type, paid_at, checked_in_at, badges, registration_papers(submissions(number))")
      .eq("venue_id", id).neq("status", "cancelled").or(`full_name.ilike.%${q}%,email.ilike.%${q}%,number.ilike.%${q}%,affiliation.ilike.%${q}%`).order("full_name").limit(15);
    rows = ((data ?? []) as unknown as RawReg[]).map(({ registration_papers, paid_at, ...r }) => ({
      ...r, paid: !!paid_at, presents: null, papers: registration_papers.map((x) => x.submissions?.number).filter((n): n is number => !!n).map(paperNo),
    }));
  }
  const [{ count: registered }, { count: checked }, { count: unpaid }] = await Promise.all([
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("venue_id", id).neq("status", "cancelled"),
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("venue_id", id).not("checked_in_at", "is", null),
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("venue_id", id).neq("status", "cancelled").is("paid_at", null),
  ]);

  return (
    <ManagePage ctx={ctx} active="checkin" crumb={<>{t("Event day")} · {ctx.label}</>} title={t("Badges & check-in")}
      sub={t("Each registered person gets a badge with a QR code. The desk scans it — no lists, no typing.")}
      actions={<>
        <Link href={`/manage/${slug}/live`} className={ui.ghost}>← {t("Event day")}</Link>
        <Link href={`/manage/${slug}/badges`} className={ui.primary}>{t("Print all badges ({n})", { n: registered ?? 0 })}</Link>
      </>}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className={ui.card}><p className={ui.kicker}>{t("Registered")}</p><p className="m-0 mt-1 font-serif text-[30px]">{registered ?? 0}</p></div>
          <div className={ui.card}><p className={ui.kicker}>{t("Checked in")}</p><p className="m-0 mt-1 font-serif text-[30px]">{checked ?? 0}</p></div>
          <div className={ui.card}><p className={ui.kicker}>{t("Not paid yet")}</p><p className="m-0 mt-1 font-serif text-[30px]">{unpaid ?? 0}</p></div>
          <div className={ui.card}><p className={ui.kicker}>{t("Still to arrive")}</p><p className="m-0 mt-1 font-serif text-[30px]">{Math.max(0, (registered ?? 0) - (checked ?? 0))}</p></div>
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <DeskScanner slug={slug} tz={ctx.venue.timezone || "UTC"} initialChecked={checked ?? 0} registered={registered ?? 0} />
          <div className="flex flex-col gap-4">
            <CheckInDesk slug={slug} q={q} rows={rows} />
            <p className={`${ui.hint} m-0`}>{t("The QR holds only a signed check-in code. A badge reissued by its owner makes the old QR stop working.")}</p>
          </div>
        </div>
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<CheckinSkeleton />}><Inner {...props} /></Reveal>;
}
