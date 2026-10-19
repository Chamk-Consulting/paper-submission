import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { fmtRange } from "@/lib/venues/time";
import { loadBadgeSheet } from "@/lib/attend/data";
import { badgePayload, qrSvg } from "@/lib/attend/badge";
import { BadgeCard } from "@/components/attend/badge-card";
import { PrintButton } from "@/components/manage/ops2/print-button";
import { Reveal } from "@/components/motion/reveal";
import { BadgeSheetSkeleton } from "@/components/skeletons/attend";

/* BD01 "Print all badges" — A6 badges, two per A4 row when printed. Organizers only. */

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ only?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Badges (print)"), robots: { index: false } };
}

async function Inner({ params, searchParams }: P) {
  const [{ slug }, { only }] = await Promise.all([params, searchParams]);
  const ctx = await requireEvent(slug);
  const t = await getT();
  const all = await loadBadgeSheet(ctx.venue.id);
  const list = only === "unchecked" ? all.filter((b) => !b.checked_in_at) : only === "paid" ? all.filter((b) => b.paid) : all;
  const dates = ctx.venue.starts_on ? fmtRange(ctx.venue.starts_on, ctx.venue.ends_on, t.intl, t) : "";
  const qrs = await Promise.all(list.map((b) => qrSvg(badgePayload(b.id, b.salt))));
  const chip = (k: string | undefined, label: string) => (
    <Link href={`/manage/${slug}/badges${k ? `?only=${k}` : ""}`} aria-current={only === k ? "page" : undefined}
      className={`inline-flex h-[30px] items-center rounded-full border px-3 text-[13px] font-semibold no-underline ${only === k ? "border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#4A5263]"}`}>{label}</Link>
  );
  return (
    <main className="mx-auto max-w-[1180px] px-6 py-8 text-[#121826] print:max-w-none print:p-0">
      <style>{"@page{size:A4;margin:10mm}@media print{body{background:#fff}}"}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/manage/${slug}/checkin`} className="text-[14px]">← {t("Check-in desk")}</Link>
        <PrintButton />
      </div>
      <div className="print:hidden">
        <h1 className="mt-4 font-serif text-[34px] font-normal">{t("Badges")} · {ctx.label}</h1>
        <p className="m-0 text-[14px] text-[#4A5263]">{t("{n} badges · A6, two per A4 row. Each QR checks the person in at the desk.", { n: list.length })}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{chip(undefined, t("Everyone"))}{chip("paid", t("Paid only"))}{chip("unchecked", t("Not checked in yet"))}</div>
      </div>
      {list.length === 0 ? <p className="mt-6 text-[#4A5263]">{t("No registrations yet.")}</p> : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 print:mt-0 print:grid-cols-2 print:gap-[6mm]">
          {list.map((b, i) => <BadgeCard key={b.id} badge={b} qr={qrs[i]} venue={ctx.label} dates={dates} t={t} print />)}
        </div>
      )}
    </main>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<BadgeSheetSkeleton />}><Inner {...props} /></Reveal>;
}
