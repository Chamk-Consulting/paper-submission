import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { createClient } from "@/lib/supabase/server";
import { ManagePage, ui } from "@/components/manage/chrome";
import { RegistrationsBoard, type RegRow } from "@/components/manage/ops2/registrations-board";
import { Reveal } from "@/components/motion/reveal";
import { RegistrationsSkeleton } from "@/components/skeletons/ops2";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Registrations") };
}

type Raw = Omit<RegRow, "papers"> & { registration_papers: { submissions: { id: string; number: number; title: string } | null }[] };

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("registrations")
    .select("id, number, reg_type, full_name, email, affiliation, covers_papers, paid_at, checked_in_at, source, status, invoice_number, amount_cents, currency, payment_method, registration_papers(submissions(id, number, title))")
    .eq("venue_id", ctx.venue.id).order("number").limit(5000);
  const rows: RegRow[] = ((data ?? []) as unknown as Raw[]).map(({ registration_papers, ...r }) => ({
    ...r, papers: registration_papers.map((x) => x.submissions).filter((x): x is RegRow["papers"][number] => !!x).sort((a, b) => a.number - b.number),
  }));
  return (
    <ManagePage ctx={ctx} active="registrations" crumb={<>{t("Final versions")} · {ctx.label}</>} title={t("Registrations")}
      sub={t("Who is registered, which papers each registration covers, and payment.")}
      actions={<>
        <Link href={`/manage/${slug}/finals`} className={ui.ghost}>← {t("Final versions")}</Link>
        <Link href={`/manage/${slug}/checkin`} className={ui.ghost}>{t("Badges & check-in")}</Link>
      </>}>
      <RegistrationsBoard slug={slug} rows={rows} />
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<RegistrationsSkeleton />}><Inner {...props} /></Reveal>;
}
