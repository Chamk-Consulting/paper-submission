import { Suspense } from "react";
import { connection } from "next/server";
import { VenueView } from "@/components/venues/venue-page";
import { PREVIEW_EVENT, PREVIEW_MINE } from "@/lib/dev/preview-data";

async function Inner({ searchParams }: { searchParams: Promise<{ who?: string; mode?: string }> }) {
  await connection();
  const { who, mode } = await searchParams;
  const mine = who === "new" ? {} : PREVIEW_MINE;
  return <VenueView data={PREVIEW_EVENT} pub={null} myEvents={mine} mode={mode === "public" ? "public" : "workspace"} />;
}

export default function Page(props: { searchParams: Promise<{ who?: string; mode?: string }> }) {
  return (
    <>
      <span data-bleed hidden />
      <Suspense fallback={null}><Inner {...props} /></Suspense>
    </>
  );
}
