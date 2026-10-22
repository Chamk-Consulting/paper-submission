import type { Metadata } from "next";
import Link from "@/components/site/link";
import { getT } from "@/lib/i18n/server";
import { ReadingPage } from "@/components/site/reading-page";
import { site } from "@/lib/config/site";
import { ConsentStatus } from "@/components/consent/consent-status";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Cookie policy") };
}

type Row = { name: string; purpose: string; duration: string; who: string };

/** Every cookie and device-storage item Plenary uses, by category. Keep in sync with lib/consent.ts. */
export default async function CookiePolicy() {
  const t = await getT();
  const ref = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0]; } catch { return "<project>"; } })();
  const necessary: Row[] = [
    { name: `sb-${ref}-auth-token`, purpose: t("Keeps you signed in and secures every request you make."), duration: t("Until you sign out (at most 400 days)"), who: "Plenary (Supabase)" },
    { name: "pl_recovery", purpose: t("Proves you confirmed a password-reset code, so only you can set the new password."), duration: t("15 minutes"), who: "Plenary" },
    { name: "pl_consent", purpose: t("Remembers the cookie choice you make here."), duration: t("6 months"), who: "Plenary" },
    { name: t("Offline storage (service worker)"), purpose: t("App files and public pages you opened (venues, deadlines), so Plenary opens fast and works offline. Never your papers, drafts or workspace."), duration: t("Until the next app update or you clear site data"), who: "Plenary" },
  ];
  const preferences: Row[] = [
    { name: "NEXT_LOCALE", purpose: t("Remembers the language you chose."), duration: t("1 year with your consent; otherwise until you close the browser"), who: "Plenary" },
    { name: "plenary.installDismissed", purpose: t("Remembers that you closed the “Install Plenary” invitation."), duration: t("Until you clear site data"), who: t("Plenary (local storage)") },
    { name: "plenary.passkeyOffer", purpose: t("Remembers that you don’t want to be offered a passkey again."), duration: t("Until you clear site data"), who: t("Plenary (local storage)") },
  ];
  const table = (rows: Row[]) => (
    <div className="mt-3 overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
      <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
        <thead className="bg-[#F7F8F6] font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">
          <tr><th className="px-4 py-2.5 font-medium">{t("Name")}</th><th className="px-4 py-2.5 font-medium">{t("Purpose")}</th><th className="px-4 py-2.5 font-medium">{t("Duration")}</th><th className="px-4 py-2.5 font-medium">{t("Set by")}</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-[#EEF0EC] align-top">
              <td className="w-[30%] min-w-[210px] px-4 py-3 font-mono text-[12.5px] [overflow-wrap:anywhere]">{r.name}</td>
              <td className="px-4 py-3">{r.purpose}</td>
              <td className="px-4 py-3 text-[#4A5263]">{r.duration}</td>
              <td className="px-4 py-3 text-[#4A5263]">{r.who}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <ReadingPage kicker={t("Legal")} title={t("Cookie policy")} current="/legal/cookies"
      lead={t("Plenary stores as little as possible on your device. Strictly necessary cookies keep the service working and secure; everything else waits for your OK. We use no advertising, analytics or third-party tracking cookies.")}
      toc={[["necessary", t("Strictly necessary")], ["preferences", t("Preferences")], ["not-used", t("What we don’t use")], ["rights", t("Your rights")]]}>
        <ConsentStatus />

        <h2 id="necessary" className="mt-10 scroll-mt-24 font-serif text-[26px] font-normal">{t("Strictly necessary")}</h2>
        <p className="mt-1 max-w-[64ch] text-[#4A5263]">{t("Always on: the service can’t work without them, so the law doesn’t require consent. We list them so you know exactly what they do.")}</p>
        {table(necessary)}

        <h2 id="preferences" className="mt-10 scroll-mt-24 font-serif text-[26px] font-normal">{t("Preferences")}</h2>
        <p className="mt-1 max-w-[64ch] text-[#4A5263]">{t("Only with your consent. Without it, Plenary still works — it just forgets your language when you close the browser.")}</p>
        {table(preferences)}

        <h2 id="not-used" className="mt-10 scroll-mt-24 font-serif text-[26px] font-normal">{t("What we don’t use")}</h2>
        <p className="mt-1 max-w-[64ch] text-[#4A5263]">{t("No advertising cookies, no analytics or tracking cookies, no social-media pixels. If that ever changes, we will add a category here and ask you first.")}</p>

        <h2 id="rights" className="mt-10 scroll-mt-24 font-serif text-[26px] font-normal">{t("Your rights")}</h2>
        <p className="mt-1 max-w-[64ch] text-[#4A5263]">{t("You can change or withdraw your choice at any time with “Cookie settings” at the bottom of every page, or delete cookies in your browser settings.")}{" "}<Link href="/account-help" className="text-[#2F5FD0]">{t("Questions? Visit the Help centre.")}</Link></p>
        <p className="mt-6 font-mono text-[12px] text-[#4A5263]">{t("Last updated: {date}", { date: "18 October 2026" })} · {site.legalName}</p>
    </ReadingPage>
  );
}
