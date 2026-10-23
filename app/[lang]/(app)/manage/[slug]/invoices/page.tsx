import type { Metadata } from "next";
import Link from "@/components/site/link";
import { connection } from "next/server";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { loadPayments, loadPlatformInvoices } from "@/lib/manage/money-data";
import { ManagePage, ui } from "@/components/manage/chrome";
import { InvoicesBoard } from "@/components/manage/money/invoices-board";
import { Reveal } from "@/components/motion/reveal";
import { RegistrationsSkeleton } from "@/components/skeletons/ops2";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Invoices") };
}

/** Event settings › Invoices: invoices sent to attendees, and the platform's invoices to this event (owner only). */
async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  await connection();
  const [t, rows, platform] = await Promise.all([getT(), loadPayments(ctx.venue.id), loadPlatformInvoices(ctx.venue.id, ctx.isOwner)]);
  return (
    <ManagePage ctx={ctx} active="invoices" crumb={<>{t("Event settings")} · {ctx.label}</>} title={t("Invoices")}
      sub={t("Invoices this event sent to attendees, and the invoices for using Plenary.")}
      actions={<>
        <Link href={`/manage/${slug}/payments`} className={ui.ghost}>{t("Payments")}</Link>
        {ctx.isOwner ? <Link href={`/manage/${slug}/billing`} className={ui.ghost}>{t("Billing")}</Link> : null}
      </>}>
      <InvoicesBoard slug={slug} attendees={rows.filter((r) => r.invoiceNumber)} platform={platform} />
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<RegistrationsSkeleton />}><Inner {...props} /></Reveal>;
}
