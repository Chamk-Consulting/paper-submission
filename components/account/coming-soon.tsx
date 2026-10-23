import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import Link from "@/components/site/link";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame } from "@/components/account/settings-frame";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getT } from "@/lib/i18n/server";
import { SETTINGS_SOON, type SoonKey } from "@/lib/site/coming-soon";

/* Shown instead of a settings page that is switched off for now (see lib/site/coming-soon.ts). */

const WHAT: Record<SoonKey, string[]> = {
  security: ["Change your email and password", "Passkeys and two-step sign-in", "Devices signed in to your account"],
  privacy: ["Who can see your profile", "Your consents", "Download or delete your data"],
  notifications: ["Choose which emails you get", "Daily or weekly digests", "Quiet hours"],
  calendar: ["Your deadlines, reviews and talks in one live feed", "Google, Outlook and Apple Calendar"],
  preferences: ["Language and time zone", "Date and time format", "Appearance"],
  reviews: ["Answer review invitations", "Write and submit your reviews", "See past reviews and certificates"],
  talks: ["Your talks and the sessions you chair", "Run a session: timing, attendance and presenter messages"],
  agenda: ["Your talks, sessions and deadlines in one calendar", "Month, day and list views, with clashes highlighted"],
  inbox: ["Messages from chairs and organizers", "Replies about your papers and reviews"],
  myevents: ["Every event you take part in: as author, reviewer, chair or attendee", "Next deadline and what to do at each event"],
  pastevents: ["Events that have ended, by year", "Certificates, final papers and receipts in one place"],
};
/** Page head for the My work pages (the settings pages use SettingsFrame). */
const HEAD: Partial<Record<SoonKey, [string, string, string]>> = {
  reviews: ["My work", "To review", "Review invitations and the reviews you write."],
  talks: ["My work", "Talks & sessions", "The talks you give and the sessions you chair."],
  agenda: ["My work", "Agenda", "Your timetable across events."],
  inbox: ["Inbox", "Inbox", "Messages from chairs, organizers and co-authors."],
  myevents: ["Events", "My events", "Events where you have a paper, a review, a role or a registration."],
  pastevents: ["Events", "Past events", "Events that have ended, with your certificates, final papers and receipts."],
};

async function SoonInner({ active, next }: { active: SoonKey; next: string }) {
  const [ctx, t] = await Promise.all([getWorkspaceCtx(), getT()]);
  if (!ctx) redirect(`/sign-in?next=${next}`);
  const panel = (
        <section className="rounded-[8px] border border-[#DADDE3] bg-white px-6 py-8 sm:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6EDFC] px-2.5 py-1 text-[13px] font-semibold text-[#1F47A8]">
            <Clock size={14} strokeWidth={2} aria-hidden /> {t("Coming soon")}
          </span>
          <h2 className="mb-0 mt-4 text-[20px] font-semibold">{t("This page isn't available yet")}</h2>
          <p className="mb-0 mt-1.5 max-w-[60ch] text-[15px] text-[#4A5263]">{SETTINGS_SOON.has(active)
            ? t("We're finishing it. Until then your account keeps its current settings, and nothing here changes how you sign in or the emails you get.")
            : t("We're finishing it. Nothing is lost: what is sent to you is kept and will be here when this page opens. Links in emails still open the right page.")}</p>
          <p className="mb-0 mt-5 text-[13px] font-semibold text-[#4A5263]">{t("What you'll be able to do here")}</p>
          <ul className="m-0 mt-2 list-disc ps-5 text-[15px] text-[#121826]">
            {WHAT[active].map((w) => <li key={w} className="py-0.5">{t(w)}</li>)}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/workspace/account/profile" className="inline-flex h-10 items-center rounded-[4px] bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white no-underline">{t("Go to your profile")}</Link>
            <Link href="/workspace/support" className="inline-flex h-10 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[14px] font-semibold text-[#121826] no-underline">{t("Contact support")}</Link>
          </div>
        </section>
  );
  if (SETTINGS_SOON.has(active)) {
    return <WorkspaceShell ctx={ctx} active="m:settings"><SettingsFrame active={active as Parameters<typeof SettingsFrame>[0]["active"]}>{panel}</SettingsFrame></WorkspaceShell>;
  }
  const [group, title, subtitle] = HEAD[active] ?? ["", active, ""];
  return (
    <WorkspaceShell ctx={ctx} active={active}>
      <div className="w-full">
        {group !== title ? <p className="m-0 text-[13px] text-[#4A5263]">{t(group)}</p> : null}
        <h1 className="mb-0 mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t(title)}</h1>
        <p className="mb-6 mt-1.5 text-[#4A5263]">{t(subtitle)}</p>
        {panel}
      </div>
    </WorkspaceShell>
  );
}

export function ComingSoonPage({ active, next }: { active: SoonKey; next: string }) {
  return <SoonInner active={active} next={next} />;
}
