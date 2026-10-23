"use client";
import { UiSync } from "@/components/chrome/ui-sync";
import { Mail, Menu, Plus, Search, X } from "lucide-react";

import { Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";
import { LanguageSelect } from "@/components/i18n/language-select";
import { AccountMenu } from "@/components/workspace/account-menu";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { barePath } from "@/lib/site/chrome-mode";
import { NavList, SideMenu, isOn } from "@/components/chrome/side-nav";
import { WorkspaceLinks } from "@/components/site/workspace-links";
import { refreshSummary, syncAuth, useSummary, type Summary } from "@/components/chrome/summary";

/*
 * One header for the whole site, kept in the root layout so it stays mounted across clicks.
 * Signed-in and signed-out versions are both in the HTML; a tiny script in <head> marks <html data-auth>
 * from the session cookie before the first paint, and CSS shows the right one (no "Sign in" flash).
 * App areas also get the side menu here; phones get the same links in a slide-in menu.
 */

const NAVY = "#0E1B3D";
const PUBLIC_NAV: [string, string][] = [["/venues", "Venues"], ["/organizers", "For organizers"], ["/pricing", "Pricing"], ["/help", "Help"], ["/contact", "Contact"]];
const SIGNED_IN_NAV: [string, string][] = [["/workspace", "My workspace"], ["/workspace/events", "Find events"], ["/workspace/help", "Help"]];

function Count({ n, dark }: { n?: number; dark?: boolean }) {
  if (!n) return null;
  return dark
    ? <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#F2A93B] px-1 text-[11px] font-bold text-[#0E1B3D]">{n > 9 ? "9+" : n}</span>
    : <span className="font-mono text-[12px] text-[#4A5263]">{n}</span>;
}

function Logo({ dark = true }: { dark?: boolean }) {
  const c = dark ? "#F5F6F3" : "#121826";
  return (
    <>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden fill="none" stroke={c} strokeWidth="1.5"><circle cx="11" cy="11" r="9.25" /><path d="M4 11h14M11 2v18" /><circle cx="11" cy="11" r="2.5" fill="#F2A93B" stroke="none" /></svg>
      <span className="font-serif text-[22px]" style={{ color: c }}>Plenary</span>
    </>
  );
}

/* ------------------------------------------------------------------ phone menu */

function useScrollLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [on]);
}

function MobileMenu({ open, onClose, p, s }: { open: boolean; onClose: () => void; p: string; s: Summary | null }) {
  const t = useT();
  const panel = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open) return null;
  const pub = "flex h-11 items-center rounded-[6px] px-3 text-[15px] text-[#121826] no-underline hover:bg-[#F5F6F3]";
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("Menu")}>
      <button type="button" aria-label={t("Close menu")} onClick={onClose} className="absolute inset-0 border-0 bg-[rgba(14,27,61,.45)]" />
      <div ref={panel} className="absolute inset-y-0 right-0 flex w-[min(340px,88vw)] flex-col overflow-y-auto bg-white shadow-[0_0_40px_rgba(18,24,38,.25)]">
        <div className="flex h-[60px] flex-none items-center justify-between px-4" style={{ background: NAVY }}>
          <span className="flex items-center gap-2.5"><Logo /></span>
          <button type="button" onClick={onClose} aria-label={t("Close menu")} className="flex size-10 items-center justify-center rounded-[6px] border border-[#2A3C6E] bg-transparent text-[#F5F6F3]">
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="auth-in flex flex-col gap-0.5 px-3 py-4">
          {s?.name ? (
            <div className="mb-2 rounded-[8px] border border-[#EEF0EC] px-3 py-2.5">
              <div className="truncate font-semibold">{s.name}</div>
              {s.plenaryId ? <Link href="/workspace/account/profile#plenary-id" className="font-mono text-[12px] text-[#2F5FD0] no-underline">{s.plenaryId} · {t("My Plenary ID")}</Link> : null}
            </div>
          ) : null}
          <Link href="/workspace/events?intent=submit" onClick={onClose} className="mb-2 flex h-11 items-center justify-center gap-2 rounded-[4px] bg-[#F2A93B] text-[15px] font-semibold text-[#0E1B3D] no-underline">{t("New submission")}</Link>
          <NavList p={p} s={s} onPick={onClose} />
        </div>
        <div className="auth-out flex flex-col gap-0.5 px-3 py-4">
          {PUBLIC_NAV.map(([href, label]) => (
            <Link key={href} href={href} aria-current={isOn(p, href) ? "page" : undefined} className={`${pub} ${isOn(p, href) ? "bg-[#E6EDFC] font-semibold" : ""}`}>{t(label)}</Link>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-[#EEF0EC] pt-4">
            <Link href={`/sign-in?next=${encodeURIComponent(p)}`} className="flex h-11 items-center justify-center rounded-[4px] border border-[#B7BDC9] text-[15px] font-semibold text-[#121826] no-underline">{t("Sign in")}</Link>
            <Link href="/manage/new" className="flex h-11 items-center justify-center rounded-[4px] bg-[#F2A93B] text-[15px] font-semibold text-[#0E1B3D] no-underline">{t("Host a conference")}</Link>
          </div>
        </div>
        <div className="mt-auto border-t border-[#EEF0EC] px-6 py-4">
          <LanguageSelect id="menu-lang" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ header */

function Header({ p, s, variant, onMenu }: { p: string; s: Summary | null; variant: Variant; onMenu: () => void }) {
  const t = useT();
  const link = (on: boolean) => `py-[19px] text-[14px] font-medium no-underline border-b-2 ${on ? "border-[#F2A93B] text-white" : "border-transparent text-[#D6DCEA] hover:text-white"}`;
  const inner = variant === "site" ? "max-w-[1280px] px-5 sm:px-8" : "hdr-app px-4 sm:px-6";
  return (
    <header className="sticky top-0 z-40 text-[#F5F6F3]" style={{ background: NAVY }}>
      <div className={`mx-auto box-border flex h-[60px] w-full items-center gap-5 ${inner}`}>
        <Link href="/" className="auth-out flex flex-none items-center gap-2.5 no-underline" aria-label={t("Plenary home")}><Logo /></Link>
        <Link href="/workspace" prefetch={null} className="auth-in flex flex-none items-center gap-2.5 no-underline" aria-label={t("My workspace")}><Logo /></Link>

        <nav aria-label={t("Primary")} className="auth-out hidden gap-6 lg:flex">
          {PUBLIC_NAV.map(([href, label]) => <Link key={href} href={href} aria-current={isOn(p, href) ? "page" : undefined} className={link(isOn(p, href))}>{t(label)}</Link>)}
        </nav>
        {variant === "site" ? (
          <nav aria-label={t("Primary")} className="auth-in hidden gap-6 xl:flex">
            {SIGNED_IN_NAV.map(([href, label]) => <Link key={href} href={href} aria-current={isOn(p, href) ? "page" : undefined} className={link(isOn(p, href))}>{t(label)}</Link>)}
          </nav>
        ) : null}

        <form role="search" action="/search" className="auth-in hidden h-[38px] max-w-[520px] flex-[1_1_280px] items-center gap-2 rounded-[6px] border border-[#2A3C6E] bg-[#17285A] pl-3 pr-1.5 md:flex">
          <Search size={16} strokeWidth={1.75} color="#B9C3DA" aria-hidden />
          <label htmlFor="hdr-search" className="sr-only">{t("Search")}</label>
          <input id="hdr-search" name="q" type="search" placeholder={t("Search papers, venues, people")} className="h-9 min-w-0 flex-auto border-0 bg-transparent text-[14px] text-[#F5F6F3] outline-none placeholder:text-[#8F9BBA]" />
        </form>

        <div className="ml-auto flex flex-none items-center gap-2.5 sm:gap-3">
          <LanguageSelect id="hdr-lang" tone="dark" className="hidden lg:inline-flex" />
          <span className="auth-out flex items-center gap-3">
            <Link href={`/sign-in?next=${encodeURIComponent(p === "/" ? "/workspace" : p)}`} className="px-2 py-2.5 text-[14px] font-medium text-[#F5F6F3] no-underline">{t("Sign in")}</Link>
            <Link href="/manage/new" className="hidden sm:inline-flex h-9 items-center rounded-[4px] bg-[#F2A93B] px-3.5 text-[14px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{t("Host a conference")}</Link>
          </span>
          <span className="auth-in flex items-center gap-2.5 sm:gap-3">
            {variant === "site" ? (
              <Link href="/workspace/events?intent=submit" className="hidden h-[38px] items-center gap-2 rounded-[4px] bg-[#F2A93B] px-3.5 text-[14px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26] lg:flex">
                <Plus size={15} strokeWidth={2.25} aria-hidden />{t("New submission")}
              </Link>
            ) : null}
            <Link href="/workspace/inbox" prefetch={null} aria-label={s?.unread ? `${t("Inbox")} · ${s.unread} ${t("unread")}` : t("Inbox")} title={t("Inbox")}
              className="relative box-border flex size-10 items-center justify-center rounded-[6px] border border-[#2A3C6E] no-underline hover:bg-[#17285A]">
              <Mail size={18} strokeWidth={1.75} aria-hidden />
              <Count n={s?.unread} dark />
            </Link>
            <span className="hidden sm:block">
              {s?.signedIn && s.name ? <AccountMenu name={s.name} initials={s.initials ?? "?"} plenaryId={s.plenaryId ?? null} isAdmin={!!s.isAdmin} /> : <span aria-hidden className="sk-dark block size-10 rounded-full!" />}
            </span>
          </span>
          <button type="button" onClick={onMenu} aria-label={t("Menu")} className="flex size-10 items-center justify-center rounded-[6px] border border-[#2A3C6E] bg-transparent text-[#F5F6F3] lg:hidden">
            <Menu size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ exports */

type Variant = "site" | "app";
const noop = () => () => {};

function HeaderBody({ p, variant }: { p: string | null; variant: Variant }) {
  const t = useT();
  const s = useSummary();
  const here = p ?? "";
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  // badges stay fresh in the background as people move around (throttled in the store)
  // signed in or out without a page load? the header catches up on the next page (and badges stay fresh)
  useEffect(() => { void syncAuth(); }, [p]);
  useEffect(() => {
    const onFocus = () => void refreshSummary(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-[4px] focus:bg-white focus:px-3 focus:py-2 focus:text-[#121826]">{t("Skip to content")}</a>
      <Header p={here} s={s} variant={variant} onMenu={() => setMenuFor(here)} />
      {hydrated ? <MobileMenu open={menuFor !== null && menuFor === here} onClose={() => setMenuFor(null)} p={here} s={s} /> : null}
    </>
  );
}
function HeaderLive({ variant }: { variant: Variant }) {
  return <HeaderBody p={barePath(usePathname() ?? "/")} variant={variant} />;
}

/** The one site header. Rendered by the (site) and (app) layouts, so it stays mounted while people click around. */
export function SiteHeader({ variant = "site" }: { variant?: Variant }) {
  return (
    <Suspense fallback={<HeaderBody p={null} variant={variant} />}>
      <HeaderLive variant={variant} />
    </Suspense>
  );
}

function SideMenuLive() {
  const s = useSummary();
  const tab = useSearchParams()?.get("tab") ?? undefined;
  return <SideMenu p={barePath(usePathname() ?? "/")} s={s} tab={tab} />;
}

/** Signed-in areas: the side menu pinned to the left edge, the page centred in the rest (1216 px of content, the same as Events › Explore; organiser pages
 * mark themselves wide with [data-wide-frame] and get 1360 px; pages with their own full-width bands mark [data-bleed]). */
export function AppFrame({ children }: { children: ReactNode }) {
  const s = useSummary();
  return (
    <div className="chrome-body flex min-h-[calc(100dvh-60px)] bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <Suspense fallback={<SideMenu p="" s={s} />}>
        <SideMenuLive />
      </Suspense>
      <main id="main-content" className="app-frame box-border min-w-0 flex-auto px-5 pb-12 pt-7 sm:px-8">
        <div className="frame-box mx-auto w-full max-w-[1216px]"><WorkspaceLinks>{children}</WorkspaceLinks></div>
      </main>
      {s?.signedIn ? <InstallPrompt /> : null}
      {s?.signedIn ? <UiSync /> : null}
    </div>
  );
}
