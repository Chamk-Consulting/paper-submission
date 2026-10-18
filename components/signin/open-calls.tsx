import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

type Call = { slug: string; name: string; short_name: string | null; location: string | null; starts_on: string | null; kind: string };

async function getOpenCalls(): Promise<Call[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("venues");
  const { data } = await createPublicClient()
    .from("venues")
    .select("slug, name, short_name, location, starts_on, kind")
    .eq("is_published", true)
    .order("starts_on", { ascending: true })
    .limit(4);
  return (data as Call[] | null) ?? [];
}

const month = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleString("en", { month: "short", year: "numeric", timeZone: "UTC" }) : null;

/** Right-hand navy panel of canvas PR02, filled with real published venues. */
export async function OpenCallsPanel() {
  const calls = await getOpenCalls();
  return (
    <aside aria-label="Open calls for papers" className="box-border flex min-w-0 flex-[7_1_520px] flex-col justify-center bg-[#0E1B3D] px-6 py-14 text-[#F5F6F3] sm:px-16">
      <p className="m-0 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#F2A93B]">Open calls · shown in your time zone</p>
      <h2 className="mt-3.5 max-w-[20ch] font-serif text-[44px] font-[350] leading-[1.08] tracking-[-0.015em]">Every deadline you care about, in one place.</h2>
      <div className="mt-8 overflow-hidden rounded-[8px] bg-[#17285A]">
        <div className="grid grid-cols-12 gap-3 border-b border-[#24335C] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[#B9C3DA]">
          <span className="col-span-6">Venue</span><span className="col-span-3">Where</span><span className="col-span-3 text-right">Closes in</span>
        </div>
        {calls.length ? (
          calls.map((v) => (
            <div key={v.slug} className="grid grid-cols-12 items-center gap-3 border-t border-[#24335C] px-5 py-3.5">
              <div className="col-span-6 min-w-0">
                <div className="font-semibold">{v.name}</div>
                <div className="mt-0.5 text-[13px] text-[#B9C3DA]">
                  <span className="mr-1.5 rounded-[2px] bg-[#E6EDFC] px-1.5 py-px font-mono text-[11px] uppercase text-[#1F47A8]">{v.short_name ?? v.kind}</span>
                  {v.kind}
                </div>
              </div>
              <div className="col-span-3 text-[13px] text-[#D6DCEA]">{[v.location, month(v.starts_on)].filter(Boolean).join(" · ") || "—"}</div>
              {/* TODO(data): submission deadlines (submission_types table, week 2) -> countdown; saffron when < 7 days. */}
              <div className="col-span-3 text-right font-mono text-[14px] font-medium text-[#D6DCEA]">Open</div>
            </div>
          ))
        ) : (
          <div className="border-t border-[#24335C] px-5 py-6 text-[14px] text-[#B9C3DA]">No open calls yet — new venues appear here as soon as they publish.</div>
        )}
      </div>
      <div className="mt-3.5 flex flex-wrap justify-between gap-3">
        <span className="font-mono text-[12px] text-[#B9C3DA]">Saffron = closes within 7 days.</span>
        <Link href="/" className="text-[14px] font-medium text-[#F2A93B]">Browse all venues →</Link>
      </div>
      <div className="mt-10 grid grid-cols-3 gap-4 border-t border-[#24335C] pt-6">
        <div><div className="text-[14px] font-semibold">One account</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">Every venue, every role.</div></div>
        <div><div className="text-[14px] font-semibold">Blind review protected</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">Identity hidden at the data layer.</div></div>
        {/* Supabase project region: eu-central-1 (Frankfurt). */}
        <div><div className="text-[14px] font-semibold">Data in the EU</div><div className="mt-0.5 text-[13px] text-[#B9C3DA]">GDPR consent, recorded once.</div></div>
      </div>
    </aside>
  );
}
