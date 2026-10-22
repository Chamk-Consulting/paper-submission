import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { AuthCard } from "@/components/ui";
import { AuthSkeleton } from "@/components/skeletons";
import { Reveal } from "@/components/motion/reveal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Link problem") };
}

async function Inner({ searchParams }: { searchParams: Promise<{ reason?: string; ref?: string }> }) {
  const { reason, ref } = await searchParams;
  const oauth = reason === "oauth";
  const t = await getT();
  if (reason === "locked") {
    return (
      <AuthCard title={t("You can’t sign in to this account")} lead={t("It is locked, or it was merged into another account. If you merged it, sign in with the email of the account you kept.")}>
        <div className="grid gap-2">
          <Link href="/contact" className="rounded-lg border border-line px-4 py-2 text-center text-navy hover:bg-paper">{t("Contact support")}</Link>
          <Link href="/sign-in" className="rounded-lg bg-navy px-4 py-2 text-center text-white hover:bg-navy-2">{t("Back to sign in")}</Link>
        </div>
      </AuthCard>
    );
  }
  if (reason === "record") {
    const code = (ref ?? "").replace(/[^A-Z0-9]/gi, "").slice(0, 12).toUpperCase();
    return (
      <AuthCard title={t("We couldn’t finish setting up your account")} lead={t("Your email is confirmed, but your account record wasn’t created. Our team can fix this — write to support and quote the reference below.")}>
        {code ? <p className="mb-3 rounded-[6px] border border-[#DADDE3] bg-white px-3 py-2 text-center font-mono text-[15px]">{t("Reference")} {code}</p> : null}
        <div className="grid gap-2">
          <Link href={`/contact${code ? `?ref=${code}` : ""}`} className="rounded-lg bg-navy px-4 py-2 text-center text-white hover:bg-navy-2">{t("Contact support")}</Link>
          <a href="/auth/continue" className="rounded-lg border border-line px-4 py-2 text-center text-navy hover:bg-paper">{t("Try again")}</a>
        </div>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title={oauth ? t("Sign-in didn't complete") : t("This link has expired or was already used")}
      lead={oauth ? t("The sign-in provider didn't return a valid answer. Please try again.") : t("Links work once and expire after 15 minutes. Request a new one below.")}
    >
      <div className="grid gap-2">
        <Link href="/forgot-password" className="rounded-lg border border-line px-4 py-2 text-center text-navy hover:bg-paper">{t("Send a new reset link")}</Link>
        <Link href="/sign-in" className="rounded-lg bg-navy px-4 py-2 text-center text-white hover:bg-navy-2">{t("Back to sign in")}</Link>
      </div>
    </AuthCard>
  );
}

export default function Page(props: { searchParams: Promise<{ reason?: string; ref?: string }> }) {
  return (
    <Reveal fallback={<AuthSkeleton />}>
      <Inner {...props} />
    </Reveal>
  );
}
