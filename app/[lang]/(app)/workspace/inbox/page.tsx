import type { Metadata } from "next";
import { InboxPage } from "@/components/account/inbox-page";
import { InboxSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Inbox") };
}

/** Canvas IN01-Inbox. */
export default function Page() {
  return (
    <Reveal fallback={<InboxSkeleton />}>
      <InboxPage threadId={null} />
    </Reveal>
  );
}
