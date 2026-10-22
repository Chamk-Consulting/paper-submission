"use client";

import Link from "@/components/site/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowUp, ChevronDown } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n/client";
import { INTL } from "@/lib/i18n/config";
import { CookieSettingsLink } from "@/components/consent/cookie-consent";
import { LanguageSelect } from "@/components/i18n/language-select";
import { useSummary } from "@/components/chrome/summary";
import { barePath } from "@/lib/site/chrome-mode";

/*
 * The one public footer (review 22 Oct): full on marketing/help/legal pages, a slim bar with "More" on venue and
 * program pages, minimal on error-type pages. Live system status, knows whether you're signed in. Not used on sign-in pages, the
 * workspace, the submission wizard or admin.
 */

export type FooterSize = "full" | "compact" | "minimal";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: "Product", links: [["/venues", "Open calls"], ["/organizers", "For organisers"], ["/pricing", "Pricing"], ["/manage/new", "Host a conference"]] },
  { title: "Authors & reviewers", links: [["/venues", "Submit a paper"], ["/help/reviewers", "Reviewer guides"], ["/help", "Help & guides"], ["/contact?topic=import", "Bring your PaperCept history"]] },
  { title: "Support", links: [["/contact", "Contact"], ["/maintenance", "System status"], ["/legal/security", "Security"], ["/legal/accessibility", "Accessibility"]] },
  { title: "Legal", links: [["/legal/privacy", "Privacy"], ["/legal/terms", "Terms"], ["/legal/cookies", "Cookies"]] },
];

const link = "text-[#B9C3DA] no-underline hover:text-white hover:underline";

/* ------------------------------------------------------------------ live status (one fetch per tab) */
type Status = { state: "ok" | "planned" | "maintenance"; startsAt?: string; endsAt?: string };
let statusCache: Status | null = null;
let statusLoad: Promise<Status> | null = null;
function loadStatus(): Promise<Status> {
  if (statusCache) return Promise.resolve(statusCache);
  statusLoad ??= fetch("/api/status").then((r) => (r.ok ? r.json() : { state: "ok" })).catch(() => ({ state: "ok" })).then((s: Status) => (statusCache = s));
  return statusLoad;
}
function useStatus(): Status | null {
  const [s, setS] = useState<Status | null>(statusCache);
  useEffect(() => { let on = true; void loadStatus().then((v) => on && setS(v)); return () => { on = false; }; }, []);
  return s;
}

function StatusPill({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const intl = INTL[useLocale()];
  const s = useStatus();
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(intl, { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "");
  const [dot, text] =
    s?.state === "maintenance" ? ["#E5484D", t("Maintenance in progress")]
    : s?.state === "planned" ? ["#F2A93B", t("Maintenance planned · {when}", { when: when(s.startsAt) })]
    : s ? ["#5FC79A", t("All systems working")]
    : ["#6B7A9C", t("System status")];
  return (
    <Link href="/maintenance" className={`inline-flex items-center gap-2 rounded-full border border-[#2B3D70] px-2.5 py-1 text-[12px] text-[#D6DCEA] no-underline hover:border-[#4A5F99] ${compact ? "" : "mt-4"}`}>
      <span aria-hidden className="size-2 rounded-full" style={{ background: dot }} />
      {text}
    </Link>
  );
}

const noop = () => () => {};
function useTimeZone(): string | null {
  return useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);
}

/* ------------------------------------------------------------------ pieces */
function Brand() {
  const t = useT();
  const s = useSummary();
  return (
    <div className="min-w-0">
      <div className="font-serif text-[24px] leading-none text-[#F5F6F3]">Plenary</div>
      <p className="mb-0 mt-2 max-w-[34ch] text-[13px] leading-[1.55] text-[#B9C3DA]">{t("Conference submission & review, built for researchers.")}</p>
      {s?.signedIn ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
          <Link href="/workspace" className="inline-flex h-9 items-center rounded-[4px] bg-[#F2A93B] px-3.5 font-semibold text-[#0E1B3D] no-underline">{t("My workspace")}</Link>
          {s.plenaryId ? <Link href="/settings/profile#plenary-id" className={`${link} font-mono`}>{s.plenaryId}</Link> : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
          <Link href="/sign-in" className="inline-flex h-9 items-center rounded-[4px] border border-[#4A5F99] px-3.5 font-semibold text-[#F5F6F3] no-underline">{t("Sign in")}</Link>
          <Link href="/create-account" className="inline-flex h-9 items-center rounded-[4px] bg-[#F2A93B] px-3.5 font-semibold text-[#0E1B3D] no-underline">{t("Create account")}</Link>
        </div>
      )}
      <StatusPill />
    </div>
  );
}

function ColumnLinks({ links, legal }: { links: [string, string][]; legal: boolean }) {
  const t = useT();
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
      {links.map(([href, label]) => <li key={label}><Link href={href} className={link}>{t(label)}</Link></li>)}
      {legal ? <li><CookieSettingsLink className={`${link} border-0 bg-transparent p-0 text-left text-[13px]`} /></li> : null}
    </ul>
  );
}

function Columns() {
  const t = useT();
  return (
    <div className="grid gap-8 md:grid-cols-[1.4fr_repeat(4,1fr)]">
      <Brand />
      {COLUMNS.map((c) => (
        <nav key={c.title} aria-label={t(c.title)}>
          {/* desktop: always open */}
          <div className="hidden md:block">
            <h2 className="mb-3 mt-0 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#8F9CC0]">{t(c.title)}</h2>
            <ColumnLinks links={c.links} legal={c.title === "Legal"} />
          </div>
          {/* phone: collapsible */}
          <details className="group border-t border-[#24335C] md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-[#D6DCEA] [&::-webkit-details-marker]:hidden">
              {t(c.title)}
              <ChevronDown aria-hidden size={16} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="pb-3"><ColumnLinks links={c.links} legal={c.title === "Legal"} /></div>
          </details>
        </nav>
      ))}
    </div>
  );
}

function BottomBar() {
  const t = useT();
  const year = new Date().getFullYear();
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-[#24335C] pt-5 text-[12px] text-[#8F9CC0]">
      <span>© {year} Plenary · {t("Data hosted in the EU (Frankfurt) · GDPR")}</span>
      <span className="flex flex-wrap items-center gap-3">
        <LanguageSelect id="footer-lang" tone="dark" />
        <BackToTop />
      </span>
    </div>
  );
}

function BackToTop() {
  const t = useT();
  return (
    <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#4A5F99] bg-transparent px-2.5 text-[13px] text-[#F5F6F3] hover:border-[#8F9CC0]">
      <ArrowUp aria-hidden size={14} />{t("Back to top")}
    </button>
  );
}

/* ------------------------------------------------------------------ the footer */
const MORE_KEY = "plenary:footer-more";
const moreSubs = new Set<() => void>();
let moreMem = false; // used when storage is blocked
function readMore(): boolean {
  try { const v = localStorage.getItem(MORE_KEY); return v === null ? moreMem : v === "1"; } catch { return moreMem; }
}
function writeMore(v: boolean) {
  moreMem = v;
  try { localStorage.setItem(MORE_KEY, v ? "1" : "0"); } catch { /* storage blocked: keep it for this visit */ }
  moreSubs.forEach((f) => f());
}
function subscribeMore(f: () => void) { moreSubs.add(f); return () => { moreSubs.delete(f); }; }

export function SiteFooter({ size = "full" }: { size?: FooterSize }) {
  const t = useT();
  const tz = useTimeZone();
  const more = useSyncExternalStore(subscribeMore, readMore, () => false);
  const toggle = () => writeMore(!more);

  const shell = "mt-auto flex-none bg-[#0E1B3D] text-[#B9C3DA] print:hidden";
  const inner = "mx-auto box-border max-w-[1280px] px-5 sm:px-8";

  if (size === "minimal") {
    return (
      <footer className={shell}>
        <div className={`${inner} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5 text-[13px]`}>
          <StatusPill compact />
          <span className="flex flex-wrap gap-x-[18px] gap-y-2">
            <Link href="/help" className={link}>{t("Help")}</Link>
            <Link href="/contact" className={link}>{t("Contact")}</Link>
            <Link href="/legal/privacy" className={link}>{t("Privacy")}</Link>
            <span className="text-[#8F9CC0]">© {new Date().getFullYear()} Plenary</span>
          </span>
        </div>
      </footer>
    );
  }

  if (size === "compact") {
    return (
      <footer className={shell}>
        <div className={`${inner} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4 text-[13px]`}>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-serif text-[20px] leading-none text-[#F5F6F3]">Plenary</span>
            <StatusPill compact />
            {tz ? <span className="text-[12px] text-[#8F9CC0]">{t("Times shown in your time zone ({tz})", { tz })}</span> : null}
          </span>
          <span className="flex flex-wrap items-center gap-3">
            <LanguageSelect id="footer-lang" tone="dark" />
            <button type="button" onClick={toggle} aria-expanded={more} aria-controls="footer-more"
              className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-[#2B3D70] bg-transparent px-2.5 text-[12px] text-[#D6DCEA] hover:border-[#4A5F99]">
              {more ? t("Less") : t("More")}<ChevronDown aria-hidden size={14} className={more ? "rotate-180" : ""} />
            </button>
          </span>
        </div>
        <div id="footer-more" hidden={!more} className={`${inner} pb-8 pt-2`}>
          <Columns />
          <BottomBar />
        </div>
      </footer>
    );
  }

  return (
    <footer className={shell}>
      <div className={`${inner} pb-8 pt-12`}>
        <Columns />
        <BottomBar />
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ which footer for which page */
const NONE = [/^\/submissions(\/|$)/, /^\/submit(\/|$)/, /^\/admin(\/|$)/];
const MINIMAL = [/^\/expired$/, /^\/no-access$/, /^\/unsubscribe\//, /^\/invite\//];

export function footerFor(p: string): FooterSize | null {
  if (NONE.some((r) => r.test(p))) return null;
  if (MINIMAL.some((r) => r.test(p))) return "minimal";
  return "full"; // event pages (venues, programs) included: the same footer as every other page
}

/** Used by the public layout: picks the footer from the address. */
export function SiteFooterLive() {
  const p = barePath(usePathname() ?? "/");
  // Rendered in the browser only: the footer sits below the fold and depends on the address, the session and the
  // clock; rendering it on the server too caused hydration mismatches on dynamic pages.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return null;
  const size = footerFor(p);
  return size ? <SiteFooter size={size} /> : null;
}
