import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard, AuthSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Check your email" };

async function Inner({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <AuthCard
      title="Check your email"
      lead={<>We sent a confirmation link{email ? <> to <strong className="text-ink">{email}</strong></> : null}. It expires in 1 hour.</>}
      footer={<Link href="/sign-in" className="text-navy underline">Back to sign in</Link>}
    >
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        <li>Open the link on any device — you&apos;ll come back here signed in.</li>
        <li>Not there after a few minutes? Check spam or promotions.</li>
        <li>If you already have an account with this email, sign in or reset your password instead.</li>
      </ul>
      {/* TODO(auth): "Resend link" button (supabase.auth.resend) with a 60s cooldown. */}
    </AuthCard>
  );
}

export default function Page(props: { searchParams: Promise<{ email?: string }> }) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <Inner {...props} />
    </Suspense>
  );
}
