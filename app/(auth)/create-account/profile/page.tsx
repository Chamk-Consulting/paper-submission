import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NavyAside, SetupSteps, ShieldNote, SplitLayout, ui } from "@/components/auth/split-layout";
import { ProfileForm } from "@/components/auth/profile-form";
import { getMe } from "@/lib/auth/me";
import { suggestFromEmailDomain } from "@/lib/auth/onboarding-actions";
import { countryOptions } from "@/lib/countries";

export const metadata: Metadata = { title: "Your research profile" };
type Search = { next?: string };

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "");

async function Content({ searchParams }: { searchParams: Promise<Search> }) {
  const { next } = await searchParams;
  const me = await getMe();
  if (!me) redirect("/sign-in?next=/create-account/profile");
  const p = me.person;
  const fullName = p ? (p.paper_name || p.display_name || "").trim() : "";
  const first = p?.given_name?.trim() || "";
  const suggested = me.affiliation ? null : await suggestFromEmailDomain(me.email);
  const initialAff = me.affiliation ? { id: null, name: me.affiliation.institution, place: "From your sign-up" } : null;

  return (
    <SplitLayout
      width={440}
      aside={
        <NavyAside label="Account set-up progress" kicker="Creating your account" title={first ? `Last step, ${first}.` : "Last step."}>
          <SetupSteps
            steps={[
              { title: "Your name and email", text: [p?.display_name, me.email].filter(Boolean).join(" · "), state: "done" },
              { title: "Confirm your email", text: me.confirmedAt ? `Confirmed ${time(me.confirmedAt)}.` : "Confirmed.", state: "done" },
              { title: "Your research profile", text: "Name on papers and affiliation — then you get your Plenary ID and go back to where you started.", state: "current" },
            ]}
          />
          <ShieldNote><strong className="text-[#F5F6F3]">Your email is never shown to other users.</strong> Chairs and co-authors see your name and affiliation. During blind review, reviewers see none of it.</ShieldNote>
        </NavyAside>
      }
    >
      <div className="flex items-center gap-2 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3 py-2 text-[14px] text-[#14603F]">
        <span aria-hidden className="font-semibold">✓</span><span><strong>Email confirmed.</strong> {me.email}</span>
      </div>
      <p className={`mt-[22px] ${ui.kicker}`}>Step 3 of 3</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>Your research profile</h1>
      <p className={`mt-2 ${ui.muted}`}>This is how chairs and co-authors will find you. You can change it any time.</p>
      {!p ? (
        <p role="alert" className="mt-4 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-3 text-[14px] text-[#3B2A07]">We&apos;re still setting up your account record. Refresh in a moment.</p>
      ) : null}
      <ProfileForm
        defaultName={fullName}
        initialScripts={Array.isArray(p?.name_scripts) ? p!.name_scripts! : []}
        suggested={suggested}
        initialAff={initialAff}
        countries={countryOptions("en")}
        initialCountry={p?.country ?? me.affiliation?.country ?? ""}
        next={next}
      />
    </SplitLayout>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
