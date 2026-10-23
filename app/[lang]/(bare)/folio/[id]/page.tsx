import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FolioEditor } from "@/components/folio/editor";
import { loadFolioPaper } from "@/lib/folio/data";

/* Folio editor (phase 1): LaTeX source, live PDF, co-editing. Members of the paper only (RLS). */

type P = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Folio", robots: { index: false } };

async function Inner({ params }: P) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await loadFolioPaper(id);
  if (!data) notFound();
  return <FolioEditor {...data} />;
}

export default function Page(props: P) {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-[#F5F6F3] text-[14px] text-[#4A5263]">Opening the paper…</div>}>
      <Inner {...props} />
    </Suspense>
  );
}
