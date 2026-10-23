import type { Metadata } from "next";
import { InboxPage } from "@/components/account/inbox-page";
import { InboxSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getT } from "@/lib/i18n/server";
import { isSoon } from "@/lib/site/coming-soon";
import { ComingSoonPage } from "@/components/account/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Inbox") };
}

/** Canvas IN01-Inbox. */
export default function Page() {
  // Switched off for now (lib/site/coming-soon.ts); the page below is kept as is.
  if (isSoon("inbox")) return <Reveal fallback={<InboxSkeleton />}><ComingSoonPage active="inbox" next="/workspace/inbox" /></Reveal>;
  return (
    <Reveal fallback={<InboxSkeleton />}>
      <InboxPage threadId={null} />
    </Reveal>
  );
}
