import type { Metadata } from "next";
import { connection } from "next/server";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { AdminSkeleton } from "@/components/skeletons/admin";
import { ADMIN_TABS, findPeople, loadAudit, loadMaintenance, loadSignupFunnel, loadOverview, loadSupport, loadVenues, requireAdmin, type AdminTab } from "@/lib/admin/data";
import { emailConfigured } from "@/lib/email/send";
import { AdminShell, PeopleView, StatusView, SupportView, VenuesView } from "@/components/admin/views";
import { SignupFunnel } from "@/components/admin/signup-funnel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Platform admin"), robots: { index: false } };
}

type SP = { tab?: string; id?: string; q?: string };

async function Inner({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab: AdminTab = ADMIN_TABS.includes(sp.tab as AdminTab) ? (sp.tab as AdminTab) : "support";
  const me = await requireAdmin(`/admin${tab !== "support" ? `?tab=${tab}` : ""}`);
  await connection();
  const now = new Date().getTime();
  const [t, overview] = await Promise.all([getT(), loadOverview()]);
  const name = me.person?.display_name || me.email;
  let body;
  if (tab === "support") body = <SupportView t={t} items={await loadSupport()} selected={sp.id ?? null} now={now} />;
  else if (tab === "venues") body = <VenuesView t={t} venues={await loadVenues()} requireApproval={overview.require_venue_approval} />;
  else if (tab === "people") body = <PeopleView t={t} q={sp.q ?? ""} people={await findPeople(sp.q ?? "")} />;
  else {
    const [windows, audit, funnel] = await Promise.all([loadMaintenance(), loadAudit(20), loadSignupFunnel(30)]);
    body = <><StatusView t={t} windows={windows} audit={audit} emailOn={emailConfigured()} aiOn={!!process.env.ANTHROPIC_API_KEY} now={now} /><SignupFunnel t={t} rows={funnel} /></>;
  }
  return <AdminShell t={t} name={name} tab={tab} overview={overview}>{body}</AdminShell>;
}

/** AD01 — Platform admin: support inbox, venue approvals, find a person, system status. Plenary staff only. */
export default function Page(props: { searchParams: Promise<SP> }) {
  return <Reveal fallback={<AdminSkeleton />}><Inner {...props} /></Reveal>;
}
