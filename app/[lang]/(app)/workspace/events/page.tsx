import type { Metadata } from "next";
import { Directory } from "@/components/venues/directory";
import { getDirectory } from "@/lib/venues/data";
import { getMyEvents } from "@/lib/workspace/events";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { DirectorySkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Find events") };
}

async function Inner() {
  const [{ venues, generatedAt, ready }, mine] = await Promise.all([getDirectory(), getMyEvents()]);
  return <Directory venues={venues} generatedAt={generatedAt} ready={ready} mine={mine} />;
}

/** Find events: the venue directory in its workspace form — your roles and papers on each card, My events and Following. */
export default function Page() {
  return (
    <>
      <span data-bleed hidden />
      <Reveal fallback={<DirectorySkeleton />}>
        <Inner />
      </Reveal>
    </>
  );
}
