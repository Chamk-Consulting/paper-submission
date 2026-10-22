import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { HelpCenter } from "@/components/site/help-center";
import { HelpSkeleton } from "@/components/skeletons/site1";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Help & guides"), description: t("Answers for authors, reviewers, editors and organizers.") };
}

async function Inner({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <HelpCenter initialQuery={typeof q === "string" ? q.slice(0, 80) : ""} signedIn />;
}

/** Help & guides inside the workspace: the guides and search, no marketing banner; placeholder in the same frame. */
export default function Page(props: { searchParams: Promise<{ q?: string }> }) {
  return <Reveal fallback={<HelpSkeleton />}><Inner {...props} /></Reveal>;
}
