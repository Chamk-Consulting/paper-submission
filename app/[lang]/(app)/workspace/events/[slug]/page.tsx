import type { Metadata } from "next";
import { VenuePage } from "@/components/venues/venue-page";
import { generateMetadata as publicMetadata } from "@/app/[lang]/(site)/venues/[slug]/page";
import { Reveal } from "@/components/motion/reveal";
import { VenueSkeleton } from "@/components/skeletons";

type Params = { slug: string };

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  return publicMetadata(props);
}

async function Inner({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return <VenuePage slug={slug} mode="workspace" />;
}

/** An event inside the workspace: same content as the public page, with your participation and your next step. */
export default function Page({ params }: { params: Promise<Params> }) {
  return (
    <>
      <span data-bleed hidden />
      <Reveal fallback={<VenueSkeleton />}><Inner params={params} /></Reveal>
    </>
  );
}
