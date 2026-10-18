import type { Metadata } from "next";
import { Brand } from "@/components/ui";
import { site } from "@/lib/config/site";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Security") };
}

export default async function Page() {
  const t = await getT();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Brand />
      <h1 className="mt-6 font-serif text-4xl text-navy">{t("Security")}</h1>
      {/* TODO(legal): final text reviewed by counsel; TODO(domain): contact address. */}
      <p className="mt-4 text-muted">{t("Draft — operated by {name}. Final text will be published before launch.", { name: site.legalName })}</p>
    </main>
  );
}
