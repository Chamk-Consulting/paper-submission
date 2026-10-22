import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { EventsHead } from "@/components/workspace/events-head";
import { FollowingList } from "@/components/workspace/events-lists";
import { byNext, getEventRows } from "@/lib/workspace/events-pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Following") };
}

async function Inner() {
  const { rows, generatedAt, signedIn } = await getEventRows();
  if (!signedIn) redirect("/sign-in?next=/workspace/events/following");
  const now = Date.parse(generatedAt);
  const list = rows.filter((r) => r.following && !r.past).sort(byNext(now));
  return (
    <div className="max-w-[900px]">
      <EventsHead title="Following" line="Events you watch. Their next deadline is counted down here, so a call for papers never slips past you." />
      <FollowingList rows={list} generatedAt={generatedAt} />
    </div>
  );
}

/** Events › Following. */
export default function Page() {
  return <Reveal fallback={null}><Inner /></Reveal>;
}
