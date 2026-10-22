import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { NavyAside, SetupSteps, ShieldNote, SplitLayout, ui } from "@/components/auth/split-layout";
import { ProfileForm } from "@/components/auth/profile-form";
import { getMe } from "@/lib/auth/me";
import { suggestFromEmailDomain } from "@/lib/auth/onboarding-actions";
import { countryOptions } from "@/lib/countries";
import { Reveal } from "@/components/motion/reveal";
import { AuthSkeleton } from "@/components/skeletons";
import { signupSteps } from "@/components/auth/signup-steps";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Your research profile") };
}
type Search = { next?: string };

const time = (iso: string | null, intl: string) => (iso ? new Date(iso).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "");

async function Content({ searchParams }: { searchParams: Promise<Search> }) {
  const { next } = await searchParams;
  const [me, supabase] = await Promise.all([getMe(), createClient()]);
  if (!me) redirect("/sign-in?next=/create-account/profile");
  // the confirmation time isn't in the session token; one Auth read for the panel
  const { data: au } = await supabase.auth.getUser();
  const confirmedAt = au.user?.email_confirmed_at ?? null;
  const t = await getT();
  const p = me.person;
  const fullName = p ? (p.paper_name || p.display_name || "").trim() : "";
  const first = p?.given_name?.trim() || "";
  const suggested = me.affiliation ? null : await suggestFromEmailDomain(me.email);
  const initialAff = me.affiliation ? { id: null, name: me.affiliation.institution, place: t("From your sign-up") } : null;

  return (
    <SplitLayout
      width={440}
      aside={
        <NavyAside label={t("Account set-up progress")} kicker={t("Creating your account")} title={first ? t("Last step, {name}.", { name: first }) : t("Last step.")}>
          <SetupSteps doneLabel={t("Done")} steps={signupSteps(t, 4, { 1: [p?.display_name, me.email].filter(Boolean).join(" · "), 2: confirmedAt ? t("Confirmed {time}.", { time: time(confirmedAt, t.intl) }) : t("Confirmed."), 3: t("Saved."), 4: t("Name on papers and affiliation — then you get your Plenary ID and go back to where you started.") })} />
          <ShieldNote><strong className="text-[#F5F6F3]">{t("Your email is never shown to other users.")}</strong> {t("Chairs and co-authors see your name and affiliation. During blind review, reviewers see none of it.")}</ShieldNote>
        </NavyAside>
      }
    >
      <div className="flex items-center gap-2 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3 py-2 text-[14px] text-[#14603F]">
        <span aria-hidden className="font-semibold">✓</span><span><strong>{t("Email confirmed.")}</strong> {me.email}</span>
      </div>
      <p className={`mt-[22px] ${ui.kicker}`}>{t("Step 4 of 4")}</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>{t("Your research profile")}</h1>
      <p className={`mt-2 ${ui.muted}`}>{t("This is how chairs and co-authors will find you. You can change it any time.")}</p>
      {!p ? (
        <p role="alert" className="mt-4 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-3 text-[14px] text-[#3B2A07]">{t("We're still setting up your account record.")} <a href="/auth/continue?next=/create-account/profile" className={ui.link}>{t("Try again")}</a></p>
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
    <Reveal fallback={<AuthSkeleton aside />}>
      <Content searchParams={searchParams} />
    </Reveal>
  );
}
