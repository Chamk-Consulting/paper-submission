"use client";

import {
  Award, BadgeCheck, Bell, BookOpen, BookOpenCheck, Briefcase, Building2, CalendarClock, CalendarCog, CalendarRange,
  ChartNoAxesColumn, ChevronDown, ChevronsUpDown, CircleHelp, ClipboardCheck, Compass, Contact, CreditCard, FileCheck,
  FileStack, FileText, Files, Filter, Gauge, Gavel, History, House, IdCard, Inbox, KeyRound, LayoutDashboard, LifeBuoy,
  Lock, MessageSquare, PanelLeftClose, PanelLeftOpen, PenLine, Plus, Presentation, QrCode, Radio, Scale, ScanSearch,
  CircleUserRound, Search, Send, Settings, Settings2, ShieldAlert, ShieldCheck, SlidersHorizontal, Ticket, UserPlus, UserRound, Users,
  UsersRound, X, Check, Star,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";
import { CookieSettingsLink } from "@/components/consent/cookie-consent";
import { ORGANIZER_NAV, OWNER_ONLY } from "@/lib/site/organizer-nav";
import { manageSlug } from "@/lib/site/chrome-mode";
import type { Summary, VenueRef } from "@/components/chrome/summary";
import { useEventHint } from "@/components/chrome/event-hint";

/*
 * The workspace side menu, built from one data tree (menuTree below): groups hold pages or other groups (two levels,
 * three for a single venue). Every group folds; clicking its name opens it and goes to its default page — or the last
 * page opened there — while the chevron only folds. Rows a person can't use are left out (roles from the summary).
 * Three parts: a fixed top (filter, New submission, Home, Inbox), a middle that scrolls, a fixed bottom (Help &
 * support, collapse). 248 px wide; a 64 px icon bar on tablets, when collapsed, or while submitting a paper — there a
 * group opens as a small panel beside the bar. Uses start/end, never left/right, so it mirrors right to left.
 */

const VENUE_COLORS = ["#2F5FD0", "#A8600F", "#18744F", "#6B4FBF", "#B3261E"];
const I = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const ic = (C: typeof House) => <C {...I} />;

/* ---------------------------------------------------------------- the tree */

export type Leaf = { kind: "leaf"; key: string; label: string; icon?: ReactNode; href: string; count?: number; on: boolean; isNew?: boolean };
export type Group = { kind: "group"; key: string; label: string; icon: ReactNode; items: MenuNode[]; def?: string; dot?: string };
type MenuNode = Leaf | Group;

const ORGANIZER_ROLES = /^(owner|chair|program_chair|deputy_chair|ceb_chair|publication_chair|registration_chair|staff)$/;
const hasRole = (s: Summary | null, re: RegExp) => !!s?.venues?.some((v) => v.roles.some((r) => re.test(r)));
export const isOn = (p: string, href: string) => { const h = href.split("#")[0]; return p === h || (h !== "/" && p.startsWith(`${h}/`)); };

/** Organiser groups: [key, label, icon, default page, [organiser key, icon]…]. */
const ORG_GROUPS: [string, string, typeof House, string, [string, typeof House][]][] = [
  ["overview", "Overview", LayoutDashboard, "dashboard", [["dashboard", Gauge]]],
  ["submissions", "Submissions", FileStack, "papers", [["papers", Files], ["similarity", ScanSearch]]],
  ["reviewing", "Reviewing", ClipboardCheck, "reviews", [["assignment", UserPlus], ["reviews", ChartNoAxesColumn], ["decisions", Gavel], ["awards", Award]]],
  ["after", "After acceptance", BookOpenCheck, "finals", [["finals", FileCheck], ["proceedings", BookOpen]]],
  ["event", "Event", CalendarRange, "program", [["program", CalendarCog], ["registrations", Ticket], ["live", Radio], ["checkin", QrCode]]],
  ["team", "Team & email", Users, "people", [["people", Contact], ["committee", UsersRound], ["email", Send]]],
  ["settings", "Event settings", Settings2, "setup", [["setup", SlidersHorizontal], ["billing", CreditCard], ["roles", ShieldAlert], ["audit", History]]],
];
/** Account: who you are and how you get in. Settings: how Plenary behaves for you. */
const ACCOUNT_ITEMS: [string, string, typeof House, (p: string) => boolean][] = [
  ["/settings/profile", "Profile", UserRound, (p) => p.startsWith("/settings/profile")],
  ["/settings/reviewing", "Reviewing", ClipboardCheck, (p) => p.startsWith("/settings/reviewing")],
  ["/settings/security", "Security", KeyRound, (p) => p.startsWith("/settings/security")],
  ["/settings/privacy", "Privacy", Lock, (p) => p.startsWith("/settings/privacy")],
];
const SETTINGS_ITEMS: [string, string, typeof House, (p: string) => boolean][] = [
  ["/settings/notifications", "Notifications", Bell, (p) => p.startsWith("/settings/notifications") || p.startsWith("/settings/calendar")],
];

/** Events this person organises (for the switcher), with the role label shown beside the name. */
export function organizerEvents(s: Summary | null): (VenueRef & { roleLabel: string })[] {
  return (s?.venues ?? []).filter((v) => v.roles.some((r) => ORGANIZER_ROLES.test(r)))
    .map((v) => ({ ...v, roleLabel: v.roles.includes("owner") ? "Owner" : "Chair" }));
}

function useOrganizer(p: string, s: Summary | null) {
  const hint = useEventHint();
  const stored = useStored(ORG_KEY);
  const events = organizerEvents(s);
  const fromUrl = manageSlug(p);
  const slug = fromUrl ?? (stored && events.some((e) => e.slug === stored) ? stored : null) ?? s?.organizerOf ?? events[0]?.slug ?? null;
  if (!slug) return null;
  const v = events.find((x) => x.slug === slug) ?? s?.venues?.find((x) => x.slug === slug);
  const name = hint?.slug === slug ? hint.name : v ? v.shortName ?? v.name : fromUrl ? slug : null;
  if (!name) return null;
  const roleLabel = hint?.slug === slug ? hint.roleLabel : v?.roles.includes("owner") ? "Owner" : "Chair";
  const nav = new Map(ORGANIZER_NAV.filter(([k]) => !OWNER_ONLY.has(k) || /owner/i.test(roleLabel)).map(([k, l, path]) => [k, {
    label: l, href: path.startsWith("@") ? path.slice(1) : `/manage/${slug}${path}`,
  }]));
  // longest matching link wins (Setup vs Setup › Committee)
  const onKey = [...nav.entries()].filter(([, i]) => isOn(p, i.href)).sort((a, b) => b[1].href.length - a[1].href.length)[0]?.[0] ?? null;
  const groups: Group[] = ORG_GROUPS.map(([gk, gl, gi, def, items]) => ({
    kind: "group" as const, key: `org:${gk}`, label: gl, icon: ic(gi), def,
    items: items.filter(([k]) => nav.has(k)).map(([k, icon]) => ({ kind: "leaf" as const, key: k, label: nav.get(k)!.label, icon: ic(icon), href: nav.get(k)!.href, on: onKey === k })),
  })).filter((g) => g.items.length);
  return { slug, name, roleLabel, groups, events };
}

/** Everything in the middle part, in order. Rows the person can't use are left out. */
function useMiddle(p: string, s: Summary | null, tab?: string) {
  const reviewer = hasRole(s, /^(reviewer|associate_editor|chair|program_chair|deputy_chair|owner)$/) || p.startsWith("/reviews");
  const sessionChair = hasRole(s, /^session_chair$/) || p.startsWith("/chair");
  const myWork: Group = {
    kind: "group", key: "work", label: "My work", icon: ic(Briefcase), def: "subs",
    items: [
      { kind: "leaf", key: "subs", label: "My submissions", icon: ic(FileText), href: "/workspace/submissions", count: s?.submissionCount, on: p.startsWith("/workspace/submissions") || p.startsWith("/submissions/") || p.startsWith("/submit/") },
      ...(reviewer ? [{ kind: "leaf" as const, key: "reviews", label: "Reviews", icon: ic(PenLine), href: "/reviews", on: p.startsWith("/reviews") }] : []),
      ...(sessionChair ? [{ kind: "leaf" as const, key: "chair", label: "Sessions I chair", icon: ic(Presentation), href: "/chair", on: p.startsWith("/chair") }] : []),
      { kind: "leaf", key: "schedule", label: "My schedule", icon: ic(CalendarClock), href: "/workspace/schedule", on: p.startsWith("/workspace/schedule") || /^\/workspace\/events\/[^/]+\/program\/my-schedule/.test(p) },
      { kind: "leaf", key: "id", label: "My Plenary ID", icon: ic(IdCard), href: "/settings/profile#plenary-id", on: false },
    ],
  };
  const onEvents = p === "/workspace/events";
  const followed = s?.following ?? [];
  const find: Group = {
    kind: "group", key: "find", label: "Find events", icon: ic(Compass), def: "all",
    items: [
      { kind: "leaf", key: "all", label: "All open calls", icon: ic(Search), href: "/workspace/events", on: onEvents && !tab },
      { kind: "leaf", key: "mine", label: "My events", icon: ic(Briefcase), href: "/workspace/events?tab=mine", on: onEvents && tab === "mine" },
      followed.length
        ? {
          kind: "group" as const, key: "following", label: "Following", icon: ic(Star), def: "tab",
          items: [
            { kind: "leaf" as const, key: "tab", label: "All followed", href: "/workspace/events?tab=following", count: followed.length, on: onEvents && tab === "following" },
            ...followed.map((f) => ({ kind: "leaf" as const, key: f.slug, label: f.shortName ?? f.name, href: `/workspace/events/${f.slug}`, on: p === `/workspace/events/${f.slug}` })),
          ],
        }
        : { kind: "leaf" as const, key: "following", label: "Following", icon: ic(Star), href: "/workspace/events?tab=following", on: onEvents && tab === "following" },
    ],
  };
  const venues: Group | null = s?.venues?.length ? {
    kind: "group", key: "venues", label: "Your venues", icon: ic(Building2),
    items: s.venues.map((v, i) => {
      const ev = `/workspace/events/${v.slug}`;
      return {
        kind: "group" as const, key: `venue:${v.slug}`, label: v.shortName ?? v.name, icon: <span aria-hidden className="size-2.5 flex-none rounded-[2px]" style={{ background: VENUE_COLORS[i % VENUE_COLORS.length] }} />,
        dot: VENUE_COLORS[i % VENUE_COLORS.length], def: "me",
        items: [
          { kind: "leaf" as const, key: "me", label: "My page", icon: ic(UserRound), href: `/venues/${v.slug}/me`, on: p.startsWith(`/venues/${v.slug}/me`) },
          { kind: "leaf" as const, key: "event", label: "Event page", icon: ic(Compass), href: ev, on: p === ev || p === `${ev}/archive` },
          { kind: "leaf" as const, key: "program", label: "Program", icon: ic(CalendarRange), href: `${ev}/program`, on: p.startsWith(`${ev}/program`) },
          { kind: "leaf" as const, key: "register", label: "Register", icon: ic(Ticket), href: `/venues/${v.slug}/register`, on: p.startsWith(`/venues/${v.slug}/register`) },
          { kind: "leaf" as const, key: "badge", label: "Badge", icon: ic(BadgeCheck), href: `/venues/${v.slug}/badge`, on: p.startsWith(`/venues/${v.slug}/badge`) },
        ],
      };
    }),
  } : null;
  const admin: Group | null = s?.isAdmin ? {
    kind: "group", key: "admin", label: "Platform admin", icon: ic(ShieldCheck), def: "dash",
    items: [
      { kind: "leaf", key: "dash", label: "Dashboard", icon: ic(LayoutDashboard), href: "/admin", on: p.startsWith("/admin") },
      { kind: "leaf", key: "funnel", label: "Sign-up funnel", icon: ic(Filter), href: "/admin#signups", on: false },
    ],
  } : null;
  const account: Group = {
    kind: "group", key: "account", label: "Account", icon: ic(CircleUserRound), def: "/settings/profile",
    items: ACCOUNT_ITEMS.map(([href, label, icon, m]) => ({ kind: "leaf" as const, key: href, label, icon: ic(icon), href, on: m(p) })),
  };
  const settings: Group = {
    kind: "group", key: "settings", label: "Settings", icon: ic(Settings), def: "/settings/notifications",
    items: SETTINGS_ITEMS.map(([href, label, icon, m]) => ({ kind: "leaf" as const, key: href, label, icon: ic(icon), href, on: m(p) })),
  };
  return { myWork, find, venues, admin, account, settings };
}

function helpGroup(p: string): Group {
  return {
    kind: "group", key: "help", label: "Help & support", icon: ic(LifeBuoy), def: "help",
    items: [
      { kind: "leaf", key: "help", label: "Help & guides", icon: ic(CircleHelp), href: "/workspace/help", on: p.startsWith("/workspace/help") },
      { kind: "leaf", key: "support", label: "Contact support", icon: ic(MessageSquare), href: "/workspace/support", on: p.startsWith("/workspace/support") },
      { kind: "leaf", key: "legal", label: "Legal", icon: ic(Scale), href: "/workspace/legal/privacy", on: p.startsWith("/workspace/legal") },
    ],
  };
}

const leaves = (n: MenuNode): Leaf[] => (n.kind === "leaf" ? [n] : n.items.flatMap(leaves));
const hasOn = (n: MenuNode): boolean => leaves(n).some((l) => l.on);

/* ---------------------------------------------------------------- remembered state (this browser only) */

const subs = new Set<() => void>();
const listen = (f: () => void) => { subs.add(f); window.addEventListener("storage", f); return () => { subs.delete(f); window.removeEventListener("storage", f); }; };
const listenResize = (f: () => void) => { const off = listen(f); window.addEventListener("resize", f); return () => { off(); window.removeEventListener("resize", f); }; };
function read(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function write(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } subs.forEach((f) => f()); }
const useStored = (key: string) => useSyncExternalStore(listen, () => read(key), () => null);
function useMap(key: string): Record<string, string | boolean> {
  const raw = useStored(key) ?? "{}";
  try { return JSON.parse(raw) as Record<string, string | boolean>; } catch { return {}; }
}
const patchMap = (key: string, patch: Record<string, string | boolean>) => {
  let cur: Record<string, unknown> = {};
  try { cur = JSON.parse(read(key) ?? "{}"); } catch { /* bad JSON */ }
  write(key, JSON.stringify({ ...cur, ...patch }));
};

const OPEN_KEY = "plenary.sideGroups";
/** Groups open the first time; the rest stay folded until used. */
const OPEN_BY_DEFAULT = new Set(["work", "venues"]);
const LAST_KEY = "plenary.sideLast";
const RAIL_KEY = "plenary.sideRail";
const ORG_KEY = "plenary.orgEvent";
/** "auto" = full on large screens, icon bar on tablets and while submitting; "rail" / "full" = the person's choice. */
type Rail = "auto" | "rail" | "full";
const useRail = (): Rail => (useStored(RAIL_KEY) as Rail | null) ?? "auto";

/** Where a group's name leads: the last page opened in it, else its default page, else its first page. */
function target(g: Group, last: Record<string, string | boolean>): Leaf {
  const own = g.items.filter((n): n is Leaf => n.kind === "leaf");
  const pick = (k: unknown) => own.find((l) => l.key === k);
  return pick(last[g.key]) ?? pick(g.def) ?? own[0] ?? leaves(g)[0];
}

/* ---------------------------------------------------------------- pieces */

const rowBase = "flex items-center gap-2.5 rounded-[6px] px-3 text-[14px] no-underline";
const rowOn = "bg-[#E6EDFC] font-semibold text-[#0E1B3D]";
const rowOff = "text-[#121826] hover:bg-[#F5F6F3]";

function Count({ n }: { n?: number }) {
  return n ? <span className="ms-auto font-mono text-[12px] text-[#4A5263] rail:hidden">{n > 99 ? "99+" : n}</span> : null;
}

function LeafRow({ l, depth, onPick, t }: { l: Leaf; depth: number; onPick?: () => void; t: (k: string) => string }) {
  return (
    <Link href={l.href} onClick={onPick} aria-current={l.on ? "page" : undefined} prefetch={depth === 0 ? null : undefined}
      className={`${rowBase} ${depth ? "h-[34px]" : "h-9"} ${l.on ? rowOn : rowOff}`}>
      {depth > 1 ? null : l.icon}<span className="min-w-0 truncate">{t(l.label)}</span><Count n={l.count} />
    </Link>
  );
}

/** A group: name (opens + goes to its page), chevron (folds only), and its rows indented under a guide line. */
function GroupRow({ g, depth, open, onFold, last, onPick, t }: {
  g: Group; depth: number; open: (k: string, dflt: boolean) => boolean; onFold: (k: string, v: boolean) => void;
  last: Record<string, string | boolean>; onPick?: () => void; t: (k: string) => string;
}) {
  const isOpen = open(g.key, hasOn(g) || OPEN_BY_DEFAULT.has(g.key));
  const go = target(g, last);
  const active = hasOn(g);
  return (
    <div>
      <div className={`group/row flex items-center rounded-[6px] ${active && !isOpen ? "bg-[#EEF2FB]" : ""} hover:bg-[#F5F6F3]`}>
        <Link href={go.href} onClick={() => { onFold(g.key, true); onPick?.(); }} title={t(g.label)}
          className={`flex h-9 min-w-0 flex-auto items-center gap-2.5 ps-3 text-[14px] no-underline ${active ? "font-semibold text-[#0E1B3D]" : "text-[#121826]"}`}>
          {g.icon}<span className="min-w-0 truncate">{t(g.label)}</span>
        </Link>
        <button type="button" aria-expanded={isOpen} aria-label={t(g.label)}
          onClick={() => onFold(g.key, !isOpen)}
          className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent text-[#4A5263] hover:bg-[#E9ECF2]">
          <ChevronDown size={14} strokeWidth={2} aria-hidden className={`transition-transform ${isOpen ? "" : "-rotate-90 rtl:rotate-90"}`} />
        </button>
      </div>
      {isOpen ? (
        <ul className="m-0 mb-1 ms-[19px] flex list-none flex-col gap-px border-s border-[#DADDE3] p-0 ps-2">
          {g.items.map((n) => (
            <li key={n.key}>
              {n.kind === "leaf"
                ? <LeafRow l={n} depth={depth + 1} onPick={onPick} t={t} />
                : <GroupRow g={n} depth={depth + 1} open={open} onFold={onFold} last={last} onPick={onPick} t={t} />}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** A small panel beside the icon bar (or above the bottom row), listing a group's pages. Closes on Escape, outside click. */
function Flyout({ anchor, onClose, title, children, above }: { anchor: DOMRect; onClose: () => void; title: string; children: ReactNode; above?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const id = window.setTimeout(() => document.addEventListener("mousedown", out), 0);
    document.addEventListener("keydown", esc);
    ref.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => { window.clearTimeout(id); document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); };
  }, [onClose]);
  const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
  const top = Math.max(68, Math.min(anchor.top, window.innerHeight - 340));
  const pos = above
    ? { bottom: window.innerHeight - anchor.top + 6, ...(rtl ? { right: window.innerWidth - anchor.right } : { left: anchor.left }) }
    : { top, ...(rtl ? { right: window.innerWidth - anchor.left + 8 } : { left: anchor.right + 8 }) };
  return (
    <div ref={ref} role="dialog" aria-label={title}
      style={{ position: "fixed", ...pos }}
      className="z-50 w-[248px] rounded-[8px] border border-[#DADDE3] bg-white p-2 text-[#121826] shadow-[0_12px_32px_rgba(18,24,38,.16)]">
      <p className="m-0 px-3 pb-1.5 pt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{title}</p>
      <div className="flex max-h-[300px] flex-col gap-px overflow-y-auto">{children}</div>
    </div>
  );
}

/** Icon-bar button: a page opens directly; a group opens its flyout. */
function RailItem({ n, onPick, t }: { n: MenuNode; onPick?: () => void; t: (k: string) => string }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const on = hasOn(n);
  const cls = `relative mx-auto flex size-10 items-center justify-center rounded-[6px] border-0 no-underline ${on ? rowOn : `bg-transparent ${rowOff}`}`;
  if (n.kind === "leaf") {
    return (
      <Link href={n.href} onClick={onPick} title={t(n.label)} aria-current={n.on ? "page" : undefined} className={cls}>
        {n.icon}<span className="sr-only">{t(n.label)}</span>
        {n.count ? <span aria-hidden className="absolute end-1.5 top-1.5 size-2 rounded-full bg-[#F2A93B]" /> : null}
      </Link>
    );
  }
  const flat = (g: Group, depth: number): ReactNode[] => g.items.flatMap((x) => x.kind === "leaf"
    ? [<Link key={`${g.key}/${x.key}`} href={x.href} onClick={() => { setAnchor(null); onPick?.(); }} aria-current={x.on ? "page" : undefined}
        className={`${rowBase} h-[34px] ${depth ? "ps-7" : ""} ${x.on ? rowOn : rowOff}`}>{depth ? null : x.icon}<span className="truncate">{t(x.label)}</span></Link>]
    : [<p key={x.key} className="m-0 mt-1 flex items-center gap-2 px-3 py-1 text-[13px] font-semibold text-[#4A5263]">{x.icon}<span className="truncate">{t(x.label)}</span></p>, ...flat(x, depth + 1)]);
  return (
    <>
      <button type="button" title={t(n.label)} aria-haspopup="dialog" aria-expanded={!!anchor}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget.getBoundingClientRect())} className={`${cls} cursor-pointer`}>
        {n.icon}<span className="sr-only">{t(n.label)}</span>
      </button>
      {anchor ? <Flyout anchor={anchor} onClose={() => setAnchor(null)} title={t(n.label)}>{flat(n, 0)}</Flyout> : null}
    </>
  );
}

/* ---------------------------------------------------------------- organiser block */

function EventSwitcher({ org, p, t }: { org: NonNullable<ReturnType<typeof useOrganizer>>; p: string; t: (k: string) => string }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const router = useRouter();
  const many = org.events.length > 1;
  function pick(slug: string) {
    write(ORG_KEY, slug);
    setAnchor(null);
    const cur = manageSlug(p);
    // Same page in the other event when you're on an organiser page; else that event's dashboard.
    router.push(cur ? p.replace(`/manage/${cur}`, `/manage/${slug}`) : `/manage/${slug}`);
  }
  return (
    <div className="px-1">
      <button type="button" disabled={!many} aria-haspopup="dialog" aria-expanded={!!anchor}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget.getBoundingClientRect())}
        title={many ? t("Switch event") : org.name}
        className={`flex w-full items-center gap-2 rounded-[6px] border border-[#DADDE3] bg-[#F7F8F6] px-2.5 py-1.5 text-start ${many ? "cursor-pointer hover:border-[#B7BDC9]" : "cursor-default"}`}>
        <span className="min-w-0 flex-auto">
          <span className="block truncate text-[13px] font-semibold text-[#121826]">{org.name}</span>
          <span className="block font-mono text-[11px] uppercase tracking-[0.06em] text-[#A8600F]">{t(org.roleLabel)}</span>
        </span>
        {many ? <ChevronsUpDown size={14} strokeWidth={2} aria-hidden className="flex-none text-[#4A5263]" /> : null}
      </button>
      {anchor ? (
        <Flyout anchor={anchor} onClose={() => setAnchor(null)} title={t("Switch event")}>
          {org.events.map((e) => (
            <button key={e.slug} type="button" onClick={() => pick(e.slug)}
              className={`${rowBase} h-auto min-h-9 w-full cursor-pointer border-0 py-1.5 text-start ${e.slug === org.slug ? rowOn : `bg-transparent ${rowOff}`}`}>
              <span className="min-w-0 flex-auto"><span className="block truncate">{e.shortName ?? e.name}</span><span className="block font-mono text-[11px] uppercase text-[#4A5263]">{t(e.roleLabel)}</span></span>
              {e.slug === org.slug ? <Check size={14} aria-hidden className="flex-none" /> : null}
            </button>
          ))}
        </Flyout>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- lists */

function useTree(p: string, s: Summary | null, tab?: string) {
  const org = useOrganizer(p, s);
  const m = useMiddle(p, s, tab);
  const middle: MenuNode[] = [m.myWork, m.find, ...(m.venues ? [m.venues] : [])];
  const after: MenuNode[] = [...(m.admin ? [m.admin] : []), m.account, m.settings];
  return { org, middle, after, all: [...middle, ...(org?.groups ?? []), ...after, helpGroup(p)] };
}

/** Opens the groups holding the current page, and remembers that page as the group's last one. */
function useFollow(nodes: MenuNode[]) {
  const open = useMap(OPEN_KEY);
  const sig = nodes.map((n) => leaves(n).filter((l) => l.on).map((l) => `${n.key}/${l.key}`).join(",")).join("|");
  useEffect(() => {
    const openPatch: Record<string, boolean> = {};
    const lastPatch: Record<string, string> = {};
    const walk = (n: MenuNode) => {
      if (n.kind !== "group" || !hasOn(n)) return;
      if (open[n.key] === false) openPatch[n.key] = true;
      const own = n.items.find((x) => x.kind === "leaf" && x.on);
      if (own) lastPatch[n.key] = own.key;
      n.items.forEach(walk);
    };
    nodes.forEach(walk);
    if (Object.keys(openPatch).length) patchMap(OPEN_KEY, openPatch);
    if (Object.keys(lastPatch).length) patchMap(LAST_KEY, lastPatch);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Filter: every page whose name (or group) matches, flat, with its group as a hint. */
function FilterResults({ nodes, q, onPick, t }: { nodes: MenuNode[]; q: string; onPick?: () => void; t: (k: string) => string }) {
  const needle = q.trim().toLowerCase();
  const rows: { l: Leaf; path: string }[] = [];
  const walk = (n: MenuNode, path: string[]) => {
    if (n.kind === "leaf") {
      const hay = [t(n.label), ...path].join(" ").toLowerCase();
      if (hay.includes(needle)) rows.push({ l: n, path: path.join(" › ") });
    } else n.items.forEach((x) => walk(x, [...path, t(n.label)]));
  };
  nodes.forEach((n) => walk(n, []));
  if (!rows.length) return <p className="m-0 px-3 py-2 text-[13px] text-[#4A5263]">{t("No matching page.")}</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-px p-0">
      {rows.slice(0, 30).map(({ l, path }) => (
        <li key={`${path}/${l.key}`}>
          <Link href={l.href} onClick={onPick} className={`${rowBase} min-h-9 py-1 ${l.on ? rowOn : rowOff}`}>
            {l.icon}
            <span className="min-w-0"><span className="block truncate">{t(l.label)}</span>{path ? <span className="block truncate text-[11px] font-normal text-[#4A5263]">{path}</span> : null}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MenuFilter({ q, setQ, t, autoFocus }: { q: string; setQ: (v: string) => void; t: (k: string) => string; autoFocus?: boolean }) {
  return (
    <div className="relative mb-1.5 rail:hidden">
      <Search size={14} strokeWidth={2} aria-hidden className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-[#4A5263]" />
      <label htmlFor="menu-filter" className="sr-only">{t("Filter menu")}</label>
      <input id="menu-filter" type="search" value={q} autoFocus={autoFocus} onChange={(e) => setQ(e.target.value)} placeholder={t("Filter menu")} autoComplete="off"
        onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
        className="h-8 w-full rounded-[6px] border border-[#DADDE3] bg-[#F7F8F6] pe-7 ps-8 text-[13px] text-[#121826] outline-none placeholder:text-[#6B7385] focus:border-[#2F5FD0] focus:bg-white [&::-webkit-search-cancel-button]:hidden" />
      {q ? (
        <button type="button" onClick={() => setQ("")} aria-label={t("Clear")} className="absolute end-1 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-[#4A5263]">
          <X size={13} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** The menu body: used by the phone menu (always full, everything in one scroll). */
export function NavList({ p, s, onPick, tab }: { p: string; s: Summary | null; onPick?: () => void; tab?: string }) {
  const t = useT();
  const tree = useTree(p, s, tab);
  const [q, setQ] = useState("");
  const open = useMap(OPEN_KEY);
  const last = useMap(LAST_KEY);
  useFollow(tree.all);
  const isOpen = (k: string, d: boolean) => (typeof open[k] === "boolean" ? (open[k] as boolean) : d);
  const fold = (k: string, v: boolean) => patchMap(OPEN_KEY, { [k]: v });
  const top: Leaf[] = topLeaves(p, s);
  const render = (n: MenuNode) => n.kind === "leaf"
    ? <LeafRow key={n.key} l={n} depth={0} onPick={onPick} t={t} />
    : <GroupRow key={n.key} g={n} depth={0} open={isOpen} onFold={fold} last={last} onPick={onPick} t={t} />;
  return (
    <div className="flex flex-col gap-0.5">
      <MenuFilter q={q} setQ={setQ} t={t} />
      {q ? <FilterResults nodes={[...top, ...tree.all]} q={q} onPick={onPick} t={t} /> : (
        <>
          {top.map(render)}
          <Sep />
          {tree.middle.map(render)}
          {tree.org ? <><Sep label={t("Organizer")} /><EventSwitcher org={tree.org} p={p} t={t} />{tree.org.groups.map(render)}</> : null}
          <Sep />
          {tree.after.map(render)}
          {render(helpGroup(p))}
        </>
      )}
    </div>
  );
}

function topLeaves(p: string, s: Summary | null): Leaf[] {
  return [
    { kind: "leaf", key: "home", label: "Home", icon: ic(House), href: "/workspace", on: p === "/workspace" },
    { kind: "leaf", key: "inbox", label: "Inbox", icon: ic(Inbox), href: "/inbox", count: s?.unread, on: p.startsWith("/inbox") },
  ];
}

function Sep({ label }: { label?: string }) {
  return label
    ? <p className="m-0 mt-3 px-3 pb-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263] rail:hidden">{label}</p>
    : <div aria-hidden className="mx-2 my-2 border-t border-[#EEF0EC]" />;
}

/** The side menu (768 px and up). `data-rail` drives the icon-bar look through the `rail:` variant (globals.css). */
export function SideMenu({ p, s, tab }: { p: string; s: Summary | null; tab?: string }) {
  const t = useT();
  const rail = useRail();
  const tree = useTree(p, s, tab);
  const [q, setQ] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const open = useMap(OPEN_KEY);
  const last = useMap(LAST_KEY);
  useFollow(tree.all);
  const isOpen = (k: string, d: boolean) => (typeof open[k] === "boolean" ? (open[k] as boolean) : d);
  const fold = (k: string, v: boolean) => patchMap(OPEN_KEY, { [k]: v });
  const railNow = () => rail === "rail" || (rail === "auto" && (!window.matchMedia("(min-width: 1024px)").matches || [...document.querySelectorAll("[data-focus-mode]")].some((e) => !e.closest('[style*="display: none"]'))));
  const isRailNow = useSyncExternalStore(listenResize, railNow, () => false);
  const toggle = () => write(RAIL_KEY, railNow() ? "full" : "rail");
    const top = topLeaves(p, s);
  const help = helpGroup(p);

  const full = (n: MenuNode) => n.kind === "leaf"
    ? <LeafRow key={n.key} l={n} depth={0} t={t} />
    : <GroupRow key={n.key} g={n} depth={0} open={isOpen} onFold={fold} last={last} t={t} />;
  // Both looks are in the page; CSS shows one (no flash before the stored choice is read).
  const both = (n: MenuNode) => (
    <div key={n.key}>
      <div className="rail:hidden">{full(n)}</div>
      <div className="hidden rail:block"><RailItem n={n} t={t} /></div>
    </div>
  );

  return (
    <nav aria-label={t("Workspace")} data-rail={rail}
      className="side-menu sticky top-[60px] box-border hidden h-[calc(100dvh-60px)] w-[248px] flex-none flex-col border-e border-[#DADDE3] bg-white md:flex rail:w-16">
      <div className="flex flex-none flex-col gap-0.5 border-b border-[#EEF0EC] px-3 pb-2.5 pt-3 rail:items-center rail:px-2">
        {/* Only the header has a search box; the menu filter is a small icon that opens on demand. */}
        {filterOpen || q ? <MenuFilter q={q} setQ={(v) => { setQ(v); if (!v) setFilterOpen(false); }} t={t} autoFocus /> : null}
        <div className="mb-1 flex items-center gap-1.5 rail:flex-col">
          <Link href="/workspace/events?intent=submit" title={t("New submission")}
            className="flex h-9 min-w-0 flex-auto items-center justify-center gap-2 rounded-[6px] bg-[#F2A93B] text-[14px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26] rail:size-10 rail:flex-none rail:p-0">
            <Plus size={16} strokeWidth={2.25} aria-hidden /><span className="rail:sr-only">{t("New submission")}</span>
          </Link>
          <button type="button" aria-expanded={filterOpen || !!q} title={t("Filter menu")}
            onClick={() => { if (railNow()) toggle(); setFilterOpen((o) => !o || !!q); }}
            className={`flex size-9 flex-none cursor-pointer items-center justify-center rounded-[6px] border border-[#DADDE3] bg-white text-[#4A5263] hover:bg-[#F5F6F3] rail:size-10 ${filterOpen || q ? "border-[#2F5FD0] text-[#2F5FD0]" : ""}`}>
            <Search {...I} /><span className="sr-only">{t("Filter menu")}</span>
          </button>
        </div>
        {top.map(both)}
      </div>
      <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain px-3 pb-4 pt-2 rail:px-2">
        {q ? <FilterResults nodes={[...top, ...tree.all]} q={q} t={t} /> : (
          <div className="flex flex-col gap-0.5 rail:items-center">
            {tree.middle.map(both)}
            {tree.org ? (
              <>
                <Sep label={t("Organizer")} />
                <div aria-hidden className="mx-2 my-2 hidden w-8 border-t border-[#EEF0EC] rail:block" />
                <div className="mb-1 rail:hidden"><EventSwitcher org={tree.org} p={p} t={t} /></div>
                {tree.org.groups.map(both)}
              </>
            ) : null}
            <div aria-hidden className="mx-2 my-2 border-t border-[#EEF0EC] rail:w-8" />
            {tree.after.map(both)}
          </div>
        )}
      </div>
      <div className="flex flex-none flex-col gap-0.5 border-t border-[#DADDE3] px-3 py-2.5 rail:items-center rail:px-2">
        <div className="flex items-center gap-1 rail:flex-col">
          <div className="min-w-0 flex-auto rail:hidden"><HelpButton g={help} t={t} /></div>
          <div className="hidden rail:block"><RailItem n={help} t={t} /></div>
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

/** Help & support in the fixed bottom: one row that opens its three pages in a panel above it. */
function HelpButton({ g, t }: { g: Group; t: (k: string) => string }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const on = hasOn(g);
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-expanded={!!anchor}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget.getBoundingClientRect())}
        className={`${rowBase} h-9 w-full cursor-pointer border-0 text-start ${on ? rowOn : `bg-transparent text-[#4A5263] hover:bg-[#F5F6F3]`}`}>
        {g.icon}<span className="min-w-0 flex-auto truncate">{t(g.label)}</span>
      </button>
      {anchor ? (
        <Flyout above anchor={anchor} onClose={() => setAnchor(null)} title={t(g.label)}>
          {g.items.map((n) => n.kind === "leaf" ? <LeafRow key={n.key} l={n} depth={0} onPick={() => setAnchor(null)} t={t} /> : null)}
        </Flyout>
      ) : null}
    </>
  );
}
