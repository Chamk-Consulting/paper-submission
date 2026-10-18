import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SystemPage } from "@/components/site/system";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("No access"), robots: { index: false } };
}

/** ER01 "no access": the person's role doesn't allow this page (e.g. a chair opening reviews of their own paper — rule B1). */
export default async function NoAccess() {
  const t = await getT();
  return (
    <SystemPage icon="🔒" tone="bad" code={t("NO ACCESS · RULE B1")} title={t("You can’t open this page")}
      body={t("Your role doesn’t include this page. If you are an author of the paper, its reviews and decision are handled by the deputy chair — as an author you can still follow its status.")}
      primary={{ href: "/workspace/submissions", label: t("Open as author") }} secondary={{ href: "/manage/roles", label: t("Why am I blocked?") }}
      note={t("This attempt was recorded in the audit log.")} />
  );
}
