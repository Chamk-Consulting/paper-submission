import type { ReactNode } from "react";
import Link from "@/components/site/link";
import { getT } from "@/lib/i18n/server";
import { supportAddress } from "@/lib/config/site";

const LEGAL: [string, string][] = [
  ["/legal/privacy", "Privacy"],
  ["/legal/terms", "Terms of use"],
  ["/legal/cookies", "Cookie policy"],
  ["/legal/accessibility", "Accessibility"],
  ["/legal/security", "Security"],
];

/**
 * Reading pages (legal, policies): the same 1280 px frame as every public page, a 760 px text column and a 320 px
 * side panel that stays in view — "On this page", the other legal pages and a help card. On phones the panel
 * moves under the text.
 */
export async function ReadingPage({ kicker, title, lead, toc = [], current, children }: {
  kicker: string; title: string; lead?: ReactNode; toc?: [string, string][]; current?: string; children: ReactNode;
}) {
  const t = await getT();
  const s = supportAddress();
  const card = "rounded-[8px] border border-[#DADDE3] bg-white p-[18px]";
  const h = "m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]";
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.6] text-[#121826]">
      <div className="mx-auto box-border grid w-full max-w-[1280px] flex-auto gap-8 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 max-w-[760px]">
          <p className="m-0 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{kicker}</p>
          <h1 className="mt-2 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{title}</h1>
          {lead ? <div className="mt-3 max-w-[64ch] text-[#4A5263]">{lead}</div> : null}
          {children}
        </main>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[84px] lg:self-start">
          {toc.length ? (
            <nav aria-label={t("On this page")} className={card}>
              <p className={h}>{t("On this page")}</p>
              <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0 text-[14px]">
                {toc.map(([id, label]) => <li key={id}><a href={`#${id}`} className="text-[#2F5FD0] no-underline hover:underline">{label}</a></li>)}
              </ul>
            </nav>
          ) : null}
          <nav aria-label={t("Legal")} className={card}>
            <p className={h}>{t("Legal")}</p>
            <ul className="m-0 mt-2.5 flex list-none flex-col gap-1 p-0 text-[14px]">
              {LEGAL.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} aria-current={current === href ? "page" : undefined}
                    className={`block rounded-[4px] px-2 py-1 no-underline ${current === href ? "bg-[#E6EDFC] font-semibold text-[#0E1B3D]" : "text-[#121826] hover:bg-[#F5F6F3]"}`}>{t(label)}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <section className={card}>
            <p className="m-0 font-semibold">{t("Need help?")}</p>
            <p className="m-0 mt-1 text-[14px] text-[#4A5263]">
              {t("Write to")}{" "}
              {s.email ? <a href={`mailto:${s.email}`} className="text-[#2F5FD0]">{s.email}</a> : <span className="font-mono">{s.label}</span>}{" "}
              {t("or use the contact form — a person replies within 2 working days.")}
            </p>
            <Link href="/contact" className="mt-3 inline-flex h-9 items-center rounded-[4px] bg-[#0E1B3D] px-3.5 text-[14px] font-semibold text-white no-underline">{t("Contact support")}</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
