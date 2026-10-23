import type { Metadata } from "next";
import Link from "@/components/site/link";
import { connection } from "next/server";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { loadPayments } from "@/lib/manage/money-data";
import { ManagePage, ui } from "@/components/manage/chrome";
import { PaymentsBoard } from "@/components/manage/money/payments-board";
import { Reveal } from "@/components/motion/reveal";
import { RegistrationsSkeleton } from "@/components/skeletons/ops2";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Payments") };
}

/** Event settings › Payments: every registration payment of this event. */
async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  await connection();
  const [t, rows] = await Promise.all([getT(), loadPayments(ctx.venue.id)]);
  return (
    <ManagePage ctx={ctx} active="payments" crumb={<>{t("Event settings")} · {ctx.label}</>} title={t("Payments")}
      sub={t("Every registration payment for this event: collected, awaiting payment, free and cancelled.")}
      actions={<>
        <Link href={`/manage/${slug}/invoices`} className={ui.ghost}>{t("Invoices")}</Link>
        <Link href={`/manage/${slug}/registrations`} className={ui.ghost}>{t("Registrations")}</Link>
      </>}>
      <PaymentsBoard slug={slug} rows={rows} />
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<RegistrationsSkeleton />}><Inner {...props} /></Reveal>;
}
