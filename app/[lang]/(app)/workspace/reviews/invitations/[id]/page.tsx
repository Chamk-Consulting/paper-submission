import Link from "@/components/site/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { ReviewSkeleton } from "@/components/skeletons/review";
import { InvitationForm } from "@/components/review/invitation-form";
import { InvitationPaper } from "@/components/review/invitation-paper";
import { Banner, Cols, Crumbs, Head, NotYours, box, kick } from "@/components/review/parts";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getInvitation, getOverview } from "@/lib/review/data";
import { fmtDayYear, paperNo } from "@/lib/review/shared";
import { getT } from "@/lib/i18n/server";
import { nowMs } from "@/lib/review/format";
import { ui } from "@/components/manage/ui";
import { MessageEditorBox } from "@/components/reviewpolish/forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Review invitation") };
}

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect(`/sign-in?next=/workspace/reviews/invitations/${id}`);
  const t = await getT();
  const [inv, overview] = await Promise.all([/^[0-9a-f-]{36}$/i.test(id) ? getInvitation(id) : null, getOverview()]);
  if (!inv) return <WorkspaceShell ctx={ctx} active="reviews"><NotYours t={t} /></WorkspaceShell>;
  const now = nowMs();
  const ae = inv.inviter ?? t("The editor");
  const no = paperNo(inv.paper_number);
  const due = fmtDayYear(inv.due_at, t.intl);

  return (
    <WorkspaceShell ctx={ctx} active="reviews">
      <Crumbs items={[[t("Reviews"), "/workspace/reviews"], [t("Invitation"), null]]} />
      <Head title={t("Review invitation")} sub={t("From {ae}, associate editor · {venue}", { ae, venue: inv.venue_name })} />
      <Cols
        main={
          <>
            <InvitationPaper inv={inv} t={t} intl={t.intl} now={now} />
            <section className="rounded-[8px] border border-[#DADDE3] bg-white p-[22px]">
              {inv.status === "invited" ? (
                <InvitationForm mode="signed" id={inv.assignment_id} no={no} due={due} ae={ae} />
              ) : inv.status === "accepted" || inv.status === "submitted" ? (
                <div>
                  <Banner tone="ok">{t("You accepted this invitation. The review is due {d}.", { d: due })}</Banner>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <Link href={`/workspace/reviews/${inv.assignment_id}`} className={ui.primary}>{t("Open review form")}</Link>
                    <Link href={`/workspace/reviews/${inv.assignment_id}/paper`} className={ui.ghost}>{t("Read the paper")}</Link>
                  </div>
                </div>
              ) : inv.status === "declined" ? (
                <Banner tone="info">{t("Declined. {ae} has been told, with your suggestion.", { ae })}</Banner>
              ) : inv.status === "expired" || inv.status === "closed" ? (
                <Banner tone="warn">{t("This invitation has closed. The editor needed a reply by {d} and has invited someone else. Thank you for your time.", { d: fmtDayYear(inv.reply_by, t.intl) })}</Banner>
              ) : (
                <Banner tone="info">{t("This review is no longer assigned to you.")}</Banner>
              )}
            </section>
          </>
        }
        aside={
          <>
            <section className={box}>
              <p className={kick}>{t("Your load")}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div><div className="font-serif text-[28px] leading-none">{overview.due}</div><div className="text-[12px] text-[#4A5263]">{t("in progress")}</div></div>
                <div><div className="font-serif text-[28px] leading-none">{overview.invited}</div><div className="text-[12px] text-[#4A5263]">{t("invitations")}</div></div>
              </div>
            </section>
            <section className={box}>
              <p className={kick}>{t("Why you?")}</p>
              <p className="mb-0 mt-1.5 text-[14px] text-[#4A5263]">{t("Editors invite reviewers whose topics and recent papers match the paper's keywords. Saying no is fine — a quick answer helps the authors most.")}</p>
            </section>
            <section className={box}>
              <p className={kick}>{t("Questions?")}</p>
              {["invited", "accepted", "submitted"].includes(inv.status) ? <MessageEditorBox assignmentId={inv.assignment_id} editor={inv.inviter ?? null} />
                : <p className="mb-0 mt-1.5 text-[14px] text-[#4A5263]">{t("Write to the venue from its page.")}</p>}
            </section>
          </>
        }
      />
    </WorkspaceShell>
  );
}

/** Canvas RV02-Invitation. */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Reveal fallback={<ReviewSkeleton variant="form" />}>
      <Inner params={params} />
    </Reveal>
  );
}
