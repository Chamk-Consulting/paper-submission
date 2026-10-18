import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard, AuthSkeleton } from "@/components/ui";
import { SignInForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

async function Inner({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthCard
      title="Sign in"
      lead="Submit papers, review, and run your events."
      footer={<>New here? <Link href={`/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-navy underline">Create an account</Link></>}
    >
      <SignInForm next={next} />
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
