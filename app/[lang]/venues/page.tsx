import type { Metadata } from "next";
import { Suspense } from "react";
import { Directory } from "@/components/venues/directory";
import { getDirectory } from "@/lib/venues/data";

export const metadata: Metadata = {
  title: "Venue directory",
  description: "Find conferences, journals and awards with open calls for papers — deadlines in your time zone.",
};

async function Inner() {
  const { venues, generatedAt, ready } = await getDirectory();
  return <Directory venues={venues} generatedAt={generatedAt} ready={ready} />;
}

/** Canvas PV01-Directory (+ PV01c calendar, PV01m map, PV01p past). */
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}>
      <Inner />
    </Suspense>
  );
}
