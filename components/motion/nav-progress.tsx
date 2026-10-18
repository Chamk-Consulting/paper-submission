"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin saffron bar that reacts the moment an internal link is clicked and completes when the new URL
 * commits. It only appears if the navigation takes longer than ~80 ms, so instant (prefetched) pages
 * don't flash it. Drives the DOM directly: no re-renders while it runs.
 */
export function NavProgress() {
  const bar = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";

  const clear = () => { timers.current.forEach((id) => window.clearTimeout(id)); timers.current = []; };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (/\.(pdf|ics)$/.test(url.pathname)) return;
      clear();
      timers.current.push(window.setTimeout(() => { if (bar.current) bar.current.dataset.state = "loading"; }, 80));
      // safety net: never leave the bar hanging (e.g. a navigation that was cancelled)
      timers.current.push(window.setTimeout(() => { if (bar.current?.dataset.state === "loading") bar.current.dataset.state = "done"; }, 10000));
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); clear(); };
  }, []);

  useEffect(() => {
    clear();
    const el = bar.current;
    if (!el) return;
    if (el.dataset.state === "loading") {
      el.dataset.state = "done";
      timers.current.push(window.setTimeout(() => { delete el.dataset.state; }, 500));
    } else delete el.dataset.state;
  }, [pathname, search]);

  return <div ref={bar} className="nav-progress" aria-hidden />;
}
