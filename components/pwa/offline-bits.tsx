"use client";

import { useEffect, useState } from "react";
import { PAGE_CACHE } from "@/components/pwa/constants";
import { useBrand } from "@/lib/i18n/client";

export function RetryButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.location.reload()} className="mt-6 inline-flex h-11 items-center rounded-[4px] border-0 bg-[#F2A93B] px-5 text-[15px] font-semibold text-[#0E1B3D] hover:bg-[#E89B26]">
      {label}
    </button>
  );
}

/** Lists public pages the service worker saved, so people can still read venues and deadlines offline. */
export function SavedPages({ title, empty }: { title: string; empty: string }) {
  const brand = useBrand();
  const [pages, setPages] = useState<{ href: string; label: string }[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cache = await caches.open(PAGE_CACHE);
        const keys = (await cache.keys()).filter((r) => {
          const path = new URL(r.url).pathname;
          return !path.startsWith("/__") && path !== "/offline" && !/^\/(en|fr|it|de)\/offline$/.test(path);
        });
        // Show each saved page by its real title (read from the stored HTML).
        const list = await Promise.all(keys.slice(0, 12).map(async (r) => {
          const href = new URL(r.url).pathname;
          const html = await (await cache.match(r))?.text().catch(() => "") ?? "";
          const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.replace(/\s*·\s*[^·]+$/, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "’").trim();
          return { href, label: title || (href === "/" ? brand : href) };
        }));
        if (alive) setPages(list.slice(0, 12));
      } catch {
        if (alive) setPages([]);
      }
    })();
    return () => { alive = false; };
  }, []);
  if (pages === null) return null;
  return (
    <section className="mt-7 border-t border-[#EEF0EC] pt-5">
      <h2 className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{title}</h2>
      {pages.length ? (
        <ul className="m-0 mt-2 list-none p-0">
          {pages.map((p) => <li key={p.href}><a href={p.href} className="block py-1.5 text-[#2F5FD0]">{p.label}</a></li>)}
        </ul>
      ) : <p className="mb-0 mt-2 text-[14px] text-[#4A5263]">{empty}</p>}
    </section>
  );
}
