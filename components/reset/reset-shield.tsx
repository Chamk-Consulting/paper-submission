import { ShieldNote } from "@/components/auth/split-layout";
import { getT } from "@/lib/i18n/server";

export async function ResetShield() {
  const t = await getT();
  return (
    <ShieldNote>
      <strong className="text-[#F5F6F3]">{t("Plenary staff will never ask for your password or code.")}</strong> {t("If you didn’t ask for a reset, ignore the email — your password stays the same.")}
    </ShieldNote>
  );
}
