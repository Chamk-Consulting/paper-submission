import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { NavyAside, SplitLayout, ui } from "@/components/auth/split-layout";
import { CopyIdButton, PasskeyOffer } from "@/components/auth/welcome-client";
import { getMe } from "@/lib/auth/me";
import { safeNext } from "@/lib/config/site";
import { Reveal } from "@/components/motion/reveal";
import { AuthSkeleton } from "@/components/skeletons";
import { venueDeadline, venueSlugFrom } from "@/lib/auth/venue-deadline";
import { Countdown, LocalDeadline } from "@/components/auth/deadline-bits";
import { BadgeDownload } from "@/components/auth/badge-download";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Welcome") };
}
type Search = { next?: string };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

async function Content({ searchParams }: { searchParams: Promise<Search> }) {
  const { next } = await searchParams;
  const me = await getMe();
  if (!me) redirect("/sign-in?next=/welcome");
  const p = me.person;
  if (p && !p.profile_completed_at && "profile_completed_at" in p) redirect("/create-account/profile");

  const name = (p?.paper_name || p?.display_name || me.email).trim();
  const id = p?.plenary_id ?? null;
  const qrSvg = id ? await QRCode.toString(id, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0E1B3D", light: "#FFFFFF" } }) : null;
  const dest = next ? safeNext(next) : "/workspace";
  const hasNext = Boolean(next);
  const t = await getT();
  const venue = await venueDeadline(venueSlugFrom(next), t.intl);

  return (
    <SplitLayout
      width={440}
      aside={
        <NavyAside label={t("What's next")} kicker={t("What’s next")} title={t("Pick up where you started.")} titleSize={40}>
          <div className="mt-7 max-w-[560px] rounded-[10px] border border-[#2B3D70] bg-[#17285A] px-[22px] py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="rounded-[2px] bg-[#E6EDFC] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em] text-[#1F47A8]">{hasNext ? t("YOUR SUBMISSION") : t("OPEN CALLS")}</span>
              {venue?.iso ? <span className="font-mono text-[13px] font-semibold text-[#F2A93B]"><Countdown iso={venue.iso} generatedAt={venue.generatedAt} /></span> : null}
            </div>
            <div className="mt-2.5 font-serif text-[24px] leading-[1.2]">{venue ? venue.name : hasNext ? t("Continue where you left off") : t("Find a venue to submit to")}</div>
            <div className="mt-1 text-[14px] text-[#B9C3DA]">
              {venue?.iso && venue.aoe ? (
                <>{[venue.label, venue.city].filter(Boolean).join(" · ")}{venue.label || venue.city ? " · " : ""}{t("deadline {when}", { when: venue.aoe })}<span className="block">{t("That's")} <LocalDeadline iso={venue.iso} /> {t("for you")}.</span></>
              ) : venue ? t("No upcoming deadline listed — check the venue page.") : hasNext ? t("We’ll take you straight back.") : t("Conferences, workshops and journals with open calls.")}
            </div>
            <Link href={hasNext ? dest : venue ? `/venues/${venue.slug}` : "/venues"} className={`mt-4 h-[46px] ${ui.primary}`}>{hasNext ? t("Start your submission") : venue ? t("Open the venue") : t("Browse open calls")}</Link>
          </div>
          <p className="mb-2.5 mt-7 font-mono text-[11px] uppercase tracking-[0.06em] text-[#B9C3DA]">{t("When you have a minute")}</p>
          <ul className="m-0 flex max-w-[560px] list-none flex-col gap-2 p-0">
            {[
              { href: "/import", label: "Bring your PaperCept history", s: "Past papers and reviews, from your society’s export or ORCID." },
              { href: "/settings/profile", label: "Add your research keywords", s: "So editors invite you to review papers you know." },
              { href: "/workspace", label: "Look around My workspace", s: "Submissions, reviews and messages, all in one list." },
            ].map((x) => (
              <li key={x.label}>
                <Link href={x.href} className="flex justify-between gap-3 rounded-[8px] border border-[#24335C] px-4 py-3 text-[#F5F6F3] no-underline hover:bg-[#13224B]">
                  <span><span className="block font-semibold">{t(x.label)}</span><span className="block text-[13px] text-[#B9C3DA]">{t(x.s)}</span></span>
                  <span aria-hidden className="text-[#D6DCEA]">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </NavyAside>
      }
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-[#B9E0CB] bg-[#E1F3EA] px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.06em] text-[#14603F]">
        <span aria-hidden>✓</span>{t("ACCOUNT READY · 3 OF 3")}
      </div>
      <h1 className={`mt-3.5 ${ui.h1}`}>{t("Welcome to Plenary")}</h1>
      <p className={`mt-2 ${ui.muted}`}>{t("This is your Plenary ID. Share it with co-authors and chairs so they can find you.")}</p>

      <div className="mt-[18px] overflow-hidden rounded-[12px] border border-[#DADDE3] bg-white shadow-[0_1px_2px_rgba(18,24,38,.06),0_8px_24px_rgba(18,24,38,.06)]">
        <div className="h-1.5 bg-[#0E1B3D]" />
        <div className="flex items-center gap-[18px] px-5 py-[18px]">
          <div className="min-w-0 flex-auto">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="flex size-10 flex-none items-center justify-center rounded-full bg-[#E6EDFC] text-[14px] font-semibold text-[#1F47A8]">{initials(name)}</span>
              <div className="min-w-0">
                <div className="truncate text-[16px] font-semibold">{name}</div>
                <div className={`truncate text-[13px] ${ui.muted}`}>{me.affiliation?.institution ?? t("Affiliation not set yet")}</div>
              </div>
            </div>
            <div className={`mt-3.5 font-mono text-[11px] tracking-[0.06em] ${ui.muted}`}>{t("PLENARY ID")}</div>
            <div className="flex flex-wrap items-center gap-2">
              {id ? (
                <>
                  <span className="font-mono text-[22px] font-medium tracking-[0.04em]">{id}</span>
                  <CopyIdButton id={id} />
                </>
              ) : (
                <span className="text-[14px] text-[#7A4508]">{t("Your ID is being issued — refresh in a moment.")}</span>
              )}
            </div>
            {p?.orcid ? <div className={`font-mono text-[12px] ${ui.muted}`}>ORCID {p.orcid}</div> : null}
          </div>
          {qrSvg ? (
            <figure role="img" aria-label={t("QR code for Plenary ID {id}", { id: id ?? "" })} className="m-0 flex-none rounded-[6px] border border-[#DADDE3] bg-white p-1.5 text-center">
              <div className="size-[105px] [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <figcaption className={`mt-1 text-[12px] ${ui.muted}`}>{t("ID only")}</figcaption>
            </figure>
          ) : null}
        </div>
        <div className={`flex flex-wrap justify-between gap-3 border-t border-[#EEF0EC] bg-[#F5F6F3] px-5 py-2.5 text-[12px] ${ui.muted}`}>
          <span>{t("Finds you for co-authors and chairs — never signs you in.")}</span>
          {id && qrSvg ? <BadgeDownload name={name} affiliation={me.affiliation?.institution ?? ""} id={id} orcid={p?.orcid ?? null} qrSvg={qrSvg} /> : null}
        </div>
      </div>

      <PasskeyOffer nextHref={dest} nextLabel={hasNext ? t("Ready to open your submission.") : t("Ready to open your workspace.")} />
    </SplitLayout>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Reveal fallback={<AuthSkeleton />}>
      <Content searchParams={searchParams} />
    </Reveal>
  );
}
