"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/auth/actions";
import { useT } from "@/lib/i18n/client";
import { InstallMenuItem } from "@/components/pwa/install-prompt";

export function AccountMenu({ name, initials, plenaryId }: { name: string; initials: string; plenaryId: string | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const item = "block px-3.5 py-[9px] text-[14px] text-[#121826] no-underline hover:bg-[#F5F6F3]";
  const soon = "block px-3.5 py-[9px] text-[14px] text-[#9AA3B5]";
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={t("Account menu")} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-full border border-[#2A3C6E] bg-transparent py-0 pl-1 pr-2.5 text-[14px] text-[#F5F6F3]">
        <span className="flex size-[30px] items-center justify-center rounded-full bg-[#E6EDFC] text-[13px] font-semibold text-[#1F47A8]">{initials}</span>
        <span className="hidden max-w-[180px] truncate sm:inline">{name}</span>
        <span aria-hidden className="text-[10px]">▾</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-[50px] z-20 w-[260px] overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white text-[#121826] shadow-[0_12px_32px_rgba(18,24,38,.16)]">
          <div className="border-b border-[#EEF0EC] px-3.5 py-3">
            <div className="truncate font-semibold">{name}</div>
            {plenaryId ? <div className="font-mono text-[12px] text-[#4A5263]">{plenaryId}</div> : null}
          </div>
          <Link role="menuitem" href="/create-account/profile" className={item}>{t("Profile & expertise")}</Link>
          <InstallMenuItem className={`${item} w-full border-0 bg-transparent text-left`} />
          {/* TODO(settings): ST02–ST04 */}
          <span role="menuitem" aria-disabled className={soon}>{t("Sign-in & security")} · {t("soon")}</span>
          <span role="menuitem" aria-disabled className={soon}>{t("Notifications")} · {t("soon")}</span>
          <span role="menuitem" aria-disabled className={soon}>{t("Privacy & data")} · {t("soon")}</span>
          <form action={signOut} className="border-t border-[#EEF0EC]">
            <button role="menuitem" type="submit" className="block w-full border-0 bg-transparent px-3.5 py-[9px] text-left text-[14px] text-[#B3261E] hover:bg-[#FDECEA]">{t("Sign out")}</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
