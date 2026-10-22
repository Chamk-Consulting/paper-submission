"use client";

import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";
import { useFollows } from "@/components/venues/use-clock";

/** Landing header: "My workspace" for signed-in visitors, "Sign in" otherwise. */
export function LandingAccount({ className }: { className: string }) {
  const t = useT();
  const { signedIn } = useFollows();
  return signedIn
    ? <Link href="/workspace" className={className}>{t("My workspace")}</Link>
    : <Link href="/sign-in" className={className}>{t("Sign in")}</Link>;
}
