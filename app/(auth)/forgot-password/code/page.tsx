import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NavyAside, SetupSteps, SplitLayout, ui } from "@/components/auth/split-layout";
import { OtpVerify } from "@/components/auth/otp-verify";
import { ResetShield } from "@/components/reset/reset-shield";

export const metadata: Metadata = { title: "Enter reset code" };
type Search = { email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function Left({ searchParams }: { searchParams: Promise<Search> }) {
  const email = ((await searchParams).email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) redirect("/forgot-password");
  return (
    <>
      <Link href="/forgot-password" className="text-[14px] text-[#2F5FD0] no-underline">← Back</Link>
      <p className={`mt-4 ${ui.kicker}`}>Step 2 of 3 · Password reset</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>Check your inbox</h1>
      <p className={`mt-2.5 ${ui.muted}`}>
        If there&apos;s a Plenary account for <strong className="text-[#121826]">{email}</strong>, we&apos;ve sent a reset link and code to it.
      </p>
      <OtpVerify kind="recovery" email={email} onSuccessHref="/reset-password" changeHref="/forgot-password" />
    </>
  );
}

async function Aside({ searchParams }: { searchParams: Promise<Search> }) {
  const email = ((await searchParams).email ?? "").trim().toLowerCase().slice(0, 254);
  return (
    <NavyAside label="Password reset progress" kicker="Resetting your password" title="Locked out? Let’s get you back in.">
      <SetupSteps
        steps={[
          { title: "Find your account", text: email || "—", state: "done" },
          { title: "Check your email", text: "Sent · expires in 15 minutes.", state: "current" },
          { title: "Choose a new password", text: "Then you go straight back to where you were.", state: "next" },
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
