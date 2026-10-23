import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { isSoon } from "@/lib/site/coming-soon";
import { ComingSoonPage } from "@/components/account/coming-soon";
import { EventsHead } from "@/components/workspace/events-head";
import { PastList } from "@/components/workspace/events-lists";
import { getEventRows } from "@/lib/workspace/events-pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Past events") };
}

async function Inner() {
  const { rows, signedIn } = await getEventRows();
  if (!signedIn) redirect("/sign-in?next=/workspace/events/past");
  const list = rows.filter((r) => r.past).sort((a, b) => (b.v.endsOn ?? b.v.startsOn ?? "").localeCompare(a.v.endsOn ?? a.v.startsOn ?? ""));
  return (
    <div>
      <EventsHead title="Past events" line="Events that have ended — keep your certificates, final papers and receipts in one place." />
      <PastList rows={list} />
    </div>
  );
}

/** Events › Past events. */
export default function Page() {
  // Switched off for now (lib/site/coming-soon.ts); the page below is kept as is.
  if (isSoon("pastevents")) return <Reveal fallback={null}><ComingSoonPage active="pastevents" next="/workspace/events/past" /></Reveal>;
  return <Reveal fallback={null}><Inner /></Reveal>;
}
