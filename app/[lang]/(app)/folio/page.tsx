import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "@/components/site/link";
import { listFolioPapers } from "@/lib/folio/data";
import { createFolioPaper } from "@/lib/folio/actions";
import { TEMPLATES } from "@/lib/folio/templates";

/* Folio home (phase 1): your papers, and a new paper from a starter template. */

export const metadata: Metadata = { title: "Folio · my papers", robots: { index: false } };

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function Papers() {
  const papers = await listFolioPapers();
  if (!papers.length) return <p className="m-0 rounded-[8px] border border-dashed border-[#B7BDC9] bg-white p-6 text-center text-[14px] text-[#4A5263]">No papers yet. Start one above.</p>;
  return (
    <ul className="m-0 list-none divide-y divide-[#EEF0EC] rounded-[8px] border border-[#DADDE3] bg-white p-0">
      {papers.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Link href={`/folio/${p.id}`} className="min-w-0 flex-1 font-serif text-[17px] no-underline">{p.title}</Link>
          <span className="text-[12.5px] text-[#4A5263]">{p.role === "owner" ? "Yours" : `Shared · ${p.role}`}</span>
          <span className="text-[12.5px] text-[#4A5263]">Edited {fmt(p.updatedAt)}</span>
          <Link href={`/folio/${p.id}`} className="inline-flex h-8 items-center rounded-[4px] border border-[#B7BDC9] px-3 text-[13px] text-[#121826] no-underline">Open</Link>
        </li>
      ))}
    </ul>
  );
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-6 px-5 py-8">
      <header>
        <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">Folio · early access</p>
        <h1 className="m-0 mt-1 font-serif text-[34px] font-normal leading-[1.1]">Write your paper</h1>
        <p className="m-0 mt-1 text-[14px] text-[#4A5263]">LaTeX with a live PDF, co-authors editing at the same time, and every change saved.</p>
      </header>
      <form action={createFolioPaper} className="rounded-[8px] border border-[#DADDE3] bg-white p-4">
        <input type="hidden" name="lang" value={lang} />
        <h2 className="m-0 text-[16px] font-semibold">Start a paper</h2>
        <label className="mt-3 block text-[13px]">Title
          <input name="title" placeholder="Untitled paper" maxLength={300} className="mt-1 h-9 w-full rounded-[4px] border border-[#B7BDC9] px-2 text-[14px]" />
        </label>
        <fieldset className="mt-3 grid gap-2 border-0 p-0 sm:grid-cols-3">
          <legend className="mb-1 text-[13px]">Starting point</legend>
          {TEMPLATES.map((t, i) => (
            <label key={t.key} className="flex cursor-pointer gap-2 rounded-[6px] border border-[#DADDE3] p-3 has-[:checked]:border-[#0E1B3D] has-[:checked]:bg-[#F4F7FE]">
              <input type="radio" name="template" value={t.key} defaultChecked={i === 0} className="mt-1" />
              <span><strong className="block text-[14px]">{t.name}</strong><span className="text-[12.5px] text-[#4A5263]">{t.description}</span></span>
            </label>
          ))}
        </fieldset>
        <button type="submit" className="mt-4 h-10 rounded-[4px] border-0 bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white">Create and open</button>
      </form>
      <section className="flex flex-col gap-2">
        <h2 className="m-0 text-[16px] font-semibold">Your papers</h2>
        <Suspense fallback={<p className="m-0 text-[13px] text-[#4A5263]">Loading…</p>}>
          <Papers />
        </Suspense>
      </section>
    </main>
  );
}
