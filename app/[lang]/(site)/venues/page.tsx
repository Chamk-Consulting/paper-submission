import type { Metadata } from "next";
import { Directory } from "@/components/venues/directory";
import { getDirectory } from "@/lib/venues/data";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { DirectorySkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Event directory"),
    description: t("Find conferences, journals and awards with open calls for papers — deadlines in your time zone."),
  };
}

async function Inner() {
  const { venues, generatedAt, ready } = await getDirectory();
  return <Directory venues={venues} generatedAt={generatedAt} ready={ready} />;
}

/** Canvas PV01-Directory (+ PV01c calendar, PV01m map, PV01p past). */
export default function Page() {
  return (
    <Reveal fallback={<DirectorySkeleton />}>
      <Inner />
    </Reveal>
  );
}
