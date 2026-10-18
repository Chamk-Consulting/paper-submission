import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireEvent, groupStatus, lastChange } from "@/lib/manage/data";
import { ManagePage, SetupLayout } from "@/components/manage/chrome";
import { BasicsForm } from "@/components/manage/basics-form";
import { Reveal } from "@/components/motion/reveal";
import { ManageSkeleton } from "@/components/skeletons";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Basics & branding") };
}

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const v = ctx.venue;
  const s = (k: string) => ((v[k] as string | null) ?? "");
  return (
    <ManagePage ctx={ctx} active="setup" crumb={<>{t("Setup")} · {ctx.label}</>} title={t("Basics & branding")} sub={t("What visitors see on the public venue page.")}>
      <SetupLayout ctx={ctx} current="basics">
        <BasicsForm
          v={{ slug: v.slug, name: v.name, short_name: s("short_name"), tagline: s("tagline"), website: s("website"), accent: s("accent") || "navy",
               public_text: s("public_text"), venue_address: s("venue_address"), hotels: s("hotels"), contact_email: s("contact_email") }}
          status={groupStatus(ctx, ["basics"])} last={lastChange(ctx, ["basics"])} canEdit={ctx.isChair} />
      </SetupLayout>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<ManageSkeleton />}><Inner {...props} /></Reveal>;
}
