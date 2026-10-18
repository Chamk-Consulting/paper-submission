import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard, AuthSkeleton } from "@/components/ui";
import { safeNext } from "@/lib/config/site";

export const metadata: Metadata = { title: "Email confirmed" };

async function Inner({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthCard title="Email confirmed" lead="Your account is ready. If co-authors had already added you to papers, they're now linked to your account.">
      <Link href={safeNext(next)} className="block w-full rounded-lg bg-navy px-4 py-2.5 text-center font-medium text-white hover:bg-navy-2">
        Continue
      </Link>
    </AuthCard>
  );
}

export default function Page(props: { searchParams: Promise<{ next?: string }> }) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <Inner {...props} />
    </Suspense>
  );
}
