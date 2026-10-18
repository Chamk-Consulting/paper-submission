import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { AuthCard } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Account help") };
}

const items = [
  { href: "/forgot-password", title: "I forgot my password", body: "Get a reset link by email." },
  { href: "/sign-in", title: "I'm not sure which email I used", body: "Try your institutional and personal addresses; each email belongs to one person." },
  // TODO(auth): AH02 lost email access, AH03 merge accounts, AH06 claim a paper — flows to build.
  { href: "/contact", title: "I lost access to my email", body: "Contact support to verify your identity (ORCID, co-author or organizer check)." },
];

export default async function Page() {
  const t = await getT();
  return (
    <AuthCard title={t("Account help")} lead={t("Choose what's going on.")}>
      <ul className="grid gap-2">
        {items.map((i) => (
          <li key={i.title}>
            <Link href={i.href} className="block rounded-lg border border-line p-3 hover:bg-paper">
              <span className="font-medium text-navy">{t(i.title)}</span>
              <span className="block text-sm text-muted">{t(i.body)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {/* TODO(domain): real support address. */}
    </AuthCard>
  );
}
