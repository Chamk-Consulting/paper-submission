import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireEvent, groupStatus, lastChange } from "@/lib/manage/data";
import { ManagePage, SetupLayout } from "@/components/manage/chrome";
import { BasicsForm } from "@/components/manage/basics-form";
import { CoverForm } from "@/components/manage/cover-form";
import { createClient } from "@/lib/supabase/server";
import type { VenueCover } from "@/lib/venues/types";
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
  const { data: extra } = await (await createClient()).from("venues").select("details, field").eq("id", v.id as string).maybeSingle();
  const cover = ((extra?.details as { cover?: VenueCover } | null)?.cover) ?? null;
  return (
    <ManagePage ctx={ctx} active="setup" crumb={<>{t("Setup")} · {ctx.label}</>} title={t("Basics & branding")} sub={t("What visitors see on the public venue page.")}>
      <SetupLayout ctx={ctx} current="basics">
        <BasicsForm
          v={{ slug: v.slug, name: v.name, short_name: s("short_name"), tagline: s("tagline"), website: s("website"), accent: s("accent") || "navy",
               public_text: s("public_text"), venue_address: s("venue_address"), hotels: s("hotels"), contact_email: s("contact_email"),
               submit_url: ((extra?.details as { external_submit_url?: string } | null)?.external_submit_url) ?? "" }}
          status={groupStatus(ctx, ["basics"])} last={lastChange(ctx, ["basics"])} canEdit={ctx.isChair} />
        <CoverForm venueId={v.id as string} slug={v.slug as string} acr={(s("short_name") || (v.name as string))} field={(extra?.field as string | null) ?? null} initial={cover} canEdit={ctx.isChair} />
      </SetupLayout>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<ManageSkeleton />}><Inner {...props} /></Reveal>;
}
