"use client";

import {
  BookOpenCheck, CalendarDays, CalendarRange, ChevronDown, ClipboardCheck, FileStack, FileText, House, LayoutDashboard,
  Mail, PanelLeftClose, PanelLeftOpen, PenLine, Settings, Settings2, Users, CircleHelp,
} from "lucide-react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";
import { CookieSettingsLink } from "@/components/consent/cookie-consent";
import { ORGANIZER_GROUPS, ORGANIZER_NAV, OWNER_ONLY } from "@/lib/site/organizer-nav";
import { manageSlug } from "@/lib/site/chrome-mode";
import type { Summary, VenueRef } from "@/components/chrome/summary";
import { useEventHint } from "@/components/chrome/event-hint";

/*
 * The workspace side menu. Three parts: a fixed top (your own pages), a middle that scrolls (your venues, and the
 * organiser groups for the event you run), a fixed bottom (settings, help, collapse). Every group folds; the
 * browser remembers which ones are open, and the group holding the current page always opens by itself.
 * Width: 248 px; a 64 px icon bar on tablets (768–1023 px) or when the person collapses it. Uses start/end, never
 * left/right, so it mirrors in right-to-left languages.
 */

const VENUE_COLORS = ["#2F5FD0", "#A8600F", "#18744F", "#6B4FBF", "#B3261E"];
const I = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

type Item = { key: string; href: string; label: string; icon: ReactNode; badge?: "subs" | "unread"; needs?: (s: Summary | null) => boolean };
const hasRole = (s: Summary | null, re: RegExp) => !!s?.venues?.some((v) => v.roles.some((r) => re.test(r)));
const TOP: Item[] = [
  { key: "home", href: "/workspace", label: "Home", icon: <House {...I} /> },
  { key: "submissions", href: "/workspace/submissions", label: "My submissions", icon: <FileText {...I} />, badge: "subs" },
  { key: "reviews", href: "/reviews", label: "Reviews", icon: <PenLine {...I} />, needs: (s) => hasRole(s, /reviewer|associate_editor|chair|owner/) },
  { key: "sessions", href: "/chair", label: "Sessions I chair", icon: <CalendarDays {...I} />, needs: (s) => hasRole(s, /^session_chair$/) },
  { key: "inbox", href: "/inbox", label: "Inbox", icon: <Mail {...I} />, badge: "unread" },
];
const GROUP_ICON: Record<string, ReactNode> = {
  overview: <LayoutDashboard {...I} />, submissions: <FileStack {...I} />, reviewing: <ClipboardCheck {...I} />,
  after: <BookOpenCheck {...I} />, event: <CalendarRange {...I} />, team: <Users {...I} />, settings: <Settings2 {...I} />,
};
const SETTINGS: [string, string][] = [
  ["/settings/profile", "Profile & expertise"], ["/settings/security", "Sign-in & security"], ["/settings/notifications", "Notifications"],
  ["/settings/calendar", "Calendar feed"], ["/settings/privacy", "Privacy & data"],
];

export function activeKey(p: string): string {
  if (p === "/workspace") return "home";
  if (p.startsWith("/workspace/submissions") || p.startsWith("/submissions/")) return "submissions";
  if (p.startsWith("/reviews")) return "reviews";
  if (p.startsWith("/chair")) return "sessions";
  if (p.startsWith("/inbox")) return "inbox";
  if (p.startsWith("/settings")) return "settings";
  if (p === "/manage/roles") return "m:roles";
  return "";
}
export const isOn = (p: string, href: string) => p === href || (href !== "/" && p.startsWith(`${href}/`));

/* ---------------------------------------------------------------- remembered state (this browser only) */

const subs = new Set<() => void>();
const listen = (f: () => void) => { subs.add(f); window.addEventListener("storage", f); return () => { subs.delete(f); window.removeEventListener("storage", f); }; };
function read(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function write(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } subs.forEach((f) => f()); }

const listenResize = (f: () => void) => { const off = listen(f); window.addEventListener("resize", f); return () => { off(); window.removeEventListener("resize", f); }; };

const OPEN_KEY = "plenary.sideGroups";
const RAIL_KEY = "plenary.sideRail";
function useOpenMap(): Record<string, boolean> {
  const raw = useSyncExternalStore(listen, () => read(OPEN_KEY) ?? "{}", () => "{}");
  try { return JSON.parse(raw) as Record<string, boolean>; } catch { return {}; }
}
function setOpen(map: Record<string, boolean>, key: string, open: boolean) { write(OPEN_KEY, JSON.stringify({ ...map, [key]: open })); }
/** "auto" = full on large screens, icon bar on tablets; "rail" / "full" = the person's choice. */
type Rail = "auto" | "rail" | "full";
function useRail(): Rail {
  return useSyncExternalStore(listen, () => (read(RAIL_KEY) as Rail | null) ?? "auto", () => "auto");
}

/* ---------------------------------------------------------------- organiser block */

function useOrganizer(p: string, s: Summary | null) {
  const hint = useEventHint();
  const slug = manageSlug(p) ?? s?.organizerOf ?? null;
  if (!slug) return null;
  const v: VenueRef | undefined = s?.venues?.find((x) => x.slug === slug);
  const name = hint?.slug === slug ? hint.name : v ? v.shortName ?? v.name : manageSlug(p) ? slug : null;
  if (!name) return null;
  const roleLabel = hint?.slug === slug ? hint.roleLabel : v?.roles.includes("owner") ? "Owner" : "Chair";
  const byKey = new Map(ORGANIZER_NAV.filter(([k]) => !OWNER_ONLY.has(k) || /owner/i.test(roleLabel)).map(([k, l, path]) => [k, {
    key: k, label: l, href: path.startsWith("@") ? path.slice(1) : `/manage/${slug}${path}`,
  }]));
  const all = [...byKey.values()];
  // longest matching link wins (Setup vs Setup › Committee)
  const on = all.filter((i) => isOn(p, i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.key ?? (p === "/manage/roles" ? "roles" : null);
  const groups = ORGANIZER_GROUPS.map(([gk, gl, keys]) => ({ key: gk, label: gl, items: keys.map((k) => byKey.get(k)).filter((x): x is NonNullable<typeof x> => !!x) }))
    .filter((g) => g.items.length);
  return { slug, name, roleLabel, groups, on };
}

/* ---------------------------------------------------------------- pieces */

const rowBase = "flex items-center gap-2.5 rounded-[6px] px-3 text-[14px] no-underline";
const rowOn = "bg-[#E6EDFC] font-semibold text-[#0E1B3D]";
const rowOff = "text-[#121826] hover:bg-[#F5F6F3]";
const eyebrow = "font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]";

function Count({ n }: { n?: number }) {
  return n ? <span className="ms-auto font-mono text-[12px] text-[#4A5263] rail:hidden">{n > 99 ? "99+" : n}</span> : null;
}
function Dot({ n }: { n?: number }) {
  return n ? <span aria-hidden className="absolute end-1.5 top-1.5 hidden size-2 rounded-full bg-[#F2A93B] rail:block" /> : null;
}

/** A heading that folds what is under it. `label` hides on the icon bar, where the icon stays as a link target. */
function Fold({ id, label, icon, open, onToggle, extra, children, rail }: {
  id: string; label: string; icon?: ReactNode; open: boolean; onToggle: () => void; extra?: ReactNode; children: ReactNode; rail?: ReactNode;
}) {
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls={`fold-${id}`} onClick={onToggle}
        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[6px] border-0 bg-transparent px-3 text-start hover:bg-[#F5F6F3] rail:hidden ${icon ? "h-9 text-[14px] text-[#121826]" : `h-8 ${eyebrow}`}`}>
        {icon}
        <span className="min-w-0 flex-auto truncate">{label}</span>
        {extra}
        <ChevronDown size={14} strokeWidth={2} aria-hidden className={`flex-none text-[#4A5263] transition-transform ${open ? "" : "-rotate-90 rtl:rotate-90"}`} />
      </button>
      {rail ? <div className="hidden rail:block">{rail}</div> : null}
      <div id={`fold-${id}`} hidden={!open} className="rail:hidden">{children}</div>
    </div>
  );
}

/** Icon-bar link: icon only, name in a tooltip and for screen readers. */
function RailLink({ href, label, icon, on, onPick, n }: { href: string; label: string; icon: ReactNode; on?: boolean; onPick?: () => void; n?: number }) {
  return (
    <Link href={href} onClick={onPick} title={label} aria-current={on ? "page" : undefined}
      className={`relative mx-auto flex size-10 items-center justify-center rounded-[6px] no-underline ${on ? rowOn : rowOff}`}>
      {icon}<span className="sr-only">{label}</span><Dot n={n} />
    </Link>
  );
}

/* ---------------------------------------------------------------- lists */

/** The menu body, shared by the side menu (with icon bar) and the phone menu (always full). */
export function NavList({ p, s, onPick, part = "all" }: { p: string; s: Summary | null; onPick?: () => void; part?: "all" | "top" | "middle" }) {
  const t = useT();
  const key = activeKey(p);
  const org = useOrganizer(p, s);
  const openMap = useOpenMap();
  const activeGroup = org?.groups.find((g) => g.items.some((i) => i.key === org.on))?.key;
  const venueOn = s?.venues?.some((v) => p.startsWith(`/venues/${v.slug}/`));

  // The group with the current page opens by itself, even if it was folded before.
  useEffect(() => {
    if (activeGroup && openMap[`org:${activeGroup}`] === false) setOpen(openMap, `org:${activeGroup}`, true);
    if (venueOn && openMap.venues === false) setOpen(openMap, "venues", true);
  }, [activeGroup, venueOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const isOpen = (k: string, dflt: boolean) => openMap[k] ?? dflt;

  const top = TOP.filter((i) => !i.needs || i.needs(s) || i.key === key).map((i) => {
    const n = i.badge === "subs" ? s?.submissionCount : i.badge === "unread" ? s?.unread : undefined;
    const on = key === i.key;
    return (
      <div key={i.key}>
        <Link href={i.href} prefetch={null} onClick={onPick} aria-current={on ? "page" : undefined} className={`${rowBase} h-10 rail:hidden ${on ? rowOn : rowOff}`}>
          {i.icon}<span className="truncate">{t(i.label)}</span><Count n={n} />
        </Link>
        <div className="hidden rail:block"><RailLink href={i.href} label={t(i.label)} icon={i.icon} on={on} onPick={onPick} n={n} /></div>
      </div>
    );
  });

  const middle = (
    <>
      {s?.venues?.length ? (
        <div className="mt-3">
          <Fold id="venues" label={t("Your venues")} open={isOpen("venues", true)} onToggle={() => setOpen(openMap, "venues", !isOpen("venues", true))}
            rail={<div className="flex flex-col items-center gap-1 border-t border-[#EEF0EC] pt-2">
              {s.venues.map((v, i) => (
                <Link key={v.slug} href={`/venues/${v.slug}/me`} onClick={onPick} title={v.name} aria-current={p.startsWith(`/venues/${v.slug}/`) ? "page" : undefined}
                  className={`flex size-10 items-center justify-center rounded-[6px] ${p.startsWith(`/venues/${v.slug}/`) ? rowOn : rowOff}`}>
                  <span className="size-2.5 rounded-[2px]" style={{ background: VENUE_COLORS[i % VENUE_COLORS.length] }} /><span className="sr-only">{v.name}</span>
                </Link>
              ))}
            </div>}>
            {s.venues.map((v, i) => {
              const on = p.startsWith(`/venues/${v.slug}/`);
              return (
                <Link key={v.slug} href={`/venues/${v.slug}/me`} onClick={onPick} aria-current={on ? "page" : undefined} className={`${rowBase} h-9 ${on ? rowOn : rowOff}`}>
                  <span className="size-2 flex-none rounded-[2px]" style={{ background: VENUE_COLORS[i % VENUE_COLORS.length] }} />
                  <span className="truncate">{v.name}</span>
                </Link>
              );
            })}
          </Fold>
        </div>
      ) : null}
      {org ? (
        <div className="mt-3 border-t border-[#EEF0EC] pt-3 rail:border-t-0 rail:pt-0">
          <div className="mx-3 mb-1 flex items-center justify-between gap-2 rail:hidden">
            <span className={eyebrow}>{t("Organizer")}</span>
            <span className="rounded-[3px] bg-[#0E1B3D] px-1.5 py-px font-mono text-[10px] uppercase text-[#F2A93B]">{t(org.roleLabel)}</span>
          </div>
          <div className="truncate px-3 pb-2 text-[12px] text-[#4A5263] rail:hidden" title={org.name}>{org.name}</div>
          <div className="flex flex-col gap-0.5 rail:items-center rail:border-t rail:border-[#EEF0EC] rail:pt-2">
            {org.groups.map((g) => {
              const on = g.key === activeGroup;
              const open = isOpen(`org:${g.key}`, on || g.key === "overview");
              if (g.items.length === 1) {
                const i = g.items[0];
                return (
                  <div key={g.key}>
                    <Link href={i.href} onClick={onPick} aria-current={org.on === i.key ? "page" : undefined} className={`${rowBase} h-9 rail:hidden ${org.on === i.key ? rowOn : rowOff}`}>
                      {GROUP_ICON[g.key]}<span className="truncate">{t(i.label)}</span>
                    </Link>
                    <div className="hidden rail:block"><RailLink href={i.href} label={t(i.label)} icon={GROUP_ICON[g.key]} on={org.on === i.key} onPick={onPick} /></div>
                  </div>
                );
              }
              return (
                <Fold key={g.key} id={`org-${g.key}`} label={t(g.label)} icon={GROUP_ICON[g.key]} open={open}
                  onToggle={() => setOpen(openMap, `org:${g.key}`, !open)}
                  rail={<RailLink href={g.items.find((i) => i.key === org.on)?.href ?? g.items[0].href} label={t(g.label)} icon={GROUP_ICON[g.key]} on={on} onPick={onPick} />}>
                  <ul className="m-0 mb-1 ms-[19px] list-none border-s border-[#DADDE3] p-0 ps-2">
                    {g.items.map((i) => (
                      <li key={i.key}>
                        <Link href={i.href} onClick={onPick} aria-current={org.on === i.key ? "page" : undefined}
                          className={`${rowBase} h-[34px] ${org.on === i.key ? rowOn : rowOff}`}><span className="truncate">{t(i.label)}</span></Link>
                      </li>
                    ))}
                  </ul>
                </Fold>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );

  if (part === "top") return <>{top}</>;
  if (part === "middle") return middle;
  return <>{top}{middle}</>;
}

/** Settings with its pages nested, used in the side menu's fixed bottom. */
function SettingsFold({ p }: { p: string }) {
  const t = useT();
  const openMap = useOpenMap();
  const on = p.startsWith("/settings");
  const open = openMap.settings ?? on;
  useEffect(() => { if (on && openMap.settings === false) setOpen(openMap, "settings", true); }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
  const icon = <Settings {...I} />;
  return (
    <Fold id="settings" label={t("Settings")} icon={icon} open={open} onToggle={() => setOpen(openMap, "settings", !open)}
      rail={<RailLink href="/settings/profile" label={t("Settings")} icon={icon} on={on} />}>
      <ul className="m-0 mb-1 ms-[19px] list-none border-s border-[#DADDE3] p-0 ps-2">
        {SETTINGS.map(([href, label]) => (
          <li key={href}>
            <Link href={href} aria-current={isOn(p, href) ? "page" : undefined} className={`${rowBase} h-[32px] ${isOn(p, href) ? rowOn : rowOff}`}><span className="truncate">{t(label)}</span></Link>
          </li>
        ))}
      </ul>
    </Fold>
  );
}

/** The side menu (768 px and up). `data-rail` drives the icon-bar look through the `rail:` variant (globals.css). */
export function SideMenu({ p, s }: { p: string; s: Summary | null }) {
  const t = useT();
  const rail = useRail();
  function toggle() {
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const isRail = rail === "rail" || (rail === "auto" && !wide);
    write(RAIL_KEY, isRail ? "full" : "rail");
  }
  // For the button's name only; the look itself comes from CSS, so there's no flash before this runs.
  const isRailNow = useSyncExternalStore(listenResize, () => rail === "rail" || (rail === "auto" && !window.matchMedia("(min-width: 1024px)").matches), () => false);
  const help = <CircleHelp {...I} />;
  return (
    <nav aria-label={t("Workspace")} data-rail={rail}
      className="side-menu sticky top-[60px] box-border hidden h-[calc(100dvh-60px)] w-[248px] flex-none flex-col border-e border-[#DADDE3] bg-white md:flex rail:w-16">
      <div className="flex flex-none flex-col gap-0.5 border-b border-[#EEF0EC] px-3 pb-3 pt-4 rail:px-2">
        <NavList p={p} s={s} part="top" />
      </div>
      <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain px-3 pb-4 rail:px-2">
        <NavList p={p} s={s} part="middle" />
        <div className="mt-3 border-t border-[#EEF0EC] pt-3 rail:flex rail:justify-center">
          <SettingsFold p={p} />
        </div>
      </div>
      <div className="flex flex-none flex-col gap-0.5 border-t border-[#DADDE3] px-3 py-2.5 rail:items-center rail:px-2">
        <div className="flex items-center gap-1 rail:flex-col">
          <Link href="/help" className={`${rowBase} h-9 min-w-0 flex-auto text-[#4A5263] hover:bg-[#F5F6F3] rail:hidden`}>{help}<span className="truncate">{t("Help & guides")}</span></Link>
          <div className="hidden rail:block"><RailLink href="/help" label={t("Help & guides")} icon={help} /></div>
          <button type="button" onClick={toggle} aria-label={t(isRailNow ? "Expand menu" : "Collapse menu")} title={t(isRailNow ? "Expand menu" : "Collapse menu")}
            className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent text-[#4A5263] hover:bg-[#F5F6F3] rail:size-10">
            <PanelLeftClose {...I} className="rtl:-scale-x-100 rail:hidden" />
            <PanelLeftOpen {...I} className="hidden rtl:-scale-x-100 rail:block" />
          </button>
        </div>
        <CookieSettingsLink className={`${rowBase} h-8 w-full text-start text-[13px] text-[#4A5263] hover:bg-[#F5F6F3] hover:no-underline rail:hidden`} />
      </div>
    </nav>
  );
}

