import type { Metadata } from "next";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { SignInPanel } from "@/components/signin/sign-in-panel";
import { OpenCallsPanel } from "@/components/signin/open-calls";
import { createPublicClient } from "@/lib/supabase/public";
import { Footer, TopBar } from "@/components/auth/chrome";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sign in") };
}

type Search = { next?: string; venue?: string; tab?: string };

async function getVenue(slug: string) {
  "use cache";
  cacheLife("minutes");
  const { data } = await createPublicClient().from("venues").select("name, short_name").eq("slug", slug).eq("is_published", true).maybeSingle();
  return data;
}

async function VenueBanner({ searchParams }: { searchParams: Promise<Search> }) {
  const { venue } = await searchParams;
  if (!venue) return null;
  const v = await getVenue(venue);
  if (!v) return null;
  const t = await getT();
  return (
    <div className="mt-7 flex items-start gap-3 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-3 text-[14px] text-[#3B2A07]">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="#8A5A0B" strokeWidth="1.5" className="mt-px flex-none"><circle cx="9" cy="9" r="7" /><path d="M9 5v4l2.5 1.5" /></svg>
      {/* TODO(data): add "Submissions close [date], 23:59 AoE — that's [local time] for you" once submission deadlines exist. */}
      <span>{t("You're signing in to submit to")} <strong>{v.name}</strong>. {t("We'll bring you straight back to your submission.")}</span>
    </div>
  );
}

async function Panel({ searchParams }: { searchParams: Promise<Search> }) {
  const { next, tab } = await searchParams;
  return <SignInPanel next={next} initialTab={tab === "create" ? "create" : "signin"} />;
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
          <Suspense fallback={<div className="h-[640px] w-full max-w-[420px]" aria-busy="true" />}>
            <Panel searchParams={searchParams} />
          </Suspense>
        </div>

        <Footer />
      </main>
      <OpenCallsPanel />
    </div>
  );
}
