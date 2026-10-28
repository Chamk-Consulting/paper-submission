import { Clock } from "lucide-react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInPanel } from "@/components/signin/sign-in-panel";
import { OpenCallsPanel } from "@/components/signin/open-calls";
import { senderDomain } from "@/lib/config/site";
import { venueDeadline, venueSlugFrom } from "@/lib/auth/venue-deadline";
import { LocalDeadline } from "@/components/auth/deadline-bits";
import { getT } from "@/lib/i18n/server";
import { AuthFormSkeleton } from "@/components/skeletons";
import { getSiteFlags } from "@/lib/config/site-flags";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sign in") };
}

type Search = { next?: string; venue?: string; tab?: string; email?: string; error?: string };

async function VenueBanner({ searchParams }: { searchParams: Promise<Search> }) {
  const { venue, next } = await searchParams;
  const t = await getT();
  // Only when they are on their way to submit: badges, schedules and venue pages also send people here.
  const submitting = !!venue || /^\/(?:[a-z]{2}\/)?submit\//.test(next ?? "");
  const v = submitting ? await venueDeadline(venueSlugFrom(next, venue), t.intl) : null;
  if (!v) return null;
  return (
    <div className="mt-7 flex items-start gap-3 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-3 text-[14px] text-[#3B2A07]">
      <Clock size={18} strokeWidth={1.75} color="#8A5A0B" className="mt-px flex-none" aria-hidden />
      <span>
        {t("You're signing in to submit to")} <strong>{v.name}</strong>. {t("We'll bring you straight back to your submission.")}
        {v.iso && v.aoe ? (
          <span className="mt-1 block">
            <strong>{t("{what} close {when}", { what: v.label ?? t("Submissions"), when: v.aoe })}</strong> — {t("that's")} <LocalDeadline iso={v.iso} /> {t("for you")}.
          </span>
        ) : null}
      </span>
    </div>
  );
}

async function Panel({ searchParams }: { searchParams: Promise<Search> }) {
  const { next, tab, email, error } = await searchParams;
  // the old in-panel sign-up form is gone: ?tab=create goes to the real sign-up page
  if (tab === "create") redirect(`/create-account${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  const prefill = typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.trim().toLowerCase().slice(0, 254) : "";
  const flags = await getSiteFlags();
  return <SignInPanel next={next} senderDomain={senderDomain()} initialIdentifier={prefill} codeSignIn={flags.signinEmailCode}
    methods={{ password: flags.signinPassword, passkey: flags.signinPasskey, orcid: flags.signinOrcid, institution: flags.signinInstitution, google: flags.signinGoogle }}
    error={typeof error === "string" ? error.slice(0, 40) : undefined} />;
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <>
      <Suspense fallback={null}>
        <VenueBanner searchParams={searchParams} />
      </Suspense>
      <main id="main-content" className="flex flex-auto items-center justify-center py-8">
        <Suspense fallback={<div className="w-full max-w-[420px]"><AuthFormSkeleton tabs /></div>}>
          <Panel searchParams={searchParams} />
        </Suspense>
      </main>
      <div className="auth-aside"><OpenCallsPanel /></div>
    </>
  );
}
