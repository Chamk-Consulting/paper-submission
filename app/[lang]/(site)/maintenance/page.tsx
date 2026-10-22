import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createPublicClient } from "@/lib/supabase/public";
import { requestNow } from "@/lib/site/data";
import { SystemCard, SystemFrame } from "@/components/site/system";
import { MaintenanceTimes } from "@/components/site/maintenance-times";
import { Reveal } from "@/components/motion/reveal";
import { SystemCardSkeleton } from "@/components/skeletons/site1";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("System status"), robots: { index: false } };
}

type Win = { starts_at: string; ends_at: string; message: string | null; shift_minutes: number };

async function Inner() {
  const t = await getT();
  const now = await requestNow();
  const supabase = createPublicClient();
  const { data } = await supabase.from("maintenance_windows").select("starts_at, ends_at, message, shift_minutes")
    .gte("ends_at", new Date(now).toISOString()).order("starts_at").limit(1);
  const w = (data as Win[] | null)?.[0];
  if (!w) {
    return (
      <SystemCard icon="✓" tone="info" code={t("ALL SYSTEMS NORMAL")} title={t("No maintenance planned")}
        body={t("Submissions, reviews and email are working. If something isn’t, tell us.")}
        primary={{ href: "/workspace", label: t("My workspace") }} secondary={{ href: "/contact", label: t("Contact support") }} />
    );
  }
  const hours = w.shift_minutes % 60 === 0 ? t(w.shift_minutes === 60 ? "1 hour" : "{n} hours", { n: w.shift_minutes / 60 }) : t("{n} minutes", { n: w.shift_minutes });
  return (
    <SystemCard icon="🛠" tone="info" code={t("PLANNED MAINTENANCE")} title={t("Plenary is being updated")}
      body={<>
        <MaintenanceTimes start={w.starts_at} end={w.ends_at} />{" "}
        {w.message ? `${w.message} ` : ""}{t("Deadlines that fall in this window have been moved by {n} automatically.", { n: hours })}
      </>}
      primary={{ href: "/help", label: t("Help") }} secondary={{ href: "/contact", label: t("Contact support") }} />
  );
}

/** ER01 "maint" / system status: reads the next maintenance window. */
export default function Maintenance() {
  return (
    <SystemFrame>
      <Reveal fallback={<SystemCardSkeleton />}><Inner /></Reveal>
    </SystemFrame>
  );
}
