import Link from "@/components/site/link";
import type { ReactNode } from "react";

export type HelpTab = "lost-email" | "merge" | "claim";
type TT = (k: string, v?: Record<string, string | number>) => string;

export const helpCard = "rounded-[8px] border border-[#DADDE3] bg-white px-6 py-5";
export const helpKicker = "m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]";

/** The three AH02 tabs sit in the shared sign-in frame ((auth)/layout.tsx): navy band, tabs, two columns. */
export function HelpPage({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1200px] flex-auto flex-col pt-6">{children}</div>;
}

export function HelpBody({ t, tab, children, aside }: { t: TT; tab: HelpTab | null; children: ReactNode; aside?: ReactNode }) {
  const tabs: [HelpTab, string][] = [["lost-email", "I lost access to my email"], ["merge", "Merge two accounts"], ["claim", "Claim a paper"]];
  return (
    <>
      <section className="rounded-[10px] bg-[#0E1B3D] text-[#F5F6F3]">
        <div className="px-5 py-6 sm:px-8">
          <nav aria-label={t("Breadcrumb")} className="text-[13px] text-[#B9C3DA]"><Link href="/sign-in" className="text-[#B9C3DA]">{t("Sign in")}</Link> / <Link href="/account-help" className="text-[#B9C3DA]">{t("Account help")}</Link></nav>
          <h1 className="mt-2 font-serif text-[34px] font-normal leading-[1.15] sm:text-[40px]">{t("Get back into your account")}</h1>
          <p className="mt-1 text-[#B9C3DA]">{t("Pick what happened. Every request is checked by a person at Plenary within 2 working days.")}</p>
        </div>
      </section>
      <main id="main-content" className="box-border w-full flex-auto pb-10 pt-6">
        <nav aria-label={t("Account help")} className="flex flex-wrap gap-x-[22px] border-b border-[#DADDE3]">
          {tabs.map(([k, label]) => (
            <Link key={k} href={`/account-help/${k}`} aria-current={tab === k ? "page" : undefined}
              className={`-mb-px border-b-2 py-2.5 text-[15px] no-underline ${tab === k ? "border-[#F2A93B] font-semibold text-[#121826]" : "border-transparent font-medium text-[#4A5263] hover:text-[#121826]"}`}>{t(label)}</Link>
          ))}
        </nav>
        <div className="mt-6 flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-[18px]">{children}</div>
          <aside className="flex flex-[1_1_280px] flex-col gap-4">
            {aside}
            <section className={helpCard}>
              <p className={helpKicker}>{t("What happens next")}</p>
              <ol className="m-0 mt-2.5 pl-[18px] text-[14px] leading-[1.7]">
                <li>{t("You get a reference like SUP-2026-4F2A1.")}</li>
                <li>{t("A person at Plenary checks it — never automatically.")}</li>
                <li>{t("You get an email with the result.")}</li>
              </ol>
            </section>
            <section className={helpCard}>
              <p className={helpKicker}>{t("Other help")}</p>
              <div className="mt-2 flex flex-col gap-1.5 text-[14px]">
                <Link href="/forgot-password">{t("I forgot my password")}</Link>
                <Link href="/sign-in">{t("My sign-in code never arrived")}</Link>
                <Link href="/help">{t("Help & guides")}</Link>
                <Link href="/contact">{t("Contact support")}</Link>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
