import Link from "@/components/site/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getMyPapers, getWorkspaceCtx } from "@/lib/workspace/data";
import { getVenue } from "@/lib/venues/data";
import { fmtRange } from "@/lib/venues/time";
import { requestNow, getAnnouncements, getFollow, getMyChairedSessions, getMyReviews, getVenueContacts } from "@/lib/site/data";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { WorkspaceBodySkeleton, VenueMeSkeleton } from "@/components/skeletons/site1";
import { AnnouncementToggle, NextDeadline, VenueMeTabs, type DeadlineRow, type WorkRow } from "@/components/site/venue-me";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await getT();
  const { slug } = await params;
  const v = await getVenue(slug);
  return { title: v ? `${v.venue.acr} · ${t("Your venue")}` : t("Your venue"), robots: { index: false } };
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", chair: "General chair", program_chair: "Program chair", deputy_chair: "Deputy chair", ceb_chair: "Editorial board chair",
  publication_chair: "Publication chair", registration_chair: "Registration chair", session_chair: "Session chair", associate_editor: "Associate editor",
  reviewer: "Reviewer", staff: "Staff", author: "Author",
};
const WHO: Record<string, [string, string[]]> = {
  submission: ["Authors", ["author"]], proposal: ["Authors", ["author"]], final: ["Authors of accepted papers", ["author"]], registration: ["Presenting authors", ["author"]],
  rebuttal: ["Authors", ["author"]], review: ["Reviewers", ["reviewer", "associate_editor"]], notification: ["Everyone", []], conference: ["Everyone", []], internal: ["Committee", ["chair", "program_chair", "associate_editor", "owner"]],
};

async function Inner({ params }: Params) {
  const { slug } = await params;
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect(`/sign-in?next=/venues/${slug}/me`);
  const t = await getT();
  const v = await getVenue(slug);
  if (!v) notFound();
  const venue = v.venue;
  const pid = ctx.me.person?.id;
  const [{ papers }, reviews, sessions, news, contacts, follow] = await Promise.all([
    getMyPapers(pid), getMyReviews(), getMyChairedSessions(), getAnnouncements(venue.id), getVenueContacts(venue.id),
    pid ? getFollow(venue.id, pid) : Promise.resolve({ following: false, email: false }),
  ]);
  const now = await requestNow();
  const mine = papers.filter((p) => p.venue.id === venue.id);
  const myReviews = reviews.filter((r) => r.venue_slug === slug && ["invited", "accepted", "submitted"].includes(r.status));
  const mySessions = sessions.filter((s) => s.venue_slug === slug);
  const roles = new Set(ctx.venues.find((x) => x.id === venue.id)?.roles ?? []);
  if (mine.length) roles.add("author");
  if (myReviews.length) roles.add("reviewer");
  if (mySessions.length) roles.add("session_chair");

  const work: WorkRow[] = [
    ...mine.map((p): WorkRow => ({ id: p.id, role: "AUTHOR", title: p.title || t("Untitled draft"), detail: [p.number ? `#${p.number}` : "", p.detail].filter(Boolean).join(" · "), at: null, href: p.href })),
    ...myReviews.map((r): WorkRow => ({ id: r.assignment_id, role: "REVIEWER", title: r.title, detail: r.status === "invited" ? "Invitation — reply needed" : r.status === "submitted" ? "Review submitted" : "Review in progress", at: r.status === "invited" ? r.reply_by : r.status === "accepted" ? r.due_at : null, href: r.status === "accepted" ? `/workspace/reviews/${r.assignment_id}` : "/workspace/reviews" })),
    ...mySessions.map((s): WorkRow => ({ id: s.session_id, role: "CHAIR", title: s.title, detail: [s.code, s.room].filter(Boolean).join(" · ") || "Session", at: s.starts_at, href: `/workspace/talks/${s.session_id}` })),
  ];
  const deadlines: DeadlineRow[] = venue.dates.filter((d) => Date.parse(d.startsAt) > now).map((d) => {
    const [who, need] = WHO[d.kind] ?? ["Everyone", []];
    return { id: d.id, label: d.label, who, at: d.startsAt, mine: !need.length || need.some((r) => roles.has(r)) };
  });
  const relevant = deadlines.filter((d) => d.mine);
  const next = relevant.find((d) => d.who !== "Everyone") ?? relevant[0] ?? null;
  const facts = [
    v.doubleBlind ? t("Double-blind") : venue.reviewMode,
    venue.indexedIn.length ? t("Indexed in {list}", { list: venue.indexedIn.join(", ") }) : null,
    venue.pageLimit ? t("Page limit {n}", { n: venue.pageLimit }) : null,
    venue.acceptanceRate ? t("{n}% accepted last year", { n: Math.round(venue.acceptanceRate <= 1 ? venue.acceptanceRate * 100 : venue.acceptanceRate) }) : null,
    venue.format ? t(venue.format === "in_person" ? "In person" : venue.format === "hybrid" ? "Hybrid" : "Online") : null,
  ].filter((x): x is string => !!x);
  const roleNames = [...roles].map((r) => t(ROLE_LABEL[r] ?? r));

  return (
    <WorkspaceShell ctx={ctx} active="venues">
      <p className="m-0 font-mono text-[12px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Your venue")}</p>
      <h1 className="mt-1.5 font-serif text-[34px] font-normal leading-[1.1] tracking-[-0.01em] sm:text-[40px]">{venue.name}</h1>
      <p className="mt-1.5 text-[#4A5263]">
        {[venue.startsOn ? fmtRange(venue.startsOn, venue.endsOn, t.intl, t) : null, venue.location ?? venue.city].filter(Boolean).join(" · ")}
        {roleNames.length ? <> · {t("your roles:")} {roleNames.map((r, i) => <span key={r}>{i ? ", " : ""}<strong className="text-[#121826]">{r}</strong></span>)}</> : <> · {t("you have no role here yet")}</>}
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link href={`/venues/${slug}`} className="inline-flex h-10 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-medium text-[#121826] no-underline hover:bg-[#F7F8F6]">{t("Public venue page")}</Link>
        {venue.dates.some((d) => d.kind === "submission" && Date.parse(d.startsAt) > now) || venue.kind === "journal"
          ? <Link href={`/submit/${slug}`} className="inline-flex h-10 items-center rounded-[4px] bg-[#F2A93B] px-3.5 text-[14px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{t("Submit to this venue")}</Link> : null}
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <VenueMeTabs venueId={venue.id} now={now} work={work} deadlines={deadlines}
          news={news.map((n) => ({ id: n.id, title: n.title, body: n.body, by: n.author_role, at: n.published_at }))}
          contacts={contacts.map((c) => ({ personId: c.person_id, name: c.display_name, role: ROLE_LABEL[c.role] ?? c.role }))} />
        <aside className="flex flex-col gap-4">
          {next ? <NextDeadline label={next.label} at={next.at} now={now} /> : null}
          <section className="rounded-[8px] border border-[#DADDE3] bg-white p-5">
            <h2 className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("Venue facts")}</h2>
            {facts.length ? <div className="mt-2.5 flex flex-wrap gap-1.5">{facts.map((f) => <span key={f} className="rounded-full border border-[#DADDE3] bg-[#F7F8F6] px-2.5 py-1 text-[13px]">{f}</span>)}</div>
              : <p className="mb-0 mt-2 text-[14px] text-[#4A5263]">{t("Details will appear when the organizers publish them.")}</p>}
          </section>
          <AnnouncementToggle venueId={venue.id} initial={follow.following ? follow.email : false} />
        </aside>
      </div>
    </WorkspaceShell>
  );
}

/** VN01 — My venue page (signed in). */
export default function Page(props: Params) {
  return (
    <Reveal fallback={<WorkspaceBodySkeleton active="venues"><VenueMeSkeleton /></WorkspaceBodySkeleton>}>
      <Inner {...props} />
    </Reveal>
  );
}
