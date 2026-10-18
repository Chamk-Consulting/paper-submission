import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { requireEvent } from "@/lib/manage/data";
import { ManagePage } from "@/components/manage/chrome";
import { GoLiveForm, type Check } from "@/components/manage/setup1/go-live-form";
import { Rules } from "@/components/manage/setup1/bits";
import { Reveal } from "@/components/motion/reveal";
import { Setup1Skeleton } from "@/components/skeletons/setup1";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Go-live review") };
}

/* go_live_checks keys → label + the setup page that fixes them. */
const CHECKS: Record<string, [string, string]> = {
  basics: ["Basics", "basics"], dates: ["Dates in order", "dates"], submission_types: ["Submission types", "submissions"],
  review: ["Review form", "review"], deputy: ["Deputy chair named (B2)", "committee"], committee: ["Committee", "committee"],
  emails: ["Email placeholders (I5)", "basics"], sections: ["Required sections ready (D1)", ""],
};

/** EM13 — go-live review. */
async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug, "chair");
  const t = await getT();
  const supabase = await createClient();
  const [{ data: rows }, { data: people }, { data: open }] = await Promise.all([
    supabase.rpc("go_live_checks", { p_venue: ctx.venue.id }),
    supabase.rpc("venue_people", { p_venue: ctx.venue.id }),
    supabase.from("venue_dates").select("starts_at").eq("venue_id", ctx.venue.id).eq("key", "submissions_open").maybeSingle(),
  ]);
  const checks: Check[] = ((rows ?? []) as { key: string; ok: boolean; note: string | null }[]).map((c) => {
    const [label, path] = CHECKS[c.key] ?? [c.key, ""];
    return { key: c.key, ok: c.ok, note: c.note ?? "", label, fix: `/manage/${slug}/setup${path ? `/${path}` : ""}` };
  });
  const committee = ((people ?? []) as { roles: string[] }[]).filter((p) => p.roles.some((r) => r !== "author")).length;
  const canOpen = ctx.roles.includes("owner") || ctx.roles.includes("program_chair");
  const aoe = (iso: string) => `${new Date(iso).toLocaleString(t.intl, { timeZone: "Etc/GMT+12", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} AoE`;
  const openedAt = (ctx.venue.opened_at as string | null) ?? null;
  const live = ctx.venue.status !== "draft";
  return (
    <ManagePage ctx={ctx} active="setup" crumb={<>{t("Setup")} · {ctx.label}</>} title={t("Go-live review")} sub={t("Check everything as an author would see it, then open submissions.")}>
      <div className="flex flex-col items-start gap-6 xl:flex-row">
        <div className="w-full min-w-0 flex-auto">
          <GoLiveForm slug={slug} checks={checks} committee={committee} canOpen={canOpen} live={live}
            liveSince={openedAt ? aoe(openedAt) : null} opensLabel={open?.starts_at ? aoe(open.starts_at as string) : null} myEmail={ctx.ws.me.email ?? null} />
        </div>
        <Rules rules={[["D1", "All required sections ready + this review passed."], ["B2", "A deputy chair must be named before opening."], ["I5", "No email template may have missing placeholders."], ["K3", "Some settings lock on opening."]]} />
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<Setup1Skeleton />}><Inner {...props} /></Reveal>;
}
