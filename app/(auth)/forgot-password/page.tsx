import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/components/ui";
import { ForgotForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return (
    <AuthCard title="Forgot your password?" lead="Enter your email and we'll send you a reset link."
      footer={<>Lost access to your email? <Link href="/account-help" className="text-navy underline">Get account help</Link></>}>
      <ForgotForm />
    </AuthCard>
  );
}
