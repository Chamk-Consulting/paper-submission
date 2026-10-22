import type { Metadata } from "next";
import Link from "@/components/site/link";
import { Brand } from "@/components/ui";
import { site } from "@/lib/config/site";
import { getT } from "@/lib/i18n/server";
import { SupportLine } from "@/components/site/support-line";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Privacy & cookies") };
}

export default async function Page() {
  const t = await getT();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Brand />
      <h1 className="mt-6 font-serif text-4xl text-navy">{t("Privacy & cookies")}</h1>
      {/* TODO(legal): final text reviewed by counsel. */}
      <p className="mt-4 text-muted">{t("Draft — operated by {name}. Final text will be published before launch.", { name: site.legalName })}</p>
      <p className="mt-4">{t("The cookies and device storage we use, and how to change your choice, are listed in the cookie policy.")} <Link href="/legal/cookies" className="text-[#2F5FD0]">{t("Cookie policy")}</Link></p>
      <SupportLine />
    </main>
  );
}
