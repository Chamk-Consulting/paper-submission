import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { requireEvent, groupStatus, lastChange } from "@/lib/manage/data";
import { ManagePage, SetupLayout } from "@/components/manage/chrome";
import { EmailsEditor, type Template } from "@/components/manage/setup2/emails";
import { RulesCard } from "@/components/manage/setup2/rules";
import { Reveal } from "@/components/motion/reveal";
import { SetupFormSkeleton } from "@/components/skeletons/setup2";

type P = { params: Promise<{ slug: string }> };
type Row = { venue_id: string | null; key: string; name: string; recipients: string; subject: string; body: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Emails") };
}

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("email_templates").select("venue_id, key, name, recipients, subject, body")
    .or(`venue_id.is.null,venue_id.eq.${ctx.venue.id}`).order("key");
  const rows = (data ?? []) as Row[];
  const defaults = rows.filter((r) => !r.venue_id);
  const own = new Map(rows.filter((r) => r.venue_id).map((r) => [r.key, r]));
  const templates: Template[] = defaults.map((d) => {
    const o = own.get(d.key);
    return { key: d.key, name: d.name, recipients: d.recipients, subject: o?.subject ?? d.subject, body: o?.body ?? d.body, overridden: !!o, defSubject: d.subject, defBody: d.body };
  });
  // venue-only templates (no default) stay editable too
  for (const o of own.values()) if (!defaults.some((d) => d.key === o.key))
    templates.push({ key: o.key, name: o.name, recipients: o.recipients, subject: o.subject, body: o.body, overridden: false, defSubject: o.subject, defBody: o.body });
  const short = ctx.venue.short_name ?? ctx.venue.name;
  const sample: Record<string, string> = {
    "paper.id": "#0987", "paper.title": "Robust control of soft actuators", "author.first": "Amina", "author.last": "Rahman",
    "reviewer.first": "Amina", deadline: "15 March", "venue.short": short, "venue.name": ctx.venue.name,
    ...(ctx.venue.contact_email ? { "venue.contact": ctx.venue.contact_email } : {}),
    link: "https://plenary.app/…", submitter: "Jonas Weber", inviter: ctx.ws.name, role: t("Associate editor"),
  };
  return (
    <ManagePage ctx={ctx} active="setup" crumb={<>{t("Setup")} · {ctx.label}</>} title={t("Emails")} sub={t("What Plenary sends on your behalf, and when.")}>
      <SetupLayout ctx={ctx} current="emails">
        <div className="flex flex-col items-start gap-6 xl:flex-row">
          <div className="w-full min-w-0 flex-auto">
            <EmailsEditor slug={slug} templates={templates} sample={sample} contactMissing={!ctx.venue.contact_email}
              sendAs={(ctx.settings?.send_as_event as boolean | undefined) ?? true} senderName={t("{venue} via Plenary", { venue: short })}
              canEdit={ctx.isChair && !ctx.locked} status={groupStatus(ctx, ["emails"])} last={lastChange(ctx, ["emails"])} />
          </div>
          <RulesCard rules={[
            ["I1", "Every email is also in the Plenary inbox."], ["I2", "Inbox copy can't be turned off."], ["I3", "Bulk emails are logged with their recipients."],
            ["I4", "Templates use placeholders, filled per person."], ["I5", "Missing placeholder values block sending."],
          ]} />
        </div>
      </SetupLayout>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<SetupFormSkeleton cards={3} />}><Inner {...props} /></Reveal>;
}
