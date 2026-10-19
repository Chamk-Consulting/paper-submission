import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInPanel } from "@/components/signin/sign-in-panel";
import { OpenCallsPanel } from "@/components/signin/open-calls";
import { senderDomain } from "@/lib/config/site";
import { venueDeadline, venueSlugFrom } from "@/lib/auth/venue-deadline";
import { LocalDeadline } from "@/components/auth/deadline-bits";
import { Footer, TopBar } from "@/components/auth/chrome";
import { getT } from "@/lib/i18n/server";
import { AuthFormSkeleton } from "@/components/skeletons";
import { Pin } from "@/components/motion/pin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sign in") };
}

type Search = { next?: string; venue?: string; tab?: string };

async function VenueBanner({ searchParams }: { searchParams: Promise<Search> }) {
  const { venue, next } = await searchParams;
  const t = await getT();
  const v = await venueDeadline(venueSlugFrom(next, venue), t.intl);
  if (!v) return null;
  return (
    <div className="mt-7 flex items-start gap-3 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-3 text-[14px] text-[#3B2A07]">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="#8A5A0B" strokeWidth="1.5" className="mt-px flex-none"><circle cx="9" cy="9" r="7" /><path d="M9 5v4l2.5 1.5" /></svg>
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
  const { next, tab } = await searchParams;
  return <SignInPanel next={next} initialTab={tab === "create" ? "create" : "signin"} senderDomain={senderDomain()} />;
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <div className="flex min-h-dvh flex-wrap bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <main className="box-border flex min-w-0 flex-[5_1_440px] flex-col px-5 py-7 sm:px-10">
        <TopBar />

        <Suspense fallback={null}>
          <VenueBanner searchParams={searchParams} />
        </Suspense>

        <div className="flex flex-auto items-center justify-center py-8">
          <Suspense fallback={<div className="w-full max-w-[420px]"><AuthFormSkeleton tabs /></div>}>
            <Panel searchParams={searchParams} />
          </Suspense>
        </div>

        <Footer />
      </main>
      <Pin name="auth-aside" swap><OpenCallsPanel /></Pin>
    </div>
  );
}
