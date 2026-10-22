import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getMe } from "@/lib/auth/me";
import { Reveal } from "@/components/motion/reveal";
import { AccountHelpSkeleton } from "@/components/skeletons/admin";
import { HelpBody, HelpPage, helpCard } from "@/components/account-help/frame";
import { ClaimFinder } from "@/components/account-help/forms";
import { ui } from "@/components/manage/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Claim a paper") };
}

async function Inner({ searchParams }: { searchParams: Promise<{ venue?: string }> }) {
  const [{ venue }, t, me] = await Promise.all([searchParams, getT(), getMe()]);
  return (
    <HelpBody t={t} tab="claim">
      {me ? <ClaimFinder defaultVenue={venue ?? ""} /> : (
        <section className={helpCard}>
          <h2 className="m-0 text-[17px] font-semibold">{t("Claim a paper")}</h2>
          <p className="mt-1.5 text-[14px] text-[#4A5263]">{t("Sign in first, so we can link the paper to your account.")}</p>
          <Link href="/sign-in?next=/account-help/claim" className={`${ui.primary} mt-4`}>{t("Sign in")}</Link>
        </section>
      )}
    </HelpBody>
  );
}

/** AH02 — claim a paper a co-author entered with an old address; the corresponding author confirms. */
export default function Page(props: { searchParams: Promise<{ venue?: string }> }) {
  return <HelpPage><Reveal fallback={<AccountHelpSkeleton />}><Inner {...props} /></Reveal></HelpPage>;
}
