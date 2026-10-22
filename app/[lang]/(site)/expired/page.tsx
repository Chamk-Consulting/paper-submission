import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SystemPage } from "@/components/site/system";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("You were signed out"), robots: { index: false } };
}

/** ER01 "expired": signed out after inactivity. */
export default async function Expired() {
  const t = await getT();
  return (
    <SystemPage icon="⏱" tone="warn" code={t("SIGNED OUT")} title={t("You were signed out")}
      body={t("For your security we sign you out after 12 hours without activity. Your drafts were saved — sign in to carry on where you left off.")}
      primary={{ href: "/sign-in", label: t("Sign in again") }} secondary={{ href: "/", label: t("Home") }} />
  );
}
