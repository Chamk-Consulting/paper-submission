import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthCard, AuthSkeleton } from "@/components/ui";
import { ResetForm } from "@/components/auth-forms";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password" };

async function Inner() {
  // Reached through the recovery link (/auth/confirm?type=recovery), which signs the user in.
  const user = await getUser();
  if (!user) redirect("/auth-error?reason=link");
  return (
    <AuthCard title="Choose a new password" lead="You'll be signed out on your other devices.">
      <ResetForm />
    </AuthCard>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <Inner />
    </Suspense>
  );
}
