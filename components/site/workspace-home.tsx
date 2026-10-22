"use client";

import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";
import { useWhen } from "@/components/site/due-next";

/* Small client pieces of WS01 that depend on the viewer's clock and time zone. */

export function Greeting({ first }: { first: string | null }) {
  const t = useT();
  const now = new Date();
  const h = now.getHours();
  const hello = h < 5 ? t("Good evening") : h < 12 ? t("Good morning") : h < 18 ? t("Good afternoon") : t("Good evening");
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = now.toLocaleDateString(t.intl, { weekday: "long", day: "numeric", month: "long" });
  return (
    <>
      <p className="m-0 font-mono text-[12px] text-[#4A5263]" suppressHydrationWarning>{t("{date} · times in {tz}", { date, tz: tz.replace(/_/g, " ") })}</p>
      <h1 className="mt-1.5 font-serif text-[36px] font-normal leading-[1.1] tracking-[-0.01em] sm:text-[40px]" suppressHydrationWarning>{first ? `${hello}, ${first}` : hello}</h1>
    </>
  );
}

export type OpenCall = { slug: string; name: string; kind: string; at: string };
export function OpenCalls({ calls, mine, now }: { calls: OpenCall[]; mine: boolean; now: number }) {
  const t = useT();
  const when = useWhen();
  return (
    <section className="rounded-[8px] bg-[#0E1B3D] p-5 text-[#F5F6F3]">
      <div className="flex items-center justify-between">
        <h2 className="m-0 font-serif text-[20px] font-normal">{mine ? t("Open calls in your fields") : t("Open calls")}</h2>
        <Link href="/venues" className="text-[13px] font-semibold text-[#F2A93B]">{t("All →")}</Link>
      </div>
      {calls.length ? (
        <ul className="m-0 mt-3 list-none p-0">
          {calls.map((c) => {
            const w = when(c.at, now);
            return (
              <li key={c.slug} className="border-b border-[#24335C] py-2.5 last:border-b-0">
                <Link href={`/venues/${c.slug}`} className="block text-[14px] font-medium text-[#F5F6F3] no-underline hover:underline">{c.name}</Link>
                <span className="flex justify-between gap-3 text-[12px] text-[#B9C3DA]">
                  <span>{t(c.kind)}</span>
                  <span className={w.soon ? "font-semibold text-[#F2A93B]" : ""} suppressHydrationWarning>{t("Closes {when}", { when: w.text.toLowerCase() })}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : <p className="mb-0 mt-3 text-[14px] text-[#B9C3DA]">{t("No open calls right now.")}</p>}
    </section>
  );
}

export function RelTime({ iso }: { iso: string }) {
  const t = useT();
  const d = new Date(iso);
  const same = d.toDateString() === new Date().toDateString();
  return <span suppressHydrationWarning>{same ? d.toLocaleTimeString(t.intl, { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString(t.intl, { day: "numeric", month: "short" })}</span>;
}
