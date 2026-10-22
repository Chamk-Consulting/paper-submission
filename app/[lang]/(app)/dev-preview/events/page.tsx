import { Suspense } from "react";
import { connection } from "next/server";
import { Directory } from "@/components/venues/directory";
import { PREVIEW_MINE, PREVIEW_VENUES } from "@/lib/dev/preview-data";

async function Inner() {
  await connection();
  return <Directory venues={PREVIEW_VENUES} generatedAt={new Date().toISOString()} ready mine={PREVIEW_MINE} />;
}

export default function Page() {
  return (
    <>
      <span data-bleed hidden />
      <Suspense fallback={null}><Inner /></Suspense>
    </>
  );
}
