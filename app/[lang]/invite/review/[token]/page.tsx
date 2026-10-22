import Link from "@/components/site/link";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/venues/public-header";
import { Reveal } from "@/components/motion/reveal";
import { InviteTokenSkeleton } from "@/components/skeletons/review";
import { InvitationForm } from "@/components/review/invitation-form";
import { InvitationPaper } from "@/components/review/invitation-paper";
import { Banner, box, kick } from "@/components/review/parts";
import { getInvitationByToken } from "@/lib/review/data";
import { countdown, fmtDayYear, paperNo } from "@/lib/review/shared";
import { getUser } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { nowMs } from "@/lib/review/format";
import { ui } from "@/components/manage/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Review invitation"), robots: { index: false, follow: false } };
}

async function Inner({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [inv, user, t] = await Promise.all([getInvitationByToken(token), getUser(), getT()]);
  const now = nowMs();

  if (!inv) {
    return (
      <Frame signedIn={!!user}>
        <h1 className="m-0 font-serif text-[34px] font-normal">{t("This link isn't valid")}</h1>
        <p className="mt-2 max-w-[620px] text-[#4A5263]">{t("The invitation may have been withdrawn, or the link was copied incompletely. Open the newest email from the editor, or sign in to see your invitations.")}</p>
        <Link href="/reviews" className={ui.ghost}>{t("Sign in")}</Link>
      </Frame>
    );
  }

  const ae = inv.inviter ?? t("The editor");
  const venue = inv.venue_short ?? inv.venue_name;
  const due = fmtDayYear(inv.due_at, t.intl);
  const left = countdown(inv.reply_by, now);
  const otherEmail = user && inv.invited_email && user.email && inv.invited_email.toLowerCase() !== user.email.toLowerCase() && !inv.is_mine;

  return (
    <Frame signedIn={!!user}>
      <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Review invitation · reply by {d}", { d: fmtDayYear(inv.reply_by, t.intl) })}</p>
      <h1 className="mb-0 mt-1.5 font-serif text-[34px] font-normal leading-[1.15] sm:text-[40px]">{t("Would you review a paper for {venue}?", { venue })}</h1>
      <p className="mb-0 mt-1.5 text-[#4A5263]">{t("{ae} invited you as a reviewer.", { ae })}</p>

      <div className="mt-6 flex flex-col items-start gap-6 lg:flex-row">
        <div className="flex w-full min-w-0 flex-auto flex-col gap-4">
          {otherEmail ? <Banner tone="info">{t("This invitation was sent to {email}. You can still answer it here.", { email: inv.invited_email! })}</Banner> : null}
          <InvitationPaper inv={inv} t={t} intl={t.intl} now={now} long />
          <section className="rounded-[8px] border border-[#DADDE3] bg-white p-[22px]">
            {inv.status === "invited" ? (
              <InvitationForm mode="token" id={inv.assignment_id} token={token} no={paperNo(inv.paper_number)} due={due} ae={ae} email={inv.invited_email} />
            ) : inv.status === "accepted" || inv.status === "submitted" ? (
              <div>
                <Banner tone="ok">{t("You already accepted this invitation. The review is due {d}.", { d: due })}</Banner>
                <Link href={`/reviews/${inv.assignment_id}`} className={`${ui.primary} mt-4`}>{t("Sign in to open the review")}</Link>
              </div>
            ) : inv.status === "declined" ? (
              <Banner tone="info">{t("You declined this invitation. {ae} has been told. Thank you for answering.", { ae })}</Banner>
            ) : (
              <Banner tone="warn">{t("This invitation has closed. The editor needed a reply by {d} and has invited someone else. Thank you for your time.", { d: fmtDayYear(inv.reply_by, t.intl) })}</Banner>
            )}
          </section>
        </div>
        <aside className="flex w-full flex-col gap-3.5 lg:w-[300px] lg:flex-none">
          <section className={box}>
            <p className={kick}>{t("Reply by")}</p>
            <div className="mt-1 font-serif text-[28px] leading-none">{left ?? t("Closed")}</div>
            <p className="mb-0 mt-1 text-[13px] text-[#4A5263]">{fmtDayYear(inv.reply_by, t.intl)}</p>
          </section>
          <section className={box}>
            <p className={kick}>{t("What reviewing involves")}</p>
            <ul className="mb-0 mt-2 flex list-disc flex-col gap-1 pl-5 text-[14px] text-[#4A5263]">
              <li>{t("Read the paper (authors hidden).")}</li>
              <li>{t("Score it on a few criteria, 1–5.")}</li>
              <li>{t("Write at least 100 words for the authors.")}</li>
              <li>{t("Submit by {d}. You can ask for more time.", { d: due })}</li>
            </ul>
          </section>
          <section className={box}>
            <p className={kick}>{t("Is this link safe?")}</p>
            <p className="mb-0 mt-1.5 text-[14px] text-[#4A5263]">{t("This page never asks for your password. The link works once per person and expires when the editor closes the invitation.")}</p>
          </section>
        </aside>
      </div>
      {/* TODO(comms): per-venue unsubscribe for review invitations. */}
      <p className="mt-8 text-[13px]"><span aria-disabled title={t("Coming soon")} className="text-[#9AA3B5]">{t("Stop review invitations from this venue")}</span></p>
    </Frame>
  );
}

function Frame({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <PublicHeader signedIn={signedIn} active="" />
      <main className="mx-auto w-full max-w-[1080px] px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}

/** Canvas RV02e-EmailInvite — answers an emailed review invitation without signing in. */
export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Reveal fallback={<InviteTokenSkeleton />}>
      <Inner params={params} />
    </Reveal>
  );
}
