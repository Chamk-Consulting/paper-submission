import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { NavyAside, SplitLayout, ui } from "@/components/auth/split-layout";
import { NewPasswordFlow } from "@/components/reset/new-password-flow";
import { getUser } from "@/lib/supabase/server";
import { hasRecovery } from "@/lib/auth/recovery-cookie";

export const metadata: Metadata = { title: "Choose a new password" };

function Expired() {
  return (
    <SplitLayout aside={<NavyAside label="Password reset progress" kicker="Resetting your password" title="Let’s try that again." />}>
      <p className={ui.kicker}>Password reset</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>This reset has expired</h1>
      <p className={`mt-2.5 ${ui.muted}`}>Reset codes and links last 15 minutes and work once. Ask for a new one and you&apos;ll be back here in a minute.</p>
      <Link href="/forgot-password" className={`mt-[22px] h-12 ${ui.primary}`}>Send me a new code</Link>
      <p className={`mt-[18px] text-[14px] ${ui.muted}`}>Remembered it? <Link href="/sign-in" className={ui.link}>Back to sign in</Link></p>
    </SplitLayout>
  );
}

async function Inner() {
  // Reached after the PR10b code or the email link (/auth/confirm?type=recovery); both sign the user in
  // and set the short-lived recovery cookie.
  const user = await getUser();
  if (!user?.email || !(await hasRecovery(user.id))) return <Expired />;
  return <NewPasswordFlow email={user.email} acceptedAt="" />;
}

/** Canvas PR11-NewPassword. */
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}>
      <Inner />
    </Suspense>
  );
}
