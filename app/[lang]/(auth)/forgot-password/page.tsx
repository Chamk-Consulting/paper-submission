import Link from "next/link";
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
export default async function Page() {
  const t = await getT();
  return (
    <SplitLayout
      aside={
        <NavyAside label={t("Password reset progress")} kicker={t("Resetting your password")} title={t("Locked out? Let’s get you back in.")}>
          <SetupSteps
            doneLabel={t("Done")}
            steps={[
              { title: t("Find your account"), text: t("Email, phone, Plenary ID or alias."), state: "current" },
              { title: t("Check your email"), text: t("A link and a 6-digit code, valid for 15 minutes."), state: "next" },
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
      <p className={`mt-2.5 ${ui.muted}`}>{t("Tell us how you sign in. We'll email a 6-digit reset code (and a link) to your account email.")}</p>
      <ForgotForm />
    </SplitLayout>
  );
}
