import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { isSoon } from "@/lib/site/coming-soon";
import { ComingSoonPage } from "@/components/account/coming-soon";
import { EventsHead } from "@/components/workspace/events-head";
import { MyEventsList } from "@/components/workspace/events-lists";
import { byNext, getEventRows } from "@/lib/workspace/events-pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("My events") };
}

async function Inner() {
  const { rows, generatedAt, signedIn } = await getEventRows();
  if (!signedIn) redirect("/sign-in?next=/workspace/events/mine");
  const now = Date.parse(generatedAt);
  const list = rows.filter((r) => !r.past && (!!r.mine || !!r.reg)).sort(byNext(now));
  return (
    <div>
      <EventsHead title="My events" line="Events you take part in — as author, reviewer, chair, organiser or attendee — with what each one needs from you next." />
      <MyEventsList rows={list} generatedAt={generatedAt} />
    </div>
  );
}

/** Events › My events. */
export default function Page() {
  // Switched off for now (lib/site/coming-soon.ts); the page below is kept as is.
  if (isSoon("myevents")) return <Reveal fallback={null}><ComingSoonPage active="myevents" next="/workspace/events/mine" /></Reveal>;
  return <Reveal fallback={null}><Inner /></Reveal>;
}
