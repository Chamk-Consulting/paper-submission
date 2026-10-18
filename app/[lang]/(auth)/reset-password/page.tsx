import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { Suspense } from "react";
import { NavyAside, SplitLayout, ui } from "@/components/auth/split-layout";
import { NewPasswordFlow } from "@/components/reset/new-password-flow";
import { getUser } from "@/lib/supabase/server";
import { hasRecovery } from "@/lib/auth/recovery-cookie";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Choose a new password") };
}

async function Expired() {
  const t = await getT();
  return (
    <SplitLayout aside={<NavyAside label={t("Password reset progress")} kicker={t("Resetting your password")} title={t("Let’s try that again.")} />}>
      <p className={ui.kicker}>{t("Password reset")}</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>{t("This reset has expired")}</h1>
      <p className={`mt-2.5 ${ui.muted}`}>{t("Reset codes and links last 15 minutes and work once. Ask for a new one and you'll be back here in a minute.")}</p>
      <Link href="/forgot-password" className={`mt-[22px] h-12 ${ui.primary}`}>{t("Send me a new code")}</Link>
      <p className={`mt-[18px] text-[14px] ${ui.muted}`}>{t("Remembered it?")} <Link href="/sign-in" className={ui.link}>{t("Back to sign in")}</Link></p>
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
