import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { AuthCard } from "@/components/ui";
import { SupportLine } from "@/components/site/support-line";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Account help") };
}

const items = [
  { href: "/forgot-password", title: "I forgot my password", body: "Get a reset link by email." },
  { href: "/sign-in", title: "I'm not sure which email I used", body: "Try your institutional and personal addresses; each email belongs to one person." },
  { href: "/account-help/lost-email", title: "I lost access to my email", body: "We verify your identity (ORCID, co-author or organizer check) and move the account." },
  { href: "/account-help/merge", title: "I have two accounts", body: "Merge them — papers and reviews move into the one you keep." },
  { href: "/account-help/claim", title: "A paper isn't linked to me", body: "Claim a paper a co-author entered with an old address." },
];

export default async function Page() {
  const t = await getT();
  return (
    <AuthCard title={t("Account help")} lead={t("Choose what's going on.")} footer={<Link href="/contact">{t("Something else? Contact support")}</Link>}>
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
      <SupportLine lead="Still stuck? Write to" />
    </AuthCard>
  );
}
