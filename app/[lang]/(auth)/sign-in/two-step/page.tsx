import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { NavyAside, SplitLayout, ui } from "@/components/auth/split-layout";
import { AuthAsideSkeleton, AuthFormSkeleton } from "@/components/skeletons";
import { createClient } from "@/lib/supabase/server";
import { needsTwoStep } from "@/lib/auth/mfa";
import { safeNext } from "@/lib/config/site";
import { TwoStepForm } from "@/components/auth/two-step-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Two-step sign-in") };
}

type Search = { next?: string };

async function Left({ searchParams }: { searchParams: Promise<Search> }) {
  const next = safeNext((await searchParams).next);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (!(await needsTwoStep(supabase))) redirect(next);
  const t = await getT();
  return (
    <>
      <p className={`mt-4 ${ui.kicker}`}>{t("Step 2 of 2 · Two-step sign-in")}</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>{t("Enter your app code")}</h1>
      <p className={`mt-2.5 ${ui.muted}`}>{t("Open your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) and enter the 6-digit code for Plenary.")}</p>
      <TwoStepForm next={next} />
    </>
  );
}

async function Aside() {
  const t = await getT();
  return (
    <NavyAside label={t("Two-step sign-in")} kicker={t("Your account is protected")} title={t("One more code and you’re in.")}>
      <p className="mt-5 max-w-[46ch] text-[15px] text-[#B9C3DA]">{t("You turned on two-step sign-in, so a password or email code alone can’t open your account. The code changes every 30 seconds.")}</p>
    </NavyAside>
  );
}

/** Two-step sign-in (ST02 authenticator app). */
export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <SplitLayout showAside={false} aside={<Suspense fallback={<AuthAsideSkeleton />}><Aside /></Suspense>}>
      <Suspense fallback={<AuthFormSkeleton />}>
        <Left searchParams={searchParams} />
      </Suspense>
    </SplitLayout>
  );
}
