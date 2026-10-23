import Link from "@/components/site/link";
import { getMe } from "@/lib/auth/me";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { PapersList } from "@/components/workspace/papers-list";
import { getMyPapers, getWorkspaceCtx } from "@/lib/workspace/data";
import { getEventRows } from "@/lib/workspace/events-pages";
import { nextDateOf } from "@/lib/workspace/my-work";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { WorkspaceSkeleton } from "@/components/skeletons";
import { getMyInbox, getMyReviews } from "@/lib/site/data";
import { getFollowedDeadlines } from "@/lib/reviewpolish/data";
import { LocalWhen } from "@/components/reviewpolish/local-when";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("My submissions") };
}

const card = "rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5";
const kicker = "m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]";

type Search = { q?: string; status?: string; event?: string; sort?: string; co?: string };

async function Inner({ searchParams }: { searchParams: Promise<Search> }) {
  const pid = getMe().then((m) => m?.person?.id);
  const [ctx, { ready, papers }, sp, reviews, follows, inbox, ev] = await Promise.all([
    getWorkspaceCtx(), pid.then(getMyPapers), searchParams, getMyReviews(), pid.then(getFollowedDeadlines), getMyInbox(3), getEventRows(),
  ]);
  const nowMs = Date.parse(ev.generatedAt);
  const next = Object.fromEntries(ev.rows.map((r) => [r.v.id, nextDateOf(r, nowMs)]));
  if (!ctx) redirect("/sign-in?next=/workspace/submissions");
  const due = reviews.filter((r) => r.status === "accepted" || r.status === "invited").length;
  const t = await getT();

  return (
    <WorkspaceShell ctx={ctx} active="submissions">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Author")}</p>
          <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("My submissions")}</h1>
          <p className="mt-1.5 text-[#4A5263]">{t("Every paper you are an author on, grouped by venue. One venue can hold several of your papers, each at its own stage.")}</p>
        </div>
        <Link href="/workspace/events?intent=submit" className="inline-flex h-[42px] items-center rounded-[4px] bg-[#F2A93B] px-[18px] text-[15px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{t("+ New submission")}</Link>
      </div>

      {!ready ? (
        <p role="status" className="mt-5 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-2.5 text-[14px] text-[#3B2A07]">
          {t("Papers will show here once the submissions database update is installed.")}
        </p>
      ) : null}

      <div className="mt-[22px] flex flex-col items-start gap-6 xl:flex-row">
        <div className="w-full min-w-0 flex-auto">
          <PapersList papers={papers} next={next} init={sp} />
        </div>

        <aside className="flex w-full flex-col gap-3.5 xl:w-[300px] xl:flex-none">
          <section className={card}>
            <p className={kicker}>{t("At a glance")}</p>
            <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
              <div><div className="font-serif text-[28px] leading-none">{papers.length}</div><div className="text-[12px] text-[#4A5263]">{t("papers")}</div></div>
              <Link href="/workspace/reviews" className="text-[#121826] no-underline"><div className={`font-serif text-[28px] leading-none ${due ? "text-[#A8600F]" : ""}`}>{due}</div><div className="text-[12px] text-[#4A5263]">{t("reviews due")}</div></Link>
              <div><div className="font-serif text-[28px] leading-none">{ctx.aeRoles}</div><div className="text-[12px] text-[#4A5263]">{t("AE role")}</div></div>
            </div>
          </section>
          <section className={card}>
            <div className="flex items-baseline justify-between"><p className={kicker}>{t("Following · next deadlines")}</p><Link href="/venues?view=calendar" className="text-[12px] text-[#2F5FD0]">{t("Calendar")}</Link></div>
            {follows.length ? (
              <ul className="m-0 mt-2 list-none p-0">
                {follows.map((f) => (
                  <li key={f.venueId} className="flex items-baseline justify-between gap-3 border-b border-[#EEF0EC] py-2 text-[14px] last:border-0">
                    <span className="min-w-0"><Link href={`/venues/${f.slug}`} className="font-semibold text-[#121826] no-underline">{f.short}</Link><span className="block truncate text-[12px] text-[#4A5263]">{f.label}</span></span>
                    <LocalWhen at={f.at} className="flex-none font-mono text-[12px] text-[#4A5263]" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-0 mt-2 text-[13px] text-[#4A5263]">{t("Follow a venue to see its deadlines here, in your time zone.")}</p>
            )}
          </section>
          <section className={card}>
            <div className="flex items-baseline justify-between"><p className={kicker}>{t("Inbox")}</p><Link href="/workspace/inbox" className="text-[12px] text-[#2F5FD0]">{t("Open inbox")}</Link></div>
            {inbox.length ? (
              <ul className="m-0 mt-2 list-none p-0">
                {inbox.map((m) => (
                  <li key={m.thread_id} className="border-b border-[#EEF0EC] py-2 last:border-0">
                    <Link href={`/workspace/inbox/${m.thread_id}`} className="block text-[14px] text-[#121826] no-underline">
                      <span className="flex items-center gap-1.5">{m.unread ? <span aria-label={t("unread")} className="size-2 flex-none rounded-full bg-[#2F5FD0]" /> : null}<span className={`truncate ${m.unread ? "font-semibold" : ""}`}>{m.subject}</span></span>
                      <span className="block truncate text-[12px] text-[#4A5263]">{[m.venue, m.last_from].filter(Boolean).join(" · ")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-0 mt-2 text-[13px] text-[#4A5263]">{t("No messages yet. Chairs and co-authors reach you here.")}</p>
            )}
          </section>
          <Link href="/workspace/settings/calendar" className="box-border inline-flex h-[42px] w-full items-center justify-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-medium text-[#121826] no-underline hover:bg-[#F7F8F6]">{t("Add deadlines to my calendar")}</Link>
        </aside>
      </div>
    </WorkspaceShell>
  );
}

/** Canvas WS02-Submissions. */
export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Reveal fallback={<WorkspaceSkeleton active="submissions" />}>
      <Inner searchParams={searchParams} />
    </Reveal>
  );
}
