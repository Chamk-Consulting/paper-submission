import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/workspace/account-menu";
import { venueColor, type WorkspaceCtx } from "@/lib/workspace/data";
import { LanguageSelect } from "@/components/i18n/language-select";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/translate";
import { Pin } from "@/components/motion/pin";
import { CookieSettingsLink } from "@/components/consent/cookie-consent";
import { InstallPrompt } from "@/components/pwa/install-prompt";

/* Shared shell of canvas WS01/WS02: navy top bar + white left nav. */

const Icon = {
  home: <path d="M2 7l6-5 6 5v7H2z" />,
  paper: <><path d="M4 1.5h5.5L13 5v9.5H4z" /><path d="M9 1.5V5h4" /></>,
  pen: <path d="M2 13.5l1-3.5 7.5-7.5 2.5 2.5L5.5 12.5z" />,
  cal: <><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" /></>,
  globe: <><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" /></>,
  mail: <><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" /><path d="M2 4.5l6 4.5 6-4.5" /></>,
};
type Key = "home" | "submissions" | "reviews" | "sessions" | "venues" | "inbox" | `m:${string}`;

/** Organizer links of the event sidebar (canvas EM20–EM44). key → path under /manage/[slug]. */
export const ORGANIZER_NAV: [string, string, string][] = [
  ["dashboard", "Event dashboard", ""], ["papers", "Papers", "/papers"], ["similarity", "Similarity check", "/similarity"], ["assignment", "Assignment", "/assignment"],
  ["reviews", "Review progress", "/reviews"], ["decisions", "Decisions", "/decisions"], ["awards", "Awards", "/awards"], ["finals", "Final versions", "/finals"],
  ["program", "Program builder", "/program"], ["registrations", "Registrations", "/registrations"], ["live", "Event day", "/live"], ["checkin", "Badges & check-in", "/checkin"],
  ["proceedings", "Proceedings & reports", "/proceedings"],
  ["people", "People", "/people"], ["email", "Email centre", "/email"], ["setup", "Setup", "/setup"], ["billing", "Billing", "/billing"],
  ["committee", "Committee", "/setup/committee"], ["roles", "My roles & conflicts", "@/manage/roles"], ["audit", "Audit log", "/audit"],
];
/** Organizer items only the event owner sees. */
const OWNER_ONLY = new Set(["billing"]);

function NavItem({ t, href, icon, label, active, badge, soon }: { t: T; href?: string; icon: ReactNode; label: string; active?: boolean; badge?: ReactNode; soon?: boolean }) {
  const cls = `flex h-10 items-center justify-between rounded-[6px] px-3 text-[14px] no-underline ${active ? "bg-[#E6EDFC] font-semibold text-[#0E1B3D]" : soon ? "text-[#9AA3B5]" : "text-[#121826] hover:bg-[#F5F6F3]"}`;
  const inner = (
    <>
      <span className="flex items-center gap-2.5">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">{icon}</svg>
        {t(label)}
      </span>
      {soon ? <span className="font-mono text-[10px] uppercase">{t("soon")}</span> : badge}
    </>
  );
  if (!href || soon) return <span className={cls} aria-disabled title={t("Coming soon")}>{inner}</span>;
  return <Link href={href} aria-current={active ? "page" : undefined} className={cls}>{inner}</Link>;
}

const count = (n: number) => (n ? <span className="font-mono text-[12px] text-[#4A5263]">{n}</span> : null);


/** ctx = null renders the same chrome with placeholders (used by the loading skeleton). */
export async function WorkspaceShell({ ctx, active, children, event }: { ctx: WorkspaceCtx | null; active: Key; children: ReactNode; event?: { slug: string; name: string; roleLabel: string } }) {
  const t = await getT();
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <Pin name="ws-header">
      <header className="relative bg-[#0E1B3D] text-[#F5F6F3]">
        <div className="flex min-h-[60px] flex-wrap items-center gap-5 px-6 py-2.5">
          <Link href="/workspace" className="flex items-center gap-2.5 text-[#F5F6F3] no-underline">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden fill="none" stroke="#F5F6F3" strokeWidth="1.5"><circle cx="11" cy="11" r="9.25" /><path d="M4 11h14M11 2v18" /><circle cx="11" cy="11" r="2.5" fill="#F2A93B" stroke="none" /></svg>
            <span className="font-serif text-[22px]">Plenary</span>
          </Link>
          <form role="search" action="/search" className="flex h-[38px] max-w-[560px] flex-[1_1_320px] items-center gap-2 rounded-[6px] border border-[#2A3C6E] bg-[#17285A] pl-3 pr-1.5">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="#B9C3DA" strokeWidth="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
            <label htmlFor="w-search" className="sr-only">{t("Search")}</label>
            <input id="w-search" name="q" type="search" placeholder={t("Search papers, venues, people")} className="h-9 min-w-0 flex-auto border-0 bg-transparent text-[14px] text-[#F5F6F3] outline-none placeholder:text-[#8F9BBA]" />
            <button type="submit" className="inline-flex h-7 items-center rounded-[4px] border-0 bg-[#24335C] px-2.5 text-[12px] font-semibold text-[#F5F6F3]">{t("Search")}</button>
          </form>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSelect id="ws-lang" className="hidden border-[#2A3C6E]! bg-[#17285A]! text-[#F5F6F3]! md:block" />
            {/* TODO(submit): SB01 venue-type step; until then pick a venue from the open calls. */}
            <Link href="/venues" className="flex h-[38px] items-center gap-2 rounded-[4px] bg-[#F2A93B] px-3.5 text-[14px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden fill="none" stroke="#0E1B3D" strokeWidth="1.8"><path d="M7 2v10M2 7h10" /></svg>{t("New submission")}
            </Link>
            <Link href="/inbox" aria-label={ctx?.unread ? `${t("Inbox")} · ${ctx.unread} ${t("unread")}` : t("Inbox")} title={t("Inbox")} className="relative box-border flex size-10 items-center justify-center rounded-[6px] border border-[#2A3C6E] no-underline hover:bg-[#17285A]">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="#F5F6F3" strokeWidth="1.5"><rect x="2" y="4" width="14" height="10" rx="1.5" /><path d="M2.5 5l6.5 5 6.5-5" /></svg>
              {ctx?.unread ? <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#F2A93B] px-1 text-[11px] font-bold text-[#0E1B3D]">{ctx.unread > 9 ? "9+" : ctx.unread}</span> : null}
            </Link>
            {ctx ? <AccountMenu name={ctx.name} initials={ctx.initials} plenaryId={ctx.me.person?.plenary_id ?? null} /> : <span aria-hidden className="sk-dark block size-10 rounded-full!" />}
          </div>
        </div>
      </header>
      </Pin>

      <div className="flex flex-auto">
        <Pin name="ws-nav">
        <nav aria-label={t("Workspace")} className="box-border hidden w-[232px] flex-none flex-col gap-0.5 border-r border-[#DADDE3] bg-white px-3 py-5 md:flex">
          <NavItem t={t} href="/workspace" icon={Icon.home} label="Home" active={active === "home"} />
          <NavItem t={t} href="/workspace/submissions" icon={Icon.paper} label="My submissions" active={active === "submissions"} badge={ctx ? count(ctx.submissionCount) : null} />
          <NavItem t={t} href="/reviews" icon={Icon.pen} label="Reviews" active={active === "reviews"} />
          <NavItem t={t} href="/chair" icon={Icon.cal} label="Sessions I chair" active={active === "sessions"} />
          <NavItem t={t} href="/venues" icon={Icon.globe} label="Browse venues" />
          <NavItem t={t} href="/inbox" icon={Icon.mail} label="Inbox" active={active === "inbox"} badge={ctx?.unread ? count(ctx.unread) : null} />

          {ctx?.venues.length ? (
            <>
              <div className="mx-3 mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Your venues")}</div>
              {ctx.venues.map((v, i) => (
                <Link key={v.id} href={`/venues/${v.slug}/me`} className="flex h-9 items-center gap-2.5 rounded-[6px] px-3 text-[14px] text-[#121826] no-underline hover:bg-[#F5F6F3]">
                  <span className="size-2 flex-none rounded-[2px]" style={{ background: venueColor(i) }} />
                  <span className="truncate">{v.name}</span>
                </Link>
              ))}
            </>
          ) : null}

          {event ?? (ctx?.organizerOf ? { slug: ctx.organizerOf.slug, name: ctx.organizerOf.shortName ?? ctx.organizerOf.name, roleLabel: ctx.organizerOf.roles.includes("owner") ? "Owner" : "Chair" } : null) ? (() => {
            const ev = (event ?? { slug: ctx!.organizerOf!.slug, name: ctx!.organizerOf!.shortName ?? ctx!.organizerOf!.name, roleLabel: ctx!.organizerOf!.roles.includes("owner") ? "Owner" : "Chair" })!;
            return (
              <>
                <div className="mx-3 mb-2 mt-4 flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Organizer")}</span>
                  <span className="rounded-[3px] bg-[#0E1B3D] px-1.5 py-px font-mono text-[10px] uppercase text-[#F2A93B]">{t(ev.roleLabel)}</span>
                </div>
                <div className="truncate px-3 pb-1 text-[12px] text-[#4A5263]">{ev.name}</div>
                {ORGANIZER_NAV.filter(([k]) => !OWNER_ONLY.has(k) || /owner/i.test(ev.roleLabel)).map(([k, l, path]) => {
                  const href = path.startsWith("@") ? path.slice(1) : `/manage/${ev.slug}${path}`;
                  const on = active === `m:${k}`;
                  return (
                    <Link key={k} href={href} aria-current={on ? "page" : undefined}
                      className={`flex h-[34px] items-center rounded-[6px] px-3 text-[14px] no-underline ${on ? "bg-[#E6EDFC] font-semibold text-[#0E1B3D]" : "text-[#121826] hover:bg-[#F5F6F3]"}`}>{t(l)}</Link>
                  );
                })}
              </>
            );
          })() : null}

          <div className="mt-auto flex flex-col gap-0.5 border-t border-[#DADDE3] pt-4">
            <Link href="/settings/profile" className="flex h-9 items-center rounded-[6px] px-3 text-[14px] text-[#4A5263] no-underline hover:bg-[#F5F6F3]">{t("Settings")}</Link>
            <Link href="/help" className="flex h-9 items-center rounded-[6px] px-3 text-[14px] text-[#4A5263] no-underline hover:bg-[#F5F6F3]">{t("Help & guides")}</Link>
            <CookieSettingsLink className="flex h-9 items-center rounded-[6px] px-3 text-left text-[14px] text-[#4A5263] hover:bg-[#F5F6F3] hover:no-underline" />
          </div>
        </nav>
        </Pin>
        <main className="box-border min-w-0 flex-auto px-5 pb-12 pt-8 sm:px-10">{children}</main>
        {ctx ? <InstallPrompt /> : null}
      </div>
    </div>
  );
}
