import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { ConflictsForm, type Member } from "@/components/submission/conflicts-form";
import { asideCard, kicker } from "@/components/submission/shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conflicts" };
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "conflicts");
  const supabase = await createClient();
  const { data } = await supabase.rpc("venue_committee", { p_venue: ctx.venue.id });
  const committee: Member[] = ((data ?? []) as Record<string, unknown>[])
    .filter((m) => !ctx.authors.some((a) => a.personId === m.person_id))
    .map((m) => ({ personId: m.person_id as string, name: (m.display_name as string) || "Unnamed", institution: (m.institution as string) ?? null, role: m.role as string }));
  const byInst = new Map<string, string[]>();
  for (const a of ctx.authors) if (a.institution) byInst.set(a.institution, [...(byInst.get(a.institution) ?? []), a.isYou ? "You" : a.name]);
  const auto = [...byInst.entries()].map(([inst, who]) => ({ kind: "institution", title: inst, text: `${who.join(" and ")} ${who.length > 1 || who[0] === "You" ? "work" : "works"} here.`, source: "From author list" }));
  const initial = Object.fromEntries(ctx.conflicts.filter((c) => c.personId).map((c) => [c.personId!, c.reason]));
  const total = auto.length + Object.keys(initial).length;
  return (
    <SubmissionFrame ctx={ctx} step="conflicts" aside={
      <>
        <section className={asideCard}>
          <p className={kicker}>Conflicts on this paper</p>
          <div className="mt-2 font-serif text-[30px] leading-none">{total}</div>
          <p className="mb-0 mt-1.5 text-[14px] text-[#4A5263]">{auto.length} found automatically · {Object.keys(initial).length} added by you</p>
        </section>
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">How conflicts are used</h3>
          <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
            <li>People with a conflict never see your paper or its reviews.</li>
            <li>Editors can&apos;t assign them, even by mistake.</li>
            <li>Your reasons are visible to the program chair only.</li>
          </ul>
        </section>
        <div className="rounded-[8px] border border-[#F1D29A] bg-[#FFF6E6] px-4 py-3.5 text-[14px] text-[#3B2A07]"><strong>Don&apos;t use conflicts to avoid tough reviewers.</strong> Conflicts without a real reason can lead to desk rejection.</div>
      </>
    }>
      <ConflictsForm id={id} auto={auto} committee={committee} initial={initial} />
    </SubmissionFrame>
  );
}

/** Canvas SB06-Conflicts. */
export default function Page(props: P) {
  return <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}><Inner {...props} /></Suspense>;
}
