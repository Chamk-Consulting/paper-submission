import { AuthFormSkeleton } from "@/components/skeletons";
import { Suspense } from "react";
import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { NavyAside, SetupSteps, SplitLayout, ui } from "@/components/auth/split-layout";
import { ForgotForm } from "@/components/reset/forgot-form";
import { ResetShield } from "@/components/reset/reset-shield";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Forgot password") };
}

/** Canvas PR10-ForgotPassword. */
async function Prefilled({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <ForgotForm initial={typeof email === "string" ? email.trim().slice(0, 254) : ""} />;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const t = await getT();
  return (
    <SplitLayout showAside={false}
      aside={
        <NavyAside label={t("Password reset progress")} kicker={t("Resetting your password")} title={t("Locked out? Let’s get you back in.")}>
          <SetupSteps
            doneLabel={t("Done")}
            steps={[
              { title: t("Find your account"), text: t("Email or PIN."), state: "current" },
              { title: t("Check your email"), text: t("A link and a code, valid for 15 minutes."), state: "next" },
              { title: t("Choose a new password"), text: t("Then you go straight back to where you were."), state: "next" },
            ]}
          />
          <ResetShield />
        </NavyAside>
      }
    >
      <Link href="/sign-in" className="text-[14px] text-[#2F5FD0] no-underline">{t("← Back to sign in")}</Link>
      <p className={`mt-4 ${ui.kicker}`}>{t("Step 1 of 3 · Password reset")}</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>{t("Forgot your password?")}</h1>
      <p className={`mt-2.5 ${ui.muted}`}>{t("Tell us how you sign in. We'll email a reset code (and a link) to your account email.")}</p>
      <Suspense fallback={<AuthFormSkeleton />}><Prefilled searchParams={searchParams} /></Suspense>
    </SplitLayout>
  );
}
