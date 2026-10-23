import type { Metadata } from "next";
import Link from "@/components/site/link";
import { connection } from "next/server";
import { getT } from "@/lib/i18n/server";
import { isPublicSoon } from "@/lib/site/coming-soon";
import { requireEvent } from "@/lib/manage/data";
import { loadBilling } from "@/lib/manage/orgtools-data";
import { ManagePage, ui } from "@/components/manage/chrome";
import { BillingBoard } from "@/components/manage/orgtools/billing-board";
import { Reveal } from "@/components/motion/reveal";
import { BillingSkeleton } from "@/components/skeletons/orgtools";

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ paid?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Billing") };
}

async function Inner({ params, searchParams }: P) {
  const { slug } = await params;
  const { paid } = await searchParams;
  const ctx = await requireEvent(slug, "owner");
  await connection();
  const t = await getT();
  const data = await loadBilling(ctx.venue.id);
  return (
    <ManagePage ctx={ctx} active="billing" crumb={`${ctx.label} · ${t("Owner only")}`} title={t("Billing")}
      sub={t("Plenary is paid per event. Pay by card or by invoice for your university or society.")}
      actions={isPublicSoon("pricing") ? undefined : <Link href="/pricing" className={ui.ghost}>{t("Compare plans")}</Link>}>
      {data ? <BillingBoard slug={slug} data={data} stripeOn={!!process.env.STRIPE_SECRET_KEY} paid={paid === "1"} />
        : <p className={ui.warn}>{t("Billing isn't available yet — the database update for billing hasn't been installed.")}</p>}
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<BillingSkeleton />}><Inner {...props} /></Reveal>;
}
