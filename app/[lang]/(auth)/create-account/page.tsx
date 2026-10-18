import type { Metadata } from "next";
import { Suspense } from "react";
import { NavyAside, SetupSteps, SplitLayout, VenueBannerBox } from "@/components/auth/split-layout";
import { CreateAccountForm } from "@/components/auth/create-account-form";
import { getPublishedVenue } from "@/lib/auth/venue";

export const metadata: Metadata = { title: "Create account" };
type Search = { next?: string; venue?: string };

async function Banner({ searchParams }: { searchParams: Promise<Search> }) {
  const { venue } = await searchParams;
  const v = await getPublishedVenue(venue);
  if (!v) return null;
  return <VenueBannerBox>You&apos;re creating an account to submit to <strong>{v.name}</strong>. We&apos;ll bring you straight back to your submission.</VenueBannerBox>;
}

async function Form({ searchParams }: { searchParams: Promise<Search> }) {
  const { next, venue } = await searchParams;
  return <CreateAccountForm next={next} venue={venue} />;
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <SplitLayout
      banner={<Suspense fallback={null}><Banner searchParams={searchParams} /></Suspense>}
      aside={
        <NavyAside label="What happens next" kicker="New to Plenary" title="One account for every venue you’ll ever submit to.">
          <SetupSteps
            steps={[
              { title: "Your name and email", text: "So co-authors and chairs can find you.", state: "current" },
              { title: "Confirm your email", text: "A 6-digit code, valid for 15 minutes.", state: "next" },
              { title: "Your research profile", text: "Affiliation and ORCID — then you get your Plenary ID.", state: "next" },
            ]}
          />
          <div className="mt-4 grid max-w-[560px] grid-cols-3 gap-4 border-t border-[#24335C] pt-6">
            <div><div className="text-[14px] font-semibold">Your Plenary ID</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">Given on day one. Chairs find you with it.</div></div>
            <div><div className="text-[14px] font-semibold">Works with ORCID</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">Fill in your profile in one click.</div></div>
            <div><div className="text-[14px] font-semibold">No password to forget</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">Email codes or a passkey.</div></div>
          </div>
        </NavyAside>
      }
    >
      <Suspense fallback={<div className="h-[700px]" aria-busy="true" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </SplitLayout>
  );
}
