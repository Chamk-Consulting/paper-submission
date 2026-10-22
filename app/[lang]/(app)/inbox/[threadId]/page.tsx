import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InboxPage } from "@/components/account/inbox-page";
import { InboxSkeleton } from "@/components/skeletons/site2";
import { Reveal } from "@/components/motion/reveal";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Inbox") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Inner({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  if (!UUID.test(threadId)) redirect("/inbox");
  return <InboxPage threadId={threadId} />;
}

/** Canvas IN01-Inbox with a thread open. */
export default function Page({ params }: { params: Promise<{ threadId: string }> }) {
  return (
    <Reveal fallback={<InboxSkeleton />}>
      <Inner params={params} />
    </Reveal>
  );
}
