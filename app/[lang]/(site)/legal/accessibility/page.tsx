import type { Metadata } from "next";
import { site } from "@/lib/config/site";
import { getT } from "@/lib/i18n/server";
import { ReadingPage } from "@/components/site/reading-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Accessibility") };
}

export default async function Page() {
  const t = await getT();
  return (
    <ReadingPage kicker={t("Legal")} title={t("Accessibility")} current="/legal/accessibility">
        {/* TODO(legal): final text reviewed by counsel. */}
        <p className="mt-4 text-muted">{t("Draft — operated by {name}. Final text will be published before launch.", { name: site.legalName })}</p>
    </ReadingPage>
  );
}
