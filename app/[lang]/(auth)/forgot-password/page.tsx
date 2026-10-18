import Link from "next/link";
import type { Metadata } from "next";
import { NavyAside, SetupSteps, SplitLayout, ui } from "@/components/auth/split-layout";
import { ForgotForm } from "@/components/reset/forgot-form";
import { ResetShield } from "@/components/reset/reset-shield";

export const metadata: Metadata = { title: "Forgot password" };

/** Canvas PR10-ForgotPassword. */
export default function Page() {
  return (
    <SplitLayout
      aside={
        <NavyAside label="Password reset progress" kicker="Resetting your password" title="Locked out? Let’s get you back in.">
          <SetupSteps
            steps={[
              { title: "Find your account", text: "Email, phone, Plenary ID or alias.", state: "current" },
              { title: "Check your email", text: "A link and a 6-digit code, valid for 15 minutes.", state: "next" },
              { title: "Choose a new password", text: "Then you go straight back to where you were.", state: "next" },
            ]}
          />
          <ResetShield />
        </NavyAside>
      }
    >
      <Link href="/sign-in" className="text-[14px] text-[#2F5FD0] no-underline">← Back to sign in</Link>
      <p className={`mt-4 ${ui.kicker}`}>Step 1 of 3 · Password reset</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>Forgot your password?</h1>
      <p className={`mt-2.5 ${ui.muted}`}>Tell us how you sign in. We&apos;ll email a 6-digit reset code (and a link) to your account email.</p>
      <ForgotForm />
    </SplitLayout>
  );
}
