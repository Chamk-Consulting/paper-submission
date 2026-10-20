import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NavyAside, SetupSteps, ShieldNote, SplitLayout, ui } from "@/components/auth/split-layout";
import { OtpVerify } from "@/components/auth/otp-verify";
import { safeNext, senderDomain, site } from "@/lib/config/site";
import { AuthAsideSkeleton, AuthFormSkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Confirm your email") };
}
type Search = { email?: string; name?: string; next?: string; venue?: string; wait?: string };

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
      {s.wait ? <p role="status" className="mt-4 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-2.5 text-[14px] text-[#3B2A07]">{t("A code was sent very recently — use the one already in your inbox (check spam too). You can ask for a new one in a minute.")}</p> : null}
      <OtpVerify email={email} onSuccessHref={after} changeHref={back(s)} senderDomain={senderDomain()} />
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
      <ShieldNote><strong className="text-[#F5F6F3]">{t("Plenary staff will never ask for this code.")}</strong> {t("Only enter it on {host}. Didn't sign up? Ignore the email — no account is created without it.", { host: new URL(site.url).host })}</ShieldNote>
    </NavyAside>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <SplitLayout aside={<Suspense fallback={<AuthAsideSkeleton />}><Aside searchParams={searchParams} /></Suspense>}>
      <Suspense fallback={<AuthFormSkeleton />}>
        <Left searchParams={searchParams} />
      </Suspense>
    </SplitLayout>
  );
}
