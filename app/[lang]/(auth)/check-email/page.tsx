import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { AuthCard } from "@/components/ui";
import { AuthSkeleton } from "@/components/skeletons";
import { Reveal } from "@/components/motion/reveal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Check your email") };
}

async function Inner({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const t = await getT();
  return (
    <AuthCard
      title={t("Check your email")}
      lead={<>{t("We sent a confirmation link")}{email ? <> {t("to")} <strong className="text-ink">{email}</strong></> : null}. {t("It expires in 1 hour.")}</>}
      footer={<Link href="/sign-in" className="text-navy underline">{t("Back to sign in")}</Link>}
    >
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        <li>{t("Open the link on any device — you'll come back here signed in.")}</li>
        <li>{t("Not there after a few minutes? Check spam or promotions.")}</li>
        <li>{t("If you already have an account with this email, sign in or reset your password instead.")}</li>
      </ul>
      {/* TODO(auth): "Resend link" button (supabase.auth.resend) with a 60s cooldown. */}
    </AuthCard>
  );
}

export default function Page(props: { searchParams: Promise<{ email?: string }> }) {
  return (
    <Reveal fallback={<AuthSkeleton />}>
      <Inner {...props} />
    </Reveal>
  );
}
