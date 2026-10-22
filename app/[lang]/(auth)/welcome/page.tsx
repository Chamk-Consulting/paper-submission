import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { NavyAside, SplitLayout, ui } from "@/components/auth/split-layout";
import { PasskeyOffer } from "@/components/auth/welcome-client";
import { PlenaryIdCard } from "@/components/auth/plenary-id-card";
import { getMe } from "@/lib/auth/me";
import { safeNext } from "@/lib/config/site";
import { Reveal } from "@/components/motion/reveal";
import { AuthSkeleton } from "@/components/skeletons";
import { venueDeadline, venueSlugFrom } from "@/lib/auth/venue-deadline";
import { Countdown, LocalDeadline } from "@/components/auth/deadline-bits";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Welcome") };
}
type Search = { next?: string };

async function Content({ searchParams }: { searchParams: Promise<Search> }) {
  const { next } = await searchParams;
  const me = await getMe();
  if (!me) redirect("/sign-in?next=/welcome");
  const p = me.person;
  if (p && !p.profile_completed_at && "profile_completed_at" in p) redirect("/create-account/profile");

  const name = (p?.paper_name || p?.display_name || me.email).trim();
  const id = p?.plenary_id ?? null;
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
              { href: "/contact?topic=import", label: "Bring your PaperCept history", s: "Past papers and reviews, from your society’s export or ORCID." },
              { href: "/settings/profile", label: "Make your profile complete", s: "ORCID, research keywords, other emails — optional, any time." },
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
        <span aria-hidden>✓</span>{t("ACCOUNT READY · 4 OF 4")}
      </div>
      <h1 className={`mt-3.5 ${ui.h1}`}>{t("Welcome to Plenary")}</h1>
      <p className={`mt-2 ${ui.muted}`}>{t("This is your Plenary ID. Share it with co-authors and chairs so they can find you.")}</p>

      <PlenaryIdCard className="mt-[18px]" name={name} affiliation={me.affiliation?.institution ?? null} id={id} orcid={p?.orcid ?? null} />

      <PasskeyOffer nextHref={dest} nextLabel={hasNext ? t("Ready to open your submission.") : t("Ready to open your workspace.")} />
    </SplitLayout>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Reveal fallback={<AuthSkeleton aside />}>
      <Content searchParams={searchParams} />
    </Reveal>
  );
}
