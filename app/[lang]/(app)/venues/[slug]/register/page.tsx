import Link from "@/components/site/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getVenue } from "@/lib/venues/data";
import { fmtRange } from "@/lib/venues/time";
import { loadRegistrationOptions } from "@/lib/attend/data";
import { cardReady } from "@/lib/attend/stripe";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { RegisterSkeleton } from "@/components/skeletons/attend";
import { RegisterForm } from "@/components/attend/register-form";
import { RegisterStatus } from "@/components/attend/register-status";

/* Canvas RG01 — register to attend: ticket, papers covered, extras, invoice details, pay. */

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ done?: string; card?: string; paper?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const t = await getT();
  const { slug } = await params;
  const v = await getVenue(slug);
  return { title: v ? `${v.venue.acr} · ${t("Register to attend")}` : t("Register to attend"), robots: { index: false } };
}

const CARD_NOTE: Record<string, string> = {
  paid: "Card payment received. Thank you!",
  pending: "Your card payment is still being processed. This page updates when it's confirmed.",
  cancelled: "Card payment was cancelled. Your registration is still reserved.",
  error: "We couldn't confirm the card payment. If you were charged, contact the organizers.",
};

async function Inner({ params, searchParams }: P) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect(`/sign-in?next=${encodeURIComponent(`/venues/${slug}/register${sp.paper ? `?paper=${sp.paper}` : ""}`)}`);
  const t = await getT();
  const v = await getVenue(slug);
  if (!v) notFound();
  const venue = v.venue;
  const opts = await loadRegistrationOptions(venue.id);
  if (!opts) notFound();
  const AOE = "Etc/GMT+12";
  const early = opts.early_until ? new Date(opts.early_until).toLocaleDateString(t.intl, { day: "numeric", month: "short", year: "numeric", timeZone: AOE }) : null;
  const when = [venue.city ?? venue.location, venue.startsOn ? fmtRange(venue.startsOn, venue.endsOn, t.intl, t) : null].filter(Boolean).join(" · ");
  const card = cardReady();

  return (
    <WorkspaceShell ctx={ctx} active="venues">
      <p className="m-0 font-mono text-[12px] text-[#4A5263]"><Link href={`/venues/${slug}/me`} className="text-[#4A5263]">{venue.acr}</Link>{when ? ` · ${when}` : ""}</p>
      <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{opts.mine ? t("Your registration") : t("Register to attend")}</h1>
      <p className="mt-1.5 text-[#4A5263]">
        {t("One full registration covers up to {n} papers you present.", { n: opts.papers_per_registration })}
        {early ? ` ${opts.is_early ? t("Early rate until {date}, 23:59 AoE.", { date: early }) : t("The early rate ended on {date}.", { date: early })}` : ""}
      </p>
      {opts.mine
        ? <RegisterStatus slug={slug} reg={opts.mine} justDone={sp.done === "1"} cardReady={card} cardNote={sp.card ? CARD_NOTE[sp.card] ?? null : null} />
        : <RegisterForm slug={slug} venueId={venue.id} opts={opts} cardReady={card} preselect={sp.paper && /^[0-9a-f-]{36}$/i.test(sp.paper) ? sp.paper : null} />}
    </WorkspaceShell>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<RegisterSkeleton />}><Inner {...props} /></Reveal>;
}
