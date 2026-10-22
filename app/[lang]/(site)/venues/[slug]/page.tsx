import type { Metadata } from "next";
import { getVenue } from "@/lib/venues/data";
import { VenuePage } from "@/components/venues/venue-page";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { VenueSkeleton } from "@/components/skeletons";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const [data, t] = await Promise.all([getVenue(slug), getT()]);
  if (!data) return { title: t("Venue not found") };
  return { title: data.venue.acr, description: t("{name} — call for papers, deadlines and how to submit.", { name: data.venue.name }) };
}

async function Venue({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return <VenuePage slug={slug} />;
}

/** Canvas PV02-Venue. */
export default function Page({ params }: { params: Promise<Params> }) {
  return (
    <Reveal fallback={<VenueSkeleton />}>
      <Venue params={params} />
    </Reveal>
  );
}
