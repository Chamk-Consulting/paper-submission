import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { SignInPanel } from "@/components/signin/sign-in-panel";
import { OpenCallsPanel } from "@/components/signin/open-calls";
import { createPublicClient } from "@/lib/supabase/public";

export const metadata: Metadata = { title: "Sign in" };

type Search = { next?: string; venue?: string; tab?: string };

async function getVenue(slug: string) {
  "use cache";
  cacheLife("minutes");
  const { data } = await createPublicClient().from("venues").select("name, short_name").eq("slug", slug).eq("is_published", true).maybeSingle();
  return data;
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-[#121826] no-underline">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden fill="none" stroke="#121826" strokeWidth="1.5">
        <circle cx="11" cy="11" r="9.25" /><path d="M4 11h14M11 2v18" /><circle cx="11" cy="11" r="2.5" fill="#F2A93B" stroke="none" />
      </svg>
      <span className="font-serif text-[24px]">Plenary</span>
    </Link>
  );
}

async function VenueBanner({ searchParams }: { searchParams: Promise<Search> }) {
  const { venue } = await searchParams;
  if (!venue) return null;
  const v = await getVenue(venue);
  if (!v) return null;
  return (
    <div className="mt-7 flex items-start gap-3 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-3 text-[14px] text-[#3B2A07]">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="#8A5A0B" strokeWidth="1.5" className="mt-px flex-none"><circle cx="9" cy="9" r="7" /><path d="M9 5v4l2.5 1.5" /></svg>
      {/* TODO(data): add "Submissions close [date], 23:59 AoE — that's [local time] for you" once submission deadlines exist. */}
      <span>You&apos;re signing in to submit to <strong>{v.name}</strong>. We&apos;ll bring you straight back to your submission.</span>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-4 text-[14px]">
            <label htmlFor="pr-lang" className="sr-only">Language</label>
            {/* TODO(i18n): only English is available for now. */}
            <select id="pr-lang" defaultValue="English" className="h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-2 text-[14px] text-[#121826]">
              <option>English</option>
            </select>
            <Link href="/account-help" className="font-medium text-[#121826] no-underline">Help</Link>
          </div>
        </div>

        <Suspense fallback={null}>
          <VenueBanner searchParams={searchParams} />
        </Suspense>

        <div className="flex flex-auto items-center justify-center py-8">
          <Suspense fallback={<div className="h-[640px] w-full max-w-[420px]" aria-busy="true" />}>
            <Panel searchParams={searchParams} />
          </Suspense>
        </div>

        <div className="flex flex-wrap justify-between gap-3 text-[13px] text-[#4A5263]">
          {/* TODO(ops): link to a real status page. */}
          <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#18744F]" />All systems normal</span>
          <span className="flex flex-wrap gap-4">
            <Link href="/legal/privacy" className="text-[#4A5263]">Privacy</Link>
            <Link href="/legal/terms" className="text-[#4A5263]">Terms</Link>
            <Link href="/legal/accessibility" className="text-[#4A5263]">Accessibility</Link>
            <Link href="/legal/security" className="text-[#4A5263]">Security</Link>
          </span>
        </div>
      </main>
      <OpenCallsPanel />
    </div>
  );
}
