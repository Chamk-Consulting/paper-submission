import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { Suspense } from "react";
import { NavyAside, SetupSteps, SplitLayout, VenueBannerBox } from "@/components/auth/split-layout";
import { CreateAccountForm } from "@/components/auth/create-account-form";
import { getPublishedVenue } from "@/lib/auth/venue";
import { AuthFormSkeleton } from "@/components/skeletons";
import { signupSteps } from "@/components/auth/signup-steps";

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
  return <CreateAccountForm next={next} venue={venue} withPassword={process.env.SIGNUP_PASSWORD_FIRST === "1"} />;
}

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const t = await getT();
  return (
    <SplitLayout
      banner={<Suspense fallback={null}><Banner searchParams={searchParams} /></Suspense>}
      aside={
        <NavyAside label={t("What happens next")} kicker={t("New to Plenary")} title={t("One account for every venue you’ll ever submit to.")}>
          <SetupSteps doneLabel={t("Done")} steps={signupSteps(t, 1)} />
          <div className="mt-4 grid max-w-[560px] grid-cols-3 gap-4 border-t border-[#24335C] pt-6">
            <div><div className="text-[14px] font-semibold">{t("Your Plenary ID")}</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">{t("Given on day one. Chairs find you with it.")}</div></div>
            <div><div className="text-[14px] font-semibold">{t("Works with ORCID")}</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">{t("Fill in your profile in one click.")}</div></div>
            <div><div className="text-[14px] font-semibold">{t("Safe sign-in")}</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">{t("Only the owner of the inbox can set the password.")}</div></div>
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
