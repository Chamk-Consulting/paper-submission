import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SystemPage } from "@/components/site/system";
import { SiteHeader } from "@/components/chrome/app-chrome";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Page not found"), robots: { index: false } };
}

/** ER01 — 404. */
export default async function NotFound() {
  const t = await getT();
  return (
    <>
    <SiteHeader />
    <div className="chrome-body">
    <SystemPage icon="?" tone="neutral" code={t("ERROR 404")} title={t("We can’t find that page")}
      body={t("The link may be old, or the venue may have moved its pages. Your work is safe.")}
      primary={{ href: "/events", label: t("Find a venue") }} secondary={{ href: "/workspace", label: t("My workspace") }} footer />
    </div>
    </>
  );
}
