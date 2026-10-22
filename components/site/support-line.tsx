import Link from "@/components/site/link";
import { supportAddress } from "@/lib/config/site";
import { getT } from "@/lib/i18n/server";

/** "Questions? Write to support@… or use the contact form" — the address comes from SUPPORT_EMAIL. */
export async function SupportLine({ lead = "Questions about this page? Write to", className = "mt-4 text-[14px] text-[#4A5263]" }: { lead?: string; className?: string }) {
  const t = await getT();
  const s = supportAddress();
  return (
    <p className={className}>
      {t(lead)}{" "}
      {s.email ? <a href={`mailto:${s.email}`} className="text-[#2F5FD0]">{s.email}</a> : <span className="font-mono">{s.label}</span>}{" "}
      {t("or use the")} <Link href="/contact" className="text-[#2F5FD0]">{t("contact form")}</Link>.
    </p>
  );
}
