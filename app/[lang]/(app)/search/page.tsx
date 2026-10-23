import Link from "@/components/site/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SearchSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { search, type SearchHit } from "@/lib/account/data";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Search") };
}

type Tab = "all" | SearchHit["kind"];
const TABS: [Tab, string][] = [["all", "All"], ["paper", "My papers"], ["venue", "Venues"], ["person", "People"], ["review", "Reviews"]];
const KIND: Record<SearchHit["kind"], [string, string, string]> = {
  paper: ["MY PAPER", "#E6EDFC", "#1F47A8"], venue: ["VENUE", "#E1F3EA", "#14603F"], person: ["PERSON", "#EEF0EC", "#4A5263"], review: ["REVIEW", "#FBEFDD", "#7A4508"],
};

async function Inner({ searchParams }: { searchParams: Promise<{ q?: string; t?: string }> }) {
  const [{ q: rawQ, t: rawTab }, ctx, t] = await Promise.all([searchParams, getWorkspaceCtx(), getT()]);
  const q = (rawQ ?? "").trim().slice(0, 120);
  if (!ctx) redirect(`/sign-in?next=${encodeURIComponent(`/search${q ? `?q=${q}` : ""}`)}`);
  const tab: Tab = TABS.some(([k]) => k === rawTab) ? (rawTab as Tab) : "all";
  const hits = await search(q);
  const count = (k: Tab) => (k === "all" ? hits.length : hits.filter((h) => h.kind === k).length);
  const shown = tab === "all" ? hits : hits.filter((h) => h.kind === tab);
  const href = (k: Tab) => `/search?${new URLSearchParams({ q, ...(k === "all" ? {} : { t: k }) }).toString()}`;

  return (
    <WorkspaceShell ctx={ctx} active="m:search">
      <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Search")}</p>
      <h1 className="mb-0 mt-1.5 break-words font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{q ? t("Results for “{q}”", { q }) : t("Search")}</h1>
      <p className="mb-0 mt-1.5 text-[#4A5263]">
        {q.length >= 2 ? t("{n} results across your papers, venues, people and reviews.", { n: hits.length }) : t("Find your papers, venues, people and reviews.")}
      </p>

      <form role="search" action="/search" className="mt-4 flex items-center gap-2.5">
        <label htmlFor="sq" className="sr-only">{t("Search")}</label>
        <input id="sq" name="q" type="search" defaultValue={q} minLength={2} maxLength={120} placeholder={t("Search papers, venues, people")} autoFocus={!q}
          className="box-border h-[42px] max-w-[560px] flex-auto rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[15px] text-[#121826]" />
        {tab !== "all" ? <input type="hidden" name="t" value={tab} /> : null}
        <button type="submit" className="inline-flex h-[42px] items-center rounded-[4px] border-0 bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white">{t("Search")}</button>
      </form>

      {q.length >= 2 ? (
        <>
          <nav aria-label={t("Result types")} className="mt-3.5 flex gap-1.5 overflow-x-auto border-b border-[#DADDE3]">
            {TABS.map(([k, label]) => {
              const on = tab === k;
              return (
                <Link key={k} href={href(k)} aria-current={on ? "page" : undefined} scroll={false}
                  className={`inline-flex h-10 items-center whitespace-nowrap border-b-[3px] px-3.5 text-[14px] font-semibold no-underline ${on ? "border-[#F2A93B] text-[#121826]" : "border-transparent text-[#4A5263] hover:text-[#121826]"}`}>
                  {t(label)} {count(k)}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 flex flex-col gap-2.5">
            {shown.length === 0 ? (
              <p className="m-0 rounded-[8px] border border-[#DADDE3] bg-white px-4 py-5 text-[14px] text-[#4A5263]">
                {t("No results. Try fewer words, a paper number like #1234, or a Plenary ID.")}
              </p>
            ) : shown.map((h) => {
              const [label, bg, ink] = KIND[h.kind];
              const inner = (
                <>
                  <span className="flex-none rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]" style={{ background: bg, color: ink }}>{t(label)}</span>
                  <span className="min-w-0"><span className="block break-words font-semibold">{h.title}</span>{h.meta ? <span className="block text-[13px] text-[#4A5263]">{h.meta}</span> : null}</span>
                </>
              );
              const cls = "flex items-start gap-3.5 rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5 text-[#121826] no-underline";
              return h.href
                ? <Link key={`${h.kind}-${h.id}`} href={h.href} className={`${cls} hover:border-[#B7BDC9]`}>{inner}</Link>
                : <div key={`${h.kind}-${h.id}`} className={cls}>{inner}</div>;
            })}
          </div>
        </>
      ) : null}
    </WorkspaceShell>
  );
}

/** Canvas SR01-Search. Only data the signed-in person may see (search_everything runs with their RLS). */
export default function Page({ searchParams }: { searchParams: Promise<{ q?: string; t?: string }> }) {
  return (
    <Reveal fallback={<SearchSkeleton />}>
      <Inner searchParams={searchParams} />
    </Reveal>
  );
}
