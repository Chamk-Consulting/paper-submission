import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard, AuthSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Link problem" };

async function Inner({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const oauth = reason === "oauth";
  return (
    <AuthCard
      title={oauth ? "Sign-in didn't complete" : "This link has expired or was already used"}
      lead={oauth ? "The sign-in provider didn't return a valid answer. Please try again." : "Links work once and expire after 1 hour. Request a new one below."}
    >
      <div className="grid gap-2">
        <Link href="/forgot-password" className="rounded-lg border border-line px-4 py-2 text-center text-navy hover:bg-paper">Send a new reset link</Link>
        <Link href="/sign-in" className="rounded-lg bg-navy px-4 py-2 text-center text-white hover:bg-navy-2">Back to sign in</Link>
      </div>
    </AuthCard>
  );
}

export default function Page(props: { searchParams: Promise<{ reason?: string }> }) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <Inner {...props} />
    </Suspense>
  );
}
