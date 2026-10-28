"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, CalendarRange, Check, ChevronDown, ClipboardList, ExternalLink, Link2, Mic, Ticket } from "lucide-react";
import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";

/**
 * The extra actions of an event, behind one "More" button: details, dates, program, registration, calendar file,
 * copy link. Shared by the event cards (directory) and the event page header, so they offer the same things.
 */
export function EventMoreMenu({ slug, ws, kind, tone = "light", align = "end" }: { slug: string; ws?: boolean; kind: string; tone?: "light" | "dark"; align?: "start" | "end" }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const base = ws ? `/workspace/events/${slug}` : `/events/${slug}`;
  const meeting = kind !== "journal";
  const items: { icon: React.ReactNode; label: string; href?: string; file?: boolean; onClick?: () => void }[] = [
    { icon: <ClipboardList size={15} aria-hidden />, label: "Event details", href: base },
    { icon: <CalendarRange size={15} aria-hidden />, label: "Important dates", href: `${base}#dates` },
    ...(meeting ? [
      { icon: <Mic size={15} aria-hidden />, label: "Program", href: ws ? `/workspace/events/${slug}/program` : `/program/${slug}` },
      { icon: <Ticket size={15} aria-hidden />, label: "Register to attend", href: `/venues/${slug}/register` },
    ] : []),
    { icon: <CalendarPlus size={15} aria-hidden />, label: "Add deadlines to calendar", href: `/venues/${slug}/calendar.ics`, file: true },
    {
      icon: copied ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />, label: copied ? "Link copied" : "Copy link",
      onClick: () => {
        const url = `${window.location.origin}/events/${slug}`;
        navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
      },
    },
  ];
  const btn = tone === "dark"
    ? "border-white/40 bg-white/10 text-white hover:bg-white/20"
    : "border-[#B7BDC9] bg-white text-[#121826] hover:bg-[#F7F8F6]";
  const row = "flex w-full items-center gap-2.5 whitespace-nowrap rounded-[4px] border-0 bg-transparent px-2.5 py-2 text-left text-[14px] text-[#121826] no-underline hover:bg-[#F2F3F0]";
  return (
    <div ref={box} className="relative inline-block text-left">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-full min-h-[34px] items-center gap-1 rounded-[4px] border px-2.5 text-[13px] font-semibold ${btn}`}>
        {t("More")}<ChevronDown size={14} aria-hidden className={open ? "rotate-180" : ""} />
      </button>
      {open ? (
        <div role="menu" className={`absolute z-30 mt-1 min-w-[230px] rounded-[6px] border border-[#DADDE3] bg-white p-1 shadow-[0_8px_24px_rgba(14,27,61,0.16)] ${align === "end" ? "right-0" : "left-0"}`}>
          {items.map((it) => it.onClick ? (
            <button key={it.label} type="button" role="menuitem" onClick={it.onClick} className={row}>{it.icon}{t(it.label)}</button>
          ) : it.file ? (
            <a key={it.label} role="menuitem" href={it.href} className={row} onClick={() => setOpen(false)}>{it.icon}{t(it.label)}</a>
          ) : (
            <Link key={it.label} role="menuitem" href={it.href!} className={row} onClick={() => setOpen(false)}>{it.icon}{t(it.label)}</Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The event's own website, opened in a new tab. */
export function WebsiteButton({ url, tone = "light", size = "sm" }: { url: string; tone?: "light" | "dark"; size?: "sm" | "lg" }) {
  const t = useT();
  const cls = tone === "dark" ? "border-white/40 bg-white/10 text-white hover:bg-white/20" : "border-[#B7BDC9] bg-white text-[#121826] hover:bg-[#F7F8F6]";
  const h = size === "lg" ? "h-11 px-4 text-[15px] font-medium" : "h-[34px] px-2.5 text-[13px] font-semibold";
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 rounded-[4px] border no-underline ${h} ${cls}`}>
      {t("Official website")}<ExternalLink size={size === "lg" ? 15 : 13} aria-hidden /><span className="sr-only">{t("(opens in a new tab)")}</span>
    </a>
  );
}
