import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard, AuthSkeleton } from "@/components/ui";
import { SignUpForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create account" };

async function Inner({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthCard
      title="Create your account"
      lead="One account for every event: author, reviewer or organizer."
      footer={<>Already have an account? <Link href={`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-navy underline">Sign in</Link></>}
    >
      <SignUpForm next={next} />
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
