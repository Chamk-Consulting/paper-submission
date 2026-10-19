"use client";

import { ResendButton } from "@/components/auth/resend-button";
import { resendConfirmation } from "@/lib/auth/resend-actions";
import { useT } from "@/lib/i18n/client";

/** PR04 on the check-email page: resend the confirmation link (60-second wait, longer after each try). */
export function ResendConfirmation({ email }: { email: string }) {
  const t = useT();
  return <ResendButton send={() => resendConfirmation(email)} label={t("Resend link")} />;
}
