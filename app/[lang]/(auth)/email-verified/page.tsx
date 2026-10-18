import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { AuthCard } from "@/components/ui";
import { AuthSkeleton } from "@/components/skeletons";
import { Reveal } from "@/components/motion/reveal";
import { safeNext } from "@/lib/config/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Email confirmed") };
}

async function Inner({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const t = await getT();
  return (
    <AuthCard title={t("Email confirmed")} lead={t("Your account is ready. If co-authors had already added you to papers, they're now linked to your account.")}>
      <Link href={safeNext(next)} className="block w-full rounded-lg bg-navy px-4 py-2.5 text-center font-medium text-white hover:bg-navy-2">
        {t("Continue")}
      </Link>
    </AuthCard>
  );
}

export default function Page(props: { searchParams: Promise<{ next?: string }> }) {
  return (
    <Reveal fallback={<AuthSkeleton />}>
      <Inner {...props} />
    </Reveal>
  );
}
