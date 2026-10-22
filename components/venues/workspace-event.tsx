import { BadgeCheck, CalendarClock, CalendarPlus, CalendarRange, Gauge, Ticket, UserRound } from "lucide-react";
import Link from "@/components/site/link";
import { getT } from "@/lib/i18n/server";
import { CountdownCard, FollowButton } from "@/components/venues/venue-live";
import { VenueCoverImage } from "@/components/venues/cover";
import { FIELD_COLOR } from "@/lib/venues/types";
import { fmtRange } from "@/lib/venues/time";
import type { DirectoryVenue } from "@/lib/venues/types";
import { STAGE_LABEL, STAGE_TONE, primaryAction, roleChips, type MyEvent } from "@/lib/workspace/event-action";

/* Workspace parts of the event page: the compact header and the "Your participation" panel (see venue-page.tsx). */

const ORGANIZER = /^(owner|chair|program_chair|deputy_chair|ceb_chair|publication_chair|registration_chair|staff)$/;
const btn = "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[4px] px-3.5 text-[14px] font-semibold no-underline";
const ghost = `${btn} border border-[#B7BDC9] bg-white text-[#121826] hover:bg-[#F7F8F6]`;

export async function WorkspaceEventHeader({ v, tags, where, tagline, mine, open, generatedAt, nav }: {
  v: DirectoryVenue; tags: string[]; where: string; tagline: string | null; mine?: MyEvent; open: boolean; generatedAt: string; nav: [string, string][];
}) {
  const t = await getT();
  const [fbg, fink] = v.field ? FIELD_COLOR[v.field] : ["#E6EDFC", "#1F47A8"];
  const act = primaryAction(v.slug, mine, open);
  const organizer = mine?.roles.some((r) => ORGANIZER.test(r));
  return (
    <section className="border-b border-[#DADDE3] bg-white">
      <div className="mx-auto max-w-[1280px] px-5 pt-6 sm:px-8">
        <nav aria-label={t("Breadcrumb")} className="text-[13px] text-[#4A5263]">
          <Link href="/workspace/events" className="text-[#121826] underline">{t("Find events")}</Link> / {v.acr}
        </nav>
        <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-5">
            <div className="relative hidden aspect-video w-[184px] flex-none overflow-hidden rounded-[8px] bg-[#EEF0EC] md:block">
              <VenueCoverImage cover={v.cover} field={v.field} alt={t("Cover image of {venue}", { venue: v.acr })} priority />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, i) => <span key={tag} className="rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em]" style={i === 0 && v.field ? { background: fbg, color: fink } : { background: "#EEF0EC", color: "#4A5263" }}>{tag}</span>)}
              </div>
              <h1 className="mt-2 font-serif text-[32px] font-normal leading-[1.05] tracking-[-0.01em] sm:text-[40px]">{v.acr}</h1>
              <p className="m-0 mt-1 text-[17px] text-[#121826]">{v.name}</p>
              {tagline ? <p className="m-0 mt-0.5 text-[15px] italic text-[#4A5263]">{tagline}</p> : null}
              <p className="m-0 mt-1 text-[14px] text-[#4A5263]">{[fmtRange(v.startsOn, v.endsOn, t.intl, t, v.kind === "journal"), where, v.society ? t("Sponsored by {society}", { society: v.society }) : null].filter(Boolean).join(" · ")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={act.href} className={`${btn} ${act.label === "View event" ? "bg-[#0E1B3D] text-white" : "bg-[#F2A93B] text-[#0E1B3D] hover:bg-[#E89B26]"}`}>{t(act.label)}</Link>
                {act.label === "Continue draft" && open ? <Link href={`/submit/${v.slug}`} className={ghost}>{t("New paper")}</Link> : null}
                <FollowButton venueId={v.id} slug={v.slug} compact />
                {organizer ? <Link href={`/manage/${v.slug}`} className={ghost}><Gauge size={15} aria-hidden />{t("Event dashboard")}</Link> : null}
                <a href={`/venues/${v.slug}/calendar.ics`} className={ghost}><CalendarPlus size={15} aria-hidden />{t("Add deadlines to calendar")}</a>
              </div>
            </div>
          </div>
          <div className="flex-none xl:w-[380px]"><CountdownCard dates={v.dates} generatedAt={generatedAt} /></div>
        </div>
      </div>
      <nav aria-label={t("On this page")} className="sticky top-[60px] z-10 mt-6 border-t border-[#DADDE3] bg-white">
        <div className="mx-auto flex max-w-[1280px] gap-6 overflow-x-auto px-5 text-[14px] sm:px-8">
          {nav.map(([id, label]) => <a key={id} href={`#${id}`} className="flex-none py-3 text-[#4A5263] no-underline hover:text-[#121826]">{t(label)}</a>)}
        </div>
      </nav>
    </section>
  );
}

/** Your roles and papers at this event, and the pages that are yours there. */
export async function YourParticipation({ slug, acr, mine, open, programHref }: { slug: string; acr: string; mine?: MyEvent; open: boolean; programHref: string }) {
  const t = await getT();
  const roles = mine ? roleChips(mine.roles) : [];
  const papers = mine?.papers ?? [];
  const member = !!mine?.roles.length;
  const links: [string, string, typeof UserRound][] = [
    ...(member ? ([[`/venues/${slug}/me`, "My page", UserRound]] as [string, string, typeof UserRound][]) : []),
    [programHref, "Program", CalendarRange],
    [`${programHref}/my-schedule`, "My schedule", CalendarClock],
    [`/venues/${slug}/register`, "Register to attend", Ticket],
    [`/venues/${slug}/badge`, "Badge", BadgeCheck],
  ];
  return (
    <section aria-labelledby="yp-h" className="rounded-[8px] border border-[#DADDE3] bg-white p-[18px] shadow-[0_1px_0_rgba(18,24,38,.04)]">
      <h2 id="yp-h" className="m-0 text-[17px] font-semibold">{t("Your participation")}</h2>
      {roles.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {roles.map((r) => <span key={r} className="rounded-full bg-[#0E1B3D] px-2.5 py-0.5 text-[12px] font-semibold text-white">{t(r)}</span>)}
        </div>
      ) : null}
      {papers.length ? (
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {papers.map((p) => (
            <li key={p.id}>
              <Link href={p.href} className="block rounded-[6px] border border-[#EEF0EC] px-3 py-2 text-[#121826] no-underline hover:border-[#B7BDC9] hover:bg-[#FBFCFF]">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-[#4A5263]">{p.number ? `#${p.number}` : ""}</span>
                  <span className="rounded-full px-2 py-px text-[11px] font-semibold" style={{ background: STAGE_TONE[p.stage][0], color: STAGE_TONE[p.stage][1] }}>{t(STAGE_LABEL[p.stage])}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[14px] font-medium leading-[1.35]">{p.title || t("Untitled paper")}</span>
                {p.detail ? <span className="block text-[12px] text-[#4A5263]">{t(p.detail)}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-0 mt-2.5 text-[14px] text-[#4A5263]">
          {open ? t("You have no paper at {acr} yet.", { acr }) : t("You have no paper at {acr}.", { acr })}{" "}
          {open ? <Link href={`/submit/${slug}`} className="font-semibold text-[#2F5FD0]">{t("Submit a paper")}</Link> : null}
        </p>
      )}
      <ul className="m-0 mt-3.5 flex list-none flex-col border-t border-[#EEF0EC] p-0 pt-2">
        {links.map(([href, label, Icon]) => (
          <li key={href}>
            <Link href={href} className="flex h-9 items-center gap-2.5 rounded-[6px] px-2 text-[14px] text-[#121826] no-underline hover:bg-[#F5F6F3]">
              <Icon size={15} strokeWidth={1.75} aria-hidden className="text-[#4A5263]" />{t(label)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
