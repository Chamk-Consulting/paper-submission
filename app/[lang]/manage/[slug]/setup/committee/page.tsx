import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { requireEvent, groupStatus, lastChange } from "@/lib/manage/data";
import { ManagePage, SetupLayout } from "@/components/manage/chrome";
import { ui } from "@/components/manage/ui";
import { CommitteeList, InviteForm, PolicyForm, type CommitteeRow } from "@/components/manage/setup2/committee";
import { RulesCard } from "@/components/manage/setup2/rules";
import { Reveal } from "@/components/motion/reveal";
import { CommitteeSkeleton } from "@/components/skeletons/setup2";

const nowMs = () => Date.now();

type P = { params: Promise<{ slug: string }> };
const COMMITTEE_ROLES = ["owner", "chair", "program_chair", "deputy_chair", "ceb_chair", "associate_editor", "publication_chair", "registration_chair", "staff", "session_chair", "reviewer"];
const LEAD = ["owner", "chair", "program_chair"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Committee & conflicts") };
}

type Person = { person_id: string; display_name: string; institution: string | null; roles: string[]; papers: number };
type Invite = { id: string; email: string | null; role: string; status: string; created_at: string; expires_at: string; persons: { display_name: string | null } | null };

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const supabase = await createClient();
  const [{ data: people }, { data: invites }, { data: aes }] = await Promise.all([
    supabase.rpc("venue_people", { p_venue: ctx.venue.id }),
    supabase.from("invitations").select("id, email, role, status, created_at, expires_at, persons:person_id(display_name)")
      .eq("venue_id", ctx.venue.id).in("status", ["pending", "declined", "expired"]).order("created_at", { ascending: false }).limit(200),
    ctx.isChair ? supabase.rpc("venue_aes", { p_venue: ctx.venue.id }) : Promise.resolve({ data: [] }),
  ]);
  const aeLoad = new Map(((aes ?? []) as { person_id: string; load: number; cap: number | null }[]).map((a) => [a.person_id, `${a.load} / ${a.cap ?? "—"}`]));
  const me = ctx.ws.me.person?.id;
  const ppl = (people ?? []) as Person[];
  const members: CommitteeRow[] = ppl
    .filter((p) => (p.roles ?? []).some((r) => COMMITTEE_ROLES.includes(r)))
    .map((p) => ({
      kind: "member", personId: p.person_id, name: p.display_name || "—", institution: p.institution,
      roles: p.roles.filter((r) => r !== "author"), load: aeLoad.get(p.person_id) ?? null, papers: Number(p.papers ?? 0), you: p.person_id === me,
    }));
  const now = nowMs();
  const inv: CommitteeRow[] = ((invites ?? []) as unknown as Invite[]).map((i) => ({
    kind: "invite", id: i.id, name: i.persons?.display_name || i.email || "—", role: i.role,
    status: i.status === "pending" && Date.parse(i.expires_at) < now ? "expired" : i.status, at: i.created_at,
  }));
  const leadAuthors = ppl.filter((p) => (p.roles ?? []).some((r) => LEAD.includes(r)) && Number(p.papers ?? 0) > 0);
  const hasDeputy = ppl.some((p) => (p.roles ?? []).includes("deputy_chair"));
  const meAuthor = leadAuthors.some((p) => p.person_id === me);
  const canGrant = ctx.roles.some((r) => LEAD.includes(r));
  const s = (ctx.settings ?? {}) as Record<string, unknown>;
  return (
    <ManagePage ctx={ctx} active="setup" crumb={<>{t("Setup")} · {ctx.label}</>} title={t("Committee & conflicts")} sub={t("Who runs the event, and how conflicts are detected.")}>
      <SetupLayout ctx={ctx} current="committee">
        <div className="flex flex-col items-start gap-6 xl:flex-row">
          <div className="flex w-full min-w-0 flex-auto flex-col gap-5">
            {leadAuthors.length && !hasDeputy ? (
              <div role="alert" className={ui.warn}>
                <strong>{t("No deputy chair.")}</strong>{" "}
                {meAuthor
                  ? t("You have a paper at this event, so a deputy chair must be named before submissions open (B2).")
                  : t("A chair has a paper at this event, so a deputy chair must be named before submissions open (B2).")}
              </div>
            ) : null}
            <CommitteeList slug={slug} rows={[...members, ...inv]} canGrant={canGrant} />
            <InviteForm slug={slug} canGrant={canGrant} />
            <PolicyForm slug={slug} canEdit={ctx.isChair && !ctx.locked} status={groupStatus(ctx, ["committee", "conflicts"])} last={lastChange(ctx, ["committee", "conflicts"])}
              v={{ coauthor_years: Number(s.coauthor_years ?? 3), institution_years: Number(s.institution_years ?? 2), use_declared: s.use_declared !== false, override_second: s.override_second !== false }} />
          </div>
          <RulesCard rules={[
            ["A3", "Only owner/PC grant roles; starts on acceptance."], ["A5", "Staff never see reviews or scores."], ["A7", "Removing a role keeps their work."],
            ["B2", "Deputy chair required when a chair submits."], ["B4", "AE never handles a conflicted paper."],
            ["B5", "Overrides: reason + second approver + audit."], ["B6", "Conflict windows set here."],
          ]} />
        </div>
      </SetupLayout>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<CommitteeSkeleton />}><Inner {...props} /></Reveal>;
}
