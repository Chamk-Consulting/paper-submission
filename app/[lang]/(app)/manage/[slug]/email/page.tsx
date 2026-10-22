import type { Metadata } from "next";
import Link from "@/components/site/link";
import { getLocale, getT } from "@/lib/i18n/server";
import { INTL } from "@/lib/i18n/config";
import { requireEvent } from "@/lib/manage/data";
import { createClient } from "@/lib/supabase/server";
import { ManagePage, ui } from "@/components/manage/chrome";
import { EmailComposer } from "@/components/manage/ops2/email-composer";
import { Reveal } from "@/components/motion/reveal";
import { EmailSkeleton } from "@/components/skeletons/ops2";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Email centre") };
}

const AUDIENCE_LABEL: Record<string, string> = { authors: "Authors", reviewers: "Reviewers", aes: "Associate editors", session_chairs: "Session chairs", committee: "Committee", acc: "accepted", inc: "final incomplete", late: "review overdue", unsub: "minus unsubscribed" };
const RULES: [string, string][] = [
  ["I1", "Pick people by role and status; nobody is typed in by hand."],
  ["I2", "Every email also lands in the person’s Plenary inbox."],
  ["I3", "A test to yourself is required; over 500 recipients needs a second confirmation."],
  ["I4", "Optional messages skip people who unsubscribed."],
  ["I5", "If a placeholder has no value for someone, nothing is sent."],
];

type Camp = { id: string; subject: string; roles: string[]; conditions: string[]; status: string; recipients: number; delivered: number; bounced: number; sent_at: string | null; scheduled_at: string | null; created_at: string; send_error: string | null };

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug, "chair");
  const [t, locale, supabase] = [await getT(), await getLocale(), await createClient()];
  const [{ data: camps }, { data: aud }] = await Promise.all([
    supabase.from("email_campaigns").select("id, subject, roles, conditions, status, recipients, delivered, bounced, sent_at, scheduled_at, created_at, send_error").eq("venue_id", ctx.venue.id).neq("status", "draft").order("created_at", { ascending: false }).limit(50),
    supabase.rpc("campaign_audience", { p_venue: ctx.venue.id, p_roles: ["authors"], p_conditions: ["acc", "inc", "unsub"] }),
  ]);
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(INTL[locale], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: ctx.venue.timezone }) : "—");
  return (
    <ManagePage ctx={ctx} active="email" title={t("Email centre")} sub={t("Send one message to the right people — filtered by role and status.")}>
      <div className="flex flex-col gap-6">
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
          <EmailComposer slug={slug} initialCount={(aud ?? []).length} />
          <aside className={`${ui.card} flex flex-col gap-3`}>
            <h2 className={ui.h2}>{t("Rules")}</h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
              {RULES.map(([k, v]) => <li key={k}><span className="font-mono text-[11px] text-[#4A5263]">{k}</span> {t(v)}</li>)}
            </ul>
            <p className={`${ui.hint} m-0 border-t border-[#EEF0EC] pt-3`}>{t("Automatic emails (decisions, reminders, invitations) are sent by Plenary itself — edit their templates in")} <Link href={`/manage/${slug}/setup/emails`}>{t("Setup → Emails")}</Link>.</p>
          </aside>
        </div>
        <section>
          <h2 className={`${ui.h2} mb-3`}>{t("Sent and scheduled")}</h2>
          <div className="overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
            <table className={ui.table}>
              <thead><tr><th className={ui.th}>{t("Message")}</th><th className={ui.th}>{t("Audience")}</th><th className={ui.th}>{t("Sent")}</th><th className={ui.th}>{t("Delivered")}</th><th className={ui.th}>{t("Bounced")}</th><th className={ui.th}>{t("When")}</th></tr></thead>
              <tbody>
                {((camps ?? []) as Camp[]).length === 0 ? <tr><td colSpan={6} className={`${ui.td} text-center text-[#4A5263]`}>{t("Nothing sent yet.")}</td></tr> : ((camps ?? []) as Camp[]).map((c) => (
                  <tr key={c.id}>
                    <td className={ui.td}>{c.subject}{c.status === "scheduled" ? <span className={`${ui.tag} ml-2 bg-[#FFF6E6] text-[#7A4508]`}>{t("SCHEDULED")}</span> : null}{c.status === "sending" ? <span className={`${ui.tag} ml-2 bg-[#E6EDFC] text-[#1F47A8]`}>{t("SENDING")}</span> : null}{c.status === "failed" ? <><span className={`${ui.tag} ml-2 bg-[#FDECEA] text-[#B3261E]`}>{t("NOT SENT")}</span>{c.send_error ? <span className="mt-0.5 block text-[12px] text-[#B3261E]">{t(c.send_error)}</span> : null}</> : null}</td>
                    <td className={`${ui.td} text-[13px]`}>{[...c.roles, ...c.conditions].map((x) => t(AUDIENCE_LABEL[x] ?? x)).join(" · ")}</td>
                    <td className={`${ui.td} font-mono text-[13px]`}>{c.recipients}</td>
                    <td className={`${ui.td} font-mono text-[13px]`}>{c.status === "sent" ? c.delivered : "—"}</td>
                    <td className={`${ui.td} font-mono text-[13px]`}>{c.status === "sent" ? c.bounced : "—"}</td>
                    <td className={`${ui.td} text-[13px]`}>{fmt(c.status === "scheduled" || c.status === "sending" ? c.scheduled_at : c.sent_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<EmailSkeleton />}><Inner {...props} /></Reveal>;
}
