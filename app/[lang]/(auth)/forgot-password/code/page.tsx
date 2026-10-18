import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NavyAside, SetupSteps, SplitLayout, ui } from "@/components/auth/split-layout";
import { OtpVerify } from "@/components/auth/otp-verify";
import { ResetShield } from "@/components/reset/reset-shield";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Enter reset code") };
}
type Search = { email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function Left({ searchParams }: { searchParams: Promise<Search> }) {
  const email = ((await searchParams).email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) redirect("/forgot-password");
  const t = await getT();
  return (
    <>
      <Link href="/forgot-password" className="text-[14px] text-[#2F5FD0] no-underline">{t("← Back")}</Link>
      <p className={`mt-4 ${ui.kicker}`}>{t("Step 2 of 3 · Password reset")}</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>{t("Check your inbox")}</h1>
      <p className={`mt-2.5 ${ui.muted}`}>
        {t("If there's a Plenary account for")} <strong className="text-[#121826]">{email}</strong>, {t("we've sent a reset link and code to it.")}
      </p>
      <OtpVerify kind="recovery" email={email} onSuccessHref="/reset-password" changeHref="/forgot-password" />
    </>
  );
}

async function Aside({ searchParams }: { searchParams: Promise<Search> }) {
  const email = ((await searchParams).email ?? "").trim().toLowerCase().slice(0, 254);
  const t = await getT();
  return (
    <NavyAside label={t("Password reset progress")} kicker={t("Resetting your password")} title={t("Locked out? Let’s get you back in.")}>
      <SetupSteps
        doneLabel={t("Done")}
        steps={[
          { title: t("Find your account"), text: email || "—", state: "done" },
          { title: t("Check your email"), text: t("Sent · expires in 15 minutes."), state: "current" },
          { title: t("Choose a new password"), text: t("Then you go straight back to where you were."), state: "next" },
        ]}
      />
      <ResetShield />
    </NavyAside>
  );
}

/** Canvas PR10b-ResetCode. */
export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <SplitLayout aside={<Suspense fallback={<aside className="flex-[7_1_520px] bg-[#0E1B3D]" />}><Aside searchParams={searchParams} /></Suspense>}>
      <Suspense fallback={<div className="h-[640px]" aria-busy="true" />}>
        <Left searchParams={searchParams} />
      </Suspense>
    </SplitLayout>
  );
}
