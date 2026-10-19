import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getVenue } from "@/lib/venues/data";
import { fmtRange } from "@/lib/venues/time";
import { loadMyBadge } from "@/lib/attend/data";
import { badgePayload, qrSvg } from "@/lib/attend/badge";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { BadgeSkeleton } from "@/components/skeletons/attend";
import { BadgeCard } from "@/components/attend/badge-card";
import { PrintBadge, ReissueBadge } from "@/components/attend/badge-actions";

/* Canvas BD01 (attendee side) — my badge with the check-in QR. */

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("My badge"), robots: { index: false } };
}

const card = "rounded-[8px] border border-[#DADDE3] bg-white px-6 py-5";
const kicker = "m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]";

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect(`/sign-in?next=/venues/${slug}/badge`);
  const t = await getT();
  const v = await getVenue(slug);
  if (!v) notFound();
  const venue = v.venue;
  const badge = await loadMyBadge(venue.id);
  const dates = venue.startsOn ? fmtRange(venue.startsOn, venue.endsOn, t.intl, t) : "";

  return (
    <WorkspaceShell ctx={ctx} active="venues">
      <p className="m-0 font-mono text-[12px] text-[#4A5263]"><Link href={`/venues/${slug}/me`} className="text-[#4A5263]">{venue.acr}</Link> · {t("Event day")}</p>
      <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("My badge")}</h1>
      <p className="mt-1.5 text-[#4A5263]">{t("Show this QR code at the check-in desk — no lists, no typing.")}</p>
      {!badge ? (
        <section className={`${card} mt-6 max-w-[640px]`}>
          <h2 className="m-0 text-[17px] font-semibold">{t("You're not registered for this event yet")}</h2>
          <p className="mb-0 mt-1.5 text-[14px] text-[#4A5263]">{t("Your badge appears here once you register.")}</p>
          <Link href={`/venues/${slug}/register`} className="mt-3.5 inline-flex h-10 items-center rounded-[4px] bg-[#F2A93B] px-4 text-[14px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{t("Register to attend")}</Link>
        </section>
      ) : (
        <div className="mt-6 flex flex-wrap items-start gap-6">
          <section className={`${card} flex-[1_1_420px]`}>
            <p className={kicker}>{t("Badge preview")}</p>
            <div className="mt-4"><BadgeCard badge={badge} qr={await qrSvg(badgePayload(badge.id, badge.salt))} venue={venue.acr} dates={dates} t={t} /></div>
            <p className="mb-0 mt-3 max-w-[420px] text-[13px] text-[#4A5263]">{t("The QR holds only a check-in code, not personal data. Lost badge? Reprint it at the desk or show this page on your phone.")}</p>
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5"><PrintBadge /><ReissueBadge slug={slug} id={badge.id} /></div>
          </section>
          <section className={`${card} flex-[1_1_320px]`}>
            <p className={kicker}>{t("At the desk")}</p>
            <dl className="mb-0 mt-2.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[14px]">
              <dt className="text-[#4A5263]">{t("Registration")}</dt><dd className="m-0 font-mono">{badge.number}</dd>
              <dt className="text-[#4A5263]">{t("Ticket")}</dt><dd className="m-0">{t(badge.reg_type)}</dd>
              <dt className="text-[#4A5263]">{t("Payment")}</dt><dd className="m-0">{badge.paid ? t("Paid") : <span className="text-[#7A4508]">{t("Not paid yet — the desk will ask")}</span>}</dd>
              <dt className="text-[#4A5263]">{t("Checked in")}</dt><dd className="m-0">{badge.checked_in_at ? new Date(badge.checked_in_at).toLocaleString(t.intl, { dateStyle: "medium", timeStyle: "short" }) : t("Not yet")}</dd>
            </dl>
            <Link href={`/venues/${slug}/register`} className="mt-3 inline-block text-[14px]">{t("Registration, invoice and receipt")}</Link>
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<BadgeSkeleton />}><Inner {...props} /></Reveal>;
}
