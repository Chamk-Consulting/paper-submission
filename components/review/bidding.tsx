"use client";

import { useMemo, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { placeBid } from "@/lib/review/actions";
import type { BidPaper } from "@/lib/review/data";
import { paperNo } from "@/lib/review/shared";
import Link from "@/components/site/link";
import { Tag } from "@/components/review/parts";

type Level = "eager" | "willing" | "not_my_area" | "conflict";
const LEVELS: [Level, string][] = [["eager", "Eager"], ["willing", "Willing"], ["not_my_area", "Not my area"], ["conflict", "Conflict"]];
const COL: Record<Level, string> = { eager: "#18744F", willing: "#2F5FD0", not_my_area: "#9AA3B5", conflict: "#B3261E" };
type Filter = "match" | "none" | "mine" | "all";
const TARGET = 30;

/** RV10 — bid on papers (click again to clear). */
export function Bidding({ papers, open, matches = {}, hasTopics = false }: {
  papers: BidPaper[]; open: boolean; matches?: Record<string, { score: number; matched: string[] }>; hasTopics?: boolean;
}) {
  const t = useT();
  const [bids, setBids] = useState<Record<string, Level | null>>(() => Object.fromEntries(papers.map((p) => [p.submission_id, (p.my_bid as Level | null) ?? null])));
  const [filter, setFilter] = useState<Filter>("match");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();

  const vals = Object.values(bids).filter(Boolean) as Level[];
  const count = (l: Level) => vals.filter((v) => v === l).length;
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = papers.filter((p) => {
      if (needle && !`${p.title} ${p.abstract ?? ""} ${(p.keywords ?? []).join(" ")}`.toLowerCase().includes(needle)) return false;
      if (filter === "none") return !bids[p.submission_id];
      if (filter === "mine") return !!bids[p.submission_id];
      return true;
    });
    // "Best match": most topic overlap first, then paper number (RV10)
    return filter === "match" ? [...out].sort((a, b) => (matches[b.submission_id]?.score ?? 0) - (matches[a.submission_id]?.score ?? 0) || a.number - b.number) : out;
  }, [papers, q, filter, bids, matches]);

  const pick = (id: string, l: Level) => {
    const prev = bids[id] ?? null;
    const next = prev === l ? null : l;
    setBids((b) => ({ ...b, [id]: next }));
    setErr(null);
    start(async () => {
      const r = await placeBid(id, next);
      if (r.error) { setErr(r.error); setBids((b) => ({ ...b, [id]: prev })); }
    });
  };

  const filters: [Filter, string][] = [["match", t("Best match")], ["none", t("Not bid yet")], ["mine", t("My bids")], ["all", t("All {n}", { n: papers.length })]];

  return (
    <>
      <section className="mt-5 flex flex-wrap items-center gap-6 rounded-[8px] border border-[#DADDE3] bg-white px-5 py-4">
        <div className="min-w-[220px] flex-auto">
          <div className="flex items-baseline justify-between text-[14px]"><span className="font-medium">{t("Your bids")}</span><span className="text-[13px] text-[#4A5263]">{t("aim for at least 30")}</span></div>
          <div className="mt-1 font-serif text-[28px] leading-none">{vals.length} <span className="text-[16px] text-[#4A5263]">/ {TARGET}</span></div>
          <div className="mt-2 h-2 rounded-full bg-[#EEF0EC]"><div className="h-2 rounded-full bg-[#18744F]" style={{ width: `${Math.min(100, (vals.length / TARGET) * 100)}%` }} /></div>
        </div>
        {([["Eager", count("eager"), "#14603F"], ["Willing", count("willing"), "#1F47A8"], ["Conflicts", count("conflict"), "#B3261E"]] as const).map(([k, v, c]) => (
          <div key={k} className="text-center"><div className="font-serif text-[28px] leading-none" style={{ color: c }}>{v}</div><div className="text-[12px] text-[#4A5263]">{t(k)}</div></div>
        ))}
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {filters.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
            className={`h-9 rounded-full border px-3.5 text-[14px] ${filter === k ? "border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#4A5263]"}`}>{l}</button>
        ))}
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("Search abstracts")} placeholder={t("Search title or abstract")}
          className="ml-auto h-9 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px] sm:w-[280px]" />
      </div>
      {filter === "match" && !hasTopics ? (
        <p className="mb-0 mt-2 text-[14px] text-[#4A5263]">{t("Add your topics to sort papers by how well they match you.")} <Link href="/workspace/account/reviewer" className="text-[#2F5FD0]">{t("Edit my topics")}</Link></p>
      ) : null}
      {err ? <p role="alert" className="mb-0 mt-2 text-[14px] text-[#B3261E]">{t(err)}</p> : null}

      <div className="mt-4 flex flex-col gap-3">
        {list.length === 0 ? <p className="rounded-[8px] border border-[#DADDE3] bg-white px-5 py-8 text-center text-[14px] text-[#4A5263]">{t("Nothing in this list.")}</p> : null}
        {list.map((p) => {
          const v = bids[p.submission_id];
          return (
            <article key={p.submission_id} className={`relative overflow-hidden rounded-[8px] border bg-white py-4 pl-6 pr-5 ${v === "conflict" ? "border-[#F3C3BE]" : "border-[#DADDE3]"}`}>
              <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: v ? COL[v] : "transparent" }} />
              <div className="flex flex-wrap items-center gap-1.5"><Tag tone="n">{paperNo(p.number)}</Tag>{p.topic ? <Tag tone="b">{p.topic}</Tag> : null}
                {matches[p.submission_id] ? <span className="text-[12px] text-[#14603F]">✓ {t("Matches your topics: {list}", { list: matches[p.submission_id].matched.slice(0, 3).join(", ") })}</span> : null}</div>
              <h2 className="mb-0 mt-2 font-serif text-[20px] font-normal leading-[1.3]">{p.title}</h2>
              {p.abstract ? <p className="mb-0 mt-1.5 line-clamp-3 text-[14px] text-[#4A5263]">{p.abstract}</p> : null}
              <div role="radiogroup" aria-label={t("Your bid")} className="mt-3 flex flex-wrap gap-2">
                {LEVELS.map(([k, l]) => {
                  const on = v === k;
                  return (
                    <button key={k} type="button" role="radio" aria-checked={on} disabled={!open} onClick={() => pick(p.submission_id, k)}
                      style={on ? { background: COL[k], borderColor: COL[k] } : undefined}
                      className={`h-9 rounded-[4px] border px-3.5 text-[14px] font-medium disabled:opacity-60 ${on ? "text-white" : "border-[#DADDE3] bg-white text-[#4A5263]"}`}>{t(l)}</button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-5 text-[13px] text-[#4A5263]">{t("Authors are hidden (double-blind). Choosing “Conflict” removes the paper from your assignments for good (B6). Papers you co-authored or from your institution are already hidden.")}</p>
    </>
  );
}
