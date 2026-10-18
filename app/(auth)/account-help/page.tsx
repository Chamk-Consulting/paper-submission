import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/components/ui";

export const metadata: Metadata = { title: "Account help" };

const items = [
  { href: "/forgot-password", title: "I forgot my password", body: "Get a reset link by email." },
  { href: "/sign-in", title: "I'm not sure which email I used", body: "Try your institutional and personal addresses; each email belongs to one person." },
  // TODO(auth): AH02 lost email access, AH03 merge accounts, AH06 claim a paper — flows to build.
  { href: "mailto:support@example.invalid", title: "I lost access to my email", body: "Contact support to verify your identity (ORCID, co-author or organizer check)." },
];

export default function Page() {
  return (
    <AuthCard title="Account help" lead="Choose what's going on.">
      <ul className="grid gap-2">
        {items.map((i) => (
          <li key={i.title}>
            <Link href={i.href} className="block rounded-lg border border-line p-3 hover:bg-paper">
              <span className="font-medium text-navy">{i.title}</span>
              <span className="block text-sm text-muted">{i.body}</span>
            </Link>
          </li>
        ))}
      </ul>
      {/* TODO(domain): real support address. */}
    </AuthCard>
  );
}
