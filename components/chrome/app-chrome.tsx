"use client";

import { Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";
import { LanguageSelect } from "@/components/i18n/language-select";
import { AccountMenu } from "@/components/workspace/account-menu";
import { CookieSettingsLink } from "@/components/consent/cookie-consent";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { barePath, manageSlug } from "@/lib/site/chrome-mode";
import { ORGANIZER_NAV, OWNER_ONLY } from "@/lib/site/organizer-nav";
import { refreshSummary, useSummary, type Summary, type VenueRef } from "@/components/chrome/summary";
import { useEventHint } from "@/components/chrome/event-hint";

/*
 * One header for the whole site, kept in the root layout so it stays mounted across clicks.
 * Signed-in and signed-out versions are both in the HTML; a tiny script in <head> marks <html data-auth>
 * from the session cookie before the first paint, and CSS shows the right one (no "Sign in" flash).
 * App areas also get the side menu here; phones get the same links in a slide-in menu.
 */

const NAVY = "#0E1B3D";
const VENUE_COLORS = ["#2F5FD0", "#A8600F", "#18744F", "#6B4FBF", "#B3261E"];

type Item = { key: string; href: string; label: string; icon: ReactNode; badge?: "subs" | "unread" };
const ICON = {
  home: <path d="M2 7l6-5 6 5v7H2z" />,
  paper: <><path d="M4 1.5h5.5L13 5v9.5H4z" /><path d="M9 1.5V5h4" /></>,
  pen: <path d="M2 13.5l1-3.5 7.5-7.5 2.5 2.5L5.5 12.5z" />,
  cal: <><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" /></>,
  globe: <><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" /></>,
  mail: <><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" /><path d="M2 4.5l6 4.5 6-4.5" /></>,
};
const APP_NAV: Item[] = [
  { key: "home", href: "/workspace", label: "Home", icon: ICON.home },
  { key: "submissions", href: "/workspace/submissions", label: "My submissions", icon: ICON.paper, badge: "subs" },
  { key: "reviews", href: "/reviews", label: "Reviews", icon: ICON.pen },
  { key: "sessions", href: "/chair", label: "Sessions I chair", icon: ICON.cal },
  { key: "venues", href: "/venues", label: "Browse venues", icon: ICON.globe },
  { key: "inbox", href: "/inbox", label: "Inbox", icon: ICON.mail, badge: "unread" },
];
const PUBLIC_NAV: [string, string][] = [["/venues", "Venues"], ["/organizers", "For organizers"], ["/pricing", "Pricing"], ["/help", "Help"], ["/contact", "Contact"]];
const SIGNED_IN_NAV: [string, string][] = [["/workspace", "My workspace"], ["/venues", "Venues"], ["/help", "Help"]];

function activeKey(p: string): string {
  if (p === "/workspace") return "home";
  if (p.startsWith("/workspace/submissions") || p.startsWith("/submissions/")) return "submissions";
  if (p.startsWith("/reviews")) return "reviews";
  if (p.startsWith("/chair")) return "sessions";
  if (p.startsWith("/inbox")) return "inbox";
  if (p.startsWith("/settings")) return "settings";
  if (p === "/manage/roles") return "m:roles";
  return "";
}
const isOn = (p: string, href: string) => p === href || (href !== "/" && p.startsWith(`${href}/`));

/** Organiser block for the event in the URL (or the first event the person runs). */
function useOrganizer(p: string, s: Summary | null) {
  const hint = useEventHint();
  const slug = manageSlug(p) ?? s?.organizerOf ?? null;
  if (!slug) return null;
  const v: VenueRef | undefined = s?.venues?.find((x) => x.slug === slug);
  const name = hint?.slug === slug ? hint.name : v ? v.shortName ?? v.name : manageSlug(p) ? slug : null;
  if (!name) return null;
  const roleLabel = hint?.slug === slug ? hint.roleLabel : v?.roles.includes("owner") ? "Owner" : "Chair";
  const items = ORGANIZER_NAV.filter(([k]) => !OWNER_ONLY.has(k) || /owner/i.test(roleLabel)).map(([k, l, path]) => ({
    key: k, label: l, href: path.startsWith("@") ? path.slice(1) : `/manage/${slug}${path}`,
  }));
  // longest matching link wins (Setup vs Setup › Committee)
  const on = items.filter((i) => isOn(p, i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.key ?? null;
  return { slug, name, roleLabel, items, on };
}

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

/* ------------------------------------------------------------------ side menu (app areas, md and up) */

function NavList({ p, s, onPick }: { p: string; s: Summary | null; onPick?: () => void }) {
  const t = useT();
  const key = activeKey(p);
  const org = useOrganizer(p, s);
  const row = (on: boolean) => `flex h-10 items-center justify-between rounded-[6px] px-3 text-[14px] no-underline ${on ? "bg-[#E6EDFC] font-semibold text-[#0E1B3D]" : "text-[#121826] hover:bg-[#F5F6F3]"}`;
  return (
    <>
      {APP_NAV.map((i) => (
        <Link key={i.key} href={i.href} prefetch={null} onClick={onPick} aria-current={key === i.key ? "page" : undefined} className={row(key === i.key)}>
          <span className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">{i.icon}</svg>
            {t(i.label)}
          </span>
          <Count n={i.badge === "subs" ? s?.submissionCount : i.badge === "unread" ? s?.unread : undefined} />
        </Link>
      ))}
      {s?.venues?.length ? (
        <>
          <div className="mx-3 mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Your venues")}</div>
          {s.venues.map((v, i) => {
            const href = `/venues/${v.slug}/me`;
            const on = p.startsWith(`/venues/${v.slug}/`);
            return (
              <Link key={v.slug} href={href} onClick={onPick} aria-current={on ? "page" : undefined} className={`flex h-9 items-center gap-2.5 rounded-[6px] px-3 text-[14px] no-underline ${on ? "bg-[#E6EDFC] font-semibold text-[#0E1B3D]" : "text-[#121826] hover:bg-[#F5F6F3]"}`}>
                <span className="size-2 flex-none rounded-[2px]" style={{ background: VENUE_COLORS[i % VENUE_COLORS.length] }} />
                <span className="truncate">{v.name}</span>
              </Link>
            );
          })}
        </>
      ) : null}
      {org ? (
        <>
          <div className="mx-3 mb-2 mt-4 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Organizer")}</span>
            <span className="rounded-[3px] bg-[#0E1B3D] px-1.5 py-px font-mono text-[10px] uppercase text-[#F2A93B]">{t(org.roleLabel)}</span>
          </div>
          <div className="truncate px-3 pb-1 text-[12px] text-[#4A5263]">{org.name}</div>
          {org.items.map((i) => (
            <Link key={i.key} href={i.href} onClick={onPick} aria-current={org.on === i.key || key === `m:${i.key}` ? "page" : undefined}
              className={`flex h-[34px] items-center rounded-[6px] px-3 text-[14px] no-underline ${org.on === i.key || key === `m:${i.key}` ? "bg-[#E6EDFC] font-semibold text-[#0E1B3D]" : "text-[#121826] hover:bg-[#F5F6F3]"}`}>{t(i.label)}</Link>
          ))}
        </>
      ) : null}
    </>
  );
}

function SideMenu({ p, s, edge }: { p: string; s: Summary | null; edge: string }) {
  const t = useT();
  const settingsOn = activeKey(p) === "settings";
  return (
    <nav aria-label={t("Workspace")} className={`sticky top-[60px] box-border hidden max-h-[calc(100dvh-60px)] w-[232px] flex-none flex-col gap-0.5 self-start overflow-y-auto border-r border-[#DADDE3] bg-white px-3 py-5 md:flex md:min-h-[calc(100dvh-60px)] ${edge}`}>
      <NavList p={p} s={s} />
      <div className="mt-auto flex flex-col gap-0.5 border-t border-[#DADDE3] pt-4">
        <Link href="/settings/profile" aria-current={settingsOn ? "page" : undefined} className={`flex h-9 items-center rounded-[6px] px-3 text-[14px] no-underline hover:bg-[#F5F6F3] ${settingsOn ? "bg-[#E6EDFC] font-semibold text-[#0E1B3D]" : "text-[#4A5263]"}`}>{t("Settings")}</Link>
        <Link href="/help" className="flex h-9 items-center rounded-[6px] px-3 text-[14px] text-[#4A5263] no-underline hover:bg-[#F5F6F3]">{t("Help & guides")}</Link>
        <CookieSettingsLink className="flex h-9 items-center rounded-[6px] px-3 text-left text-[14px] text-[#4A5263] hover:bg-[#F5F6F3] hover:no-underline" />
      </div>
    </nav>
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
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>
        <div className="auth-in flex flex-col gap-0.5 px-3 py-4">
          {s?.name ? (
            <div className="mb-2 rounded-[8px] border border-[#EEF0EC] px-3 py-2.5">
              <div className="truncate font-semibold">{s.name}</div>
              {s.plenaryId ? <div className="font-mono text-[12px] text-[#4A5263]">{s.plenaryId}</div> : null}
            </div>
          ) : null}
          <Link href="/venues" className="mb-2 flex h-11 items-center justify-center gap-2 rounded-[4px] bg-[#F2A93B] text-[15px] font-semibold text-[#0E1B3D] no-underline">{t("New submission")}</Link>
          <NavList p={p} s={s} />
          <div className="mt-3 border-t border-[#EEF0EC] pt-3">
            <Link href="/settings/profile" className={pub}>{t("Settings")}</Link>
            <Link href="/help" className={pub}>{t("Help & guides")}</Link>
            <Link href="/contact" className={pub}>{t("Contact")}</Link>
            {s?.isAdmin ? <Link href="/admin" className={pub}>{t("Platform admin")}</Link> : null}
          </div>
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
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="#B9C3DA" strokeWidth="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
          <label htmlFor="hdr-search" className="sr-only">{t("Search")}</label>
          <input id="hdr-search" name="q" type="search" placeholder={t("Search papers, venues, people")} className="h-9 min-w-0 flex-auto border-0 bg-transparent text-[14px] text-[#F5F6F3] outline-none placeholder:text-[#8F9BBA]" />
        </form>

        <div className="ml-auto flex flex-none items-center gap-2.5 sm:gap-3">
          <LanguageSelect id="hdr-lang" className="hidden border-[#2A3C6E]! bg-[#17285A]! text-[#F5F6F3]! lg:block" />
          <span className="auth-out flex items-center gap-3">
            <Link href={`/sign-in?next=${encodeURIComponent(p === "/" ? "/workspace" : p)}`} className="px-2 py-2.5 text-[14px] font-medium text-[#F5F6F3] no-underline">{t("Sign in")}</Link>
            <Link href="/manage/new" className="hidden sm:inline-flex h-9 items-center rounded-[4px] bg-[#F2A93B] px-3.5 text-[14px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{t("Host a conference")}</Link>
          </span>
          <span className="auth-in flex items-center gap-2.5 sm:gap-3">
            <Link href="/venues" className="hidden h-[38px] items-center gap-2 rounded-[4px] bg-[#F2A93B] px-3.5 text-[14px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26] lg:flex">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden fill="none" stroke="#0E1B3D" strokeWidth="1.8"><path d="M7 2v10M2 7h10" /></svg>{t("New submission")}
            </Link>
            <Link href="/inbox" prefetch={null} aria-label={s?.unread ? `${t("Inbox")} · ${s.unread} ${t("unread")}` : t("Inbox")} title={t("Inbox")}
              className="relative box-border flex size-10 items-center justify-center rounded-[6px] border border-[#2A3C6E] no-underline hover:bg-[#17285A]">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="#F5F6F3" strokeWidth="1.5"><rect x="2" y="4" width="14" height="10" rx="1.5" /><path d="M2.5 5l6.5 5 6.5-5" /></svg>
              <Count n={s?.unread} dark />
            </Link>
            <span className="hidden sm:block">
              {s?.signedIn && s.name ? <AccountMenu name={s.name} initials={s.initials ?? "?"} plenaryId={s.plenaryId ?? null} isAdmin={!!s.isAdmin} /> : <span aria-hidden className="sk-dark block size-10 rounded-full!" />}
            </span>
          </span>
          <button type="button" onClick={onMenu} aria-label={t("Menu")} className="flex size-10 items-center justify-center rounded-[6px] border border-[#2A3C6E] bg-transparent text-[#F5F6F3] lg:hidden">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2.5 5h13M2.5 9h13M2.5 13h13" /></svg>
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
  useEffect(() => { void refreshSummary(); }, [p]);
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
  return <SideMenu p={barePath(usePathname() ?? "/")} s={s} edge="min-[1441px]:border-l" />;
}

/** Signed-in areas: side menu + main column. Organiser pages mark themselves wide ([data-wide-frame]). */
export function AppFrame({ children }: { children: ReactNode }) {
  const s = useSummary();
  return (
    <div className="chrome-body flex min-h-[calc(100dvh-60px)] flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <div className="app-frame mx-auto flex w-full max-w-[1440px] flex-auto has-[[data-wide-frame]]:max-w-[1600px]">
        <Suspense fallback={<SideMenu p="" s={s} edge="min-[1441px]:border-l" />}>
          <SideMenuLive />
        </Suspense>
        <main id="main-content" className="box-border min-w-0 flex-auto px-5 pb-12 pt-8 sm:px-10">{children}</main>
      </div>
      {s?.signedIn ? <InstallPrompt /> : null}
    </div>
  );
}
