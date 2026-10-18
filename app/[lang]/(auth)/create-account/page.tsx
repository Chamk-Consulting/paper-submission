import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { Suspense } from "react";
import { NavyAside, SetupSteps, SplitLayout, VenueBannerBox } from "@/components/auth/split-layout";
import { CreateAccountForm } from "@/components/auth/create-account-form";
import { getPublishedVenue } from "@/lib/auth/venue";
import { AuthFormSkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Create account") };
}
type Search = { next?: string; venue?: string };

async function Banner({ searchParams }: { searchParams: Promise<Search> }) {
  const { venue } = await searchParams;
  const v = await getPublishedVenue(venue);
  if (!v) return null;
  const t = await getT();
  return <VenueBannerBox>{t("You're creating an account to submit to")} <strong>{v.name}</strong>. {t("We'll bring you straight back to your submission.")}</VenueBannerBox>;
}

async function Form({ searchParams }: { searchParams: Promise<Search> }) {
  const { next, venue } = await searchParams;
  return <CreateAccountForm next={next} venue={venue} />;
}

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const t = await getT();
  return (
    <SplitLayout
      banner={<Suspense fallback={null}><Banner searchParams={searchParams} /></Suspense>}
      aside={
        <NavyAside label={t("What happens next")} kicker={t("New to Plenary")} title={t("One account for every venue you’ll ever submit to.")}>
          <SetupSteps
            doneLabel={t("Done")}
            steps={[
              { title: t("Your name and email"), text: t("So co-authors and chairs can find you."), state: "current" },
              { title: t("Confirm your email"), text: t("A 6-digit code, valid for 15 minutes."), state: "next" },
              { title: t("Your research profile"), text: t("Affiliation and ORCID — then you get your Plenary ID."), state: "next" },
            ]}
          />
          <div className="mt-4 grid max-w-[560px] grid-cols-3 gap-4 border-t border-[#24335C] pt-6">
            <div><div className="text-[14px] font-semibold">{t("Your Plenary ID")}</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">{t("Given on day one. Chairs find you with it.")}</div></div>
            <div><div className="text-[14px] font-semibold">{t("Works with ORCID")}</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">{t("Fill in your profile in one click.")}</div></div>
            <div><div className="text-[14px] font-semibold">{t("No password to forget")}</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">{t("Email codes or a passkey.")}</div></div>
          </div>
        </NavyAside>
      }
    >
      <Suspense fallback={<AuthFormSkeleton />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </SplitLayout>
  );
}
