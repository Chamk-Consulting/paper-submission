import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getMe } from "@/lib/auth/me";
import { Reveal } from "@/components/motion/reveal";
import { AccountHelpSkeleton } from "@/components/skeletons/admin";
import { HelpBody, HelpPage } from "@/components/account-help/frame";
import { LostEmailForm } from "@/components/account-help/forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("I lost access to my email") };
}

async function Inner() {
  const [t, me] = await Promise.all([getT(), getMe()]);
  return (
    <HelpBody t={t} tab="lost-email">
      <LostEmailForm name={me?.person?.display_name ?? ""} email="" />
    </HelpBody>
  );
}

/** AH02 — lost access to the account email: a request a person at Plenary checks (anonymous allowed, rate limited). */
export default function Page() {
  return <HelpPage><Reveal fallback={<AccountHelpSkeleton />}><Inner /></Reveal></HelpPage>;
}
