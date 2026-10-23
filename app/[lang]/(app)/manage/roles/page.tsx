import type { Metadata } from "next";
import Link from "@/components/site/link";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { ROLE_LABEL } from "@/lib/manage/data";
import { WorkspaceShell } from "@/components/workspace/shell";
import { ui } from "@/components/manage/ui";
import { ConflictsCard, type ConflictRow } from "@/components/manage/setup2/roles";
import { Reveal } from "@/components/motion/reveal";
import { RolesSkeleton } from "@/components/skeletons/setup2";

const nowMs = () => Date.now();

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("My roles & conflicts") };
}

type Ev = { venue_id: string; slug: string; name: string; short_name: string | null; status: string; roles: string[]; starts_on: string | null };
type Paper = { submission_id: string; submissions: { id: string; number: number | null; venue_id: string; created_at: string } | null };
type CoAuthor = { submission_id: string; person_id: string; persons: { display_name: string | null } | null };
type Declared = { id: string; institution: string | null; reason: string; until_year: number | null; persons: { display_name: string | null } | null };

const ORGANIZER = ["owner", "chair", "program_chair", "deputy_chair", "ceb_chair", "publication_chair", "registration_chair", "staff", "associate_editor"];
const DESC: Record<string, string> = {
  owner: "Created the event. Grants roles, sees everything except their own papers' reviews.",
  chair: "Runs the event day to day.", program_chair: "Assigns papers, makes decisions.", deputy_chair: "Handles papers the chairs can't.",
  ceb_chair: "Oversees the editorial board.", associate_editor: "Handles assigned papers and recommends decisions.",
  publication_chair: "Final files and proceedings.", registration_chair: "Registrations and fees.", staff: "Check-in only — no reviews or scores.",
  reviewer: "Reviews the papers you accepted.", author: "Your own papers.", session_chair: "Chairs sessions in the program.",
};

function roleHref(slug: string, role: string, paperId?: string) {
  if (role === "associate_editor") return `/manage/${slug}/papers`;
  if (role === "reviewer") return "/workspace/reviews";
  if (role === "author") return paperId ? `/submissions/${paperId}` : "/workspace/submissions";
  if (role === "session_chair") return "/workspace/talks";
  return `/manage/${slug}`;
}

async function Inner() {
  const ws = await getWorkspaceCtx();
  if (!ws) redirect(`/sign-in?next=${encodeURIComponent("/manage/roles")}`);
  const t = await getT();
  const supabase = await createClient();
  const pid = ws.me.person?.id;
  const [{ data: evs }, { data: mine }, { data: declared }] = await Promise.all([
    supabase.rpc("my_events"),
    pid ? supabase.from("submission_authors").select("submission_id, submissions(id, number, venue_id, created_at)").eq("person_id", pid) : Promise.resolve({ data: [] }),
    pid ? supabase.from("declared_conflicts").select("id, institution, reason, until_year, persons:other_person(display_name)").eq("person_id", pid).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const events = (evs ?? []) as Ev[];
  const papers = ((mine ?? []) as unknown as Paper[]).filter((p) => p.submissions);
  const byVenue = new Map<string, Paper["submissions"][]>();
  for (const p of papers) byVenue.set(p.submissions!.venue_id, [...(byVenue.get(p.submissions!.venue_id) ?? []), p.submissions]);

  // co-authors of my papers within the co-authorship window = automatic conflicts (B6)
  const years = 3; // default co-authorship window; each event applies its own window when assigning
  const since = nowMs() - years * 365 * 864e5;
  const recent = papers.filter((p) => Date.parse(p.submissions!.created_at) >= since).map((p) => p.submission_id);
  const { data: co } = recent.length
    ? await supabase.from("submission_authors").select("submission_id, person_id, persons(display_name)").in("submission_id", recent).neq("person_id", pid ?? "")
    : { data: [] };
  const auto = new Map<string, ConflictRow>();
  for (const c of (co ?? []) as unknown as CoAuthor[]) {
    if (auto.has(c.person_id)) continue;
    const num = papers.find((p) => p.submission_id === c.submission_id)?.submissions?.number;
    auto.set(c.person_id, { id: null, who: c.persons?.display_name || t("Co-author"), source: "auto", reason: num ? t("Co-author on #{n}", { n: num }) : t("Co-author"), until: null });
  }
  const conflicts: ConflictRow[] = [
    ...auto.values(),
    ...((declared ?? []) as unknown as Declared[]).map((d) => ({ id: d.id, who: d.persons?.display_name || d.institution || t("A Plenary member"), source: "declared" as const, reason: d.reason, until: d.until_year })),
  ];

  const firewalled = events.filter((e) => e.roles.some((r) => ORGANIZER.includes(r)) && (byVenue.get(e.venue_id)?.length ?? 0) > 0);
  return (
    <WorkspaceShell ctx={ws} active="m:roles">
      <div className="max-w-[1180px]">
        <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Account")}</p>
        <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("My roles & conflicts")}</h1>
        <p className="mt-1.5 text-[#4A5263]">{t("One account, several roles. Plenary keeps them apart so nobody judges their own work.")}</p>

        <div className="mt-[22px] flex flex-col items-start gap-6 xl:flex-row">
          <div className="flex w-full min-w-0 flex-auto flex-col gap-5">
            <section className={ui.card}>
              <h2 className={ui.h2}>{t("My roles")}</h2>
              {events.length ? (
                <ul className="m-0 mt-3 flex list-none flex-col p-0">
                  {events.flatMap((e) => {
                    const fw = firewalled.includes(e);
                    const roles = [...e.roles, ...((byVenue.get(e.venue_id)?.length ?? 0) > 0 && !e.roles.includes("author") ? ["author"] : [])];
                    return roles.map((r) => {
                      const firstPaper = byVenue.get(e.venue_id)?.[0]?.id;
                      const blocked = fw && r !== "author" && r !== "staff";
                      return (
                        <li key={`${e.venue_id}-${r}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0EC] py-3 last:border-0">
                          <Link href={roleHref(e.slug, r, firstPaper)} className="min-w-0 no-underline">
                            <span className="block font-semibold text-[#0E1B3D]">{e.short_name ?? e.name} · {t(ROLE_LABEL[r] ?? r)}</span>
                            <span className="text-[13px] text-[#4A5263]">{t(DESC[r] ?? "")}</span>
                          </Link>
                          <span className={ui.tag} style={blocked ? { background: "#FBEFDD", color: "#7A4508" } : { background: "#E1F3EA", color: "#14603F" }}>
                            {blocked ? t("Firewalled") : t("Active")}
                          </span>
                        </li>
                      );
                    });
                  })}
                </ul>
              ) : <p className={`${ui.hint} mt-3`}>{t("You don't have a role at any event yet.")}</p>}
            </section>

            {firewalled.map((e) => {
              const nums = (byVenue.get(e.venue_id) ?? []).map((s) => (s?.number ? `#${s.number}` : t("your draft"))).join(", ");
              return (
                <section key={e.venue_id} className={ui.card} style={{ borderColor: "#F2A93B" }}>
                  <p className={ui.kicker}>{t("Firewall · {venue}", { venue: e.short_name ?? e.name })}</p>
                  <p className="mt-2">{t("You organize {venue} and you're an author of {papers}. While you act as an organizer, these are hidden from you (B1):", { venue: e.short_name ?? e.name, papers: nums })}</p>
                  <ul className="m-0 mt-2 grid list-disc gap-1 pl-5 text-[14px] text-[#4A5263] sm:grid-cols-2">
                    {["Who reviews your papers", "Scores and recommendations", "Reviewer discussion", "AE recommendation", "Your papers in the decision table", "Your papers in per-topic statistics"].map((x) => <li key={x}>{t(x)}</li>)}
                  </ul>
                  <p className={`${ui.hint} mt-3`}>{t("A deputy chair handles your papers (B2).")}</p>
                </section>
              );
            })}

            <ConflictsCard rows={conflicts} />
          </div>
          <aside aria-label={t("Rules on this page")} className={`${ui.card} w-full xl:w-[280px] xl:flex-none`}>
            <p className={ui.kicker}>{t("Rules on this page")}</p>
            <dl className="m-0 mt-3 flex flex-col gap-2.5">
              {([["B1", "Organizers never see reviews of their own papers."], ["B2", "A deputy chair handles chairs' papers."], ["B6", "Co-authors and colleagues are detected automatically."], ["B7", "Declared conflicts stay private."], ["B9", "Roles are separate even in one account."]] as const).map(([c, x]) => (
                <div key={c} className="flex gap-2.5 text-[13px]"><dt className="w-7 flex-none font-mono font-semibold text-[#2F5FD0]">{c}</dt><dd className="m-0 text-[#4A5263]">{t(x)}</dd></div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default function Page() {
  return <Reveal fallback={<RolesSkeleton />}><Inner /></Reveal>;
}
