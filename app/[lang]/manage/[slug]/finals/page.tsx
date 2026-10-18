import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getLocale, getT } from "@/lib/i18n/server";
import { INTL } from "@/lib/i18n/config";
import { requireEvent } from "@/lib/manage/data";
import { createClient } from "@/lib/supabase/server";
import { ManagePage, ui } from "@/components/manage/chrome";
import { FinalsBoard, type FinalRow } from "@/components/manage/ops2/finals-board";
import { Reveal } from "@/components/motion/reveal";
import { FinalsSkeleton } from "@/components/skeletons/ops2";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Final versions") };
}

/** Deadline state, computed at request time. */
function deadlineState(at: Date | null) {
  const now = Date.now();
  return { past: !!at && at.getTime() < now, days: at ? Math.max(0, Math.ceil((at.getTime() - now) / 864e5)) : null };
}

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  await connection();
  const [t, locale, supabase] = [await getT(), await getLocale(), await createClient()];
  const [{ data: rows }, { data: due }] = await Promise.all([
    supabase.rpc("finals_overview", { p_venue: ctx.venue.id }),
    supabase.from("venue_dates").select("starts_at").eq("venue_id", ctx.venue.id).eq("key", "finals").maybeSingle(),
  ]);
  const at = due?.starts_at ? new Date(due.starts_at as string) : null;
  const dl = deadlineState(at);
  return (
    <ManagePage ctx={ctx} active="finals" title={t("Final versions")} sub={t("Accepted papers: final PDF, copyright, registration and title lock.")}
      actions={<Link href={`/manage/${slug}/registrations`} className={ui.ghost}>{t("Registrations")}</Link>}>
      <FinalsBoard slug={slug} rows={(rows ?? []) as FinalRow[]}
        deadline={at ? at.toLocaleDateString(INTL[locale], { day: "numeric", month: "short", timeZone: ctx.venue.timezone }) : null}
        pastDeadline={dl.past} daysLeft={dl.days} />
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FinalsSkeleton />}><Inner {...props} /></Reveal>;
}
