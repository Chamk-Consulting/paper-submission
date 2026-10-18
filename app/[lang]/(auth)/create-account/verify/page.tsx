import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NavyAside, SetupSteps, ShieldNote, SplitLayout, ui } from "@/components/auth/split-layout";
import { OtpVerify } from "@/components/auth/otp-verify";
import { safeNext } from "@/lib/config/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Confirm your email") };
}
type Search = { email?: string; name?: string; next?: string; venue?: string };

function back(s: Search) {
  const q = new URLSearchParams();
  if (s.next) q.set("next", s.next);
  if (s.venue) q.set("venue", s.venue);
  const qs = q.toString();
  return `/create-account${qs ? `?${qs}` : ""}`;
}

async function Left({ searchParams }: { searchParams: Promise<Search> }) {
  const s = await searchParams;
  const email = (s.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/create-account");
  const t = await getT();
  const after = `/create-account/profile${s.next ? `?next=${encodeURIComponent(safeNext(s.next))}` : ""}`;
  return (
    <>
      <Link href={back(s)} className="text-[14px] text-[#2F5FD0] no-underline">← {t("Back")}</Link>
      <p className={`mt-4 ${ui.kicker}`}>{t("Step 2 of 3")}</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>{t("Confirm your email")}</h1>
      <p className={`mt-2.5 ${ui.muted}`}>
        {t("We sent a 6-digit code and a link to")} <strong className="text-[#121826]">{email}</strong>{" "}
        <Link href={back(s)} className={`text-[14px] ${ui.link}`}>{t("Change")}</Link>
      </p>
      <OtpVerify email={email} onSuccessHref={after} changeHref={back(s)} />
    </>
  );
}

async function Aside({ searchParams }: { searchParams: Promise<Search> }) {
  const s = await searchParams;
  const full = (s.name ?? "").trim().slice(0, 120);
  const first = full.split(/\s+/)[0] || "";
  const t = await getT();
  return (
    <NavyAside label={t("Account set-up progress")} kicker={t("Creating your account")} title={first ? t("Nearly done, {name}.", { name: first }) : t("Nearly done.")}>
      <SetupSteps
        doneLabel={t("Done")}
        steps={[
          { title: t("Your name and email"), text: [full, s.email].filter(Boolean).join(" · "), state: "done" },
          { title: t("Confirm your email"), text: t("Code sent · expires in 15 minutes."), state: "current" },
          { title: t("Your research profile"), text: t("Affiliation and ORCID — then you get your Plenary ID and go back to where you started."), state: "next" },
        ]}
      />
      {/* TODO(domain): name the real domain here. */}
      <ShieldNote><strong className="text-[#F5F6F3]">{t("Plenary staff will never ask for this code.")}</strong> {t("Only enter it on this site. Didn't sign up? Ignore the email — no account is created without it.")}</ShieldNote>
    </NavyAside>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <SplitLayout aside={<Suspense fallback={<aside className="flex-[7_1_520px] bg-[#0E1B3D]" />}><Aside searchParams={searchParams} /></Suspense>}>
      <Suspense fallback={<div className="h-[640px]" aria-busy="true" />}>
        <Left searchParams={searchParams} />
      </Suspense>
    </SplitLayout>
  );
}
