import { createAdminClient } from "@/lib/supabase/admin";
import { absUrl, emailConfigured, renderTemplate, sendMany, type Mail } from "@/lib/email/send";
import { paperNo } from "@/lib/manage/ops2-time";

/*
 * EM41 scheduled sends. Vercel Cron calls this every few minutes with "Authorization: Bearer <CRON_SECRET>".
 * It claims due campaigns (status scheduled → sending, so overlapping runs never double-send), renders each
 * recipient's copy, sends the email (skipped while RESEND_API_KEY is unset), delivers the Plenary inbox copy (I2),
 * then records counts and an audit entry (J4). Unsubscribed people are always left out (I4).
 * Needs SUPABASE_SECRET_KEY (server only); without it the run is skipped and logged.
 */

export const maxDuration = 60;

type Campaign = { id: string; venue_id: string; subject: string; body: string; recipients: number };
type Recipient = { person_id: string; email: string | null; given_name: string | null; display_name: string | null; submission_id: string | null; paper_number: number | null; paper_title: string | null; missing: string | null };

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

async function pool<T>(items: T[], n: number, fn: (x: T) => PromiseLike<unknown>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) { console.warn("[cron/campaigns] CRON_SECRET is not set — skipped"); return json({ skipped: "CRON_SECRET missing" }, 503); }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  if (!process.env.SUPABASE_SECRET_KEY) { console.warn("[cron/campaigns] SUPABASE_SECRET_KEY is not set — skipped"); return json({ skipped: "SUPABASE_SECRET_KEY missing" }); }

  const db = createAdminClient();
  const { data: claimed, error } = await db.rpc("cron_claim_campaigns", { p_limit: 5 });
  if (error) { console.error("[cron/campaigns] claim failed", error.message); return json({ error: "claim failed" }, 500); }
  const results: { id: string; status: string; recipients: number; delivered: number; bounced: number }[] = [];

  for (const c of (claimed ?? []) as Campaign[]) {
    try {
      const [{ data: venue }, { data: fin }, { data: recs, error: recErr }] = await Promise.all([
        db.from("venues").select("name, short_name, contact_email, timezone").eq("id", c.venue_id).single(),
        db.from("venue_dates").select("starts_at").eq("venue_id", c.venue_id).eq("key", "finals").maybeSingle(),
        db.rpc("cron_campaign_recipients", { p_campaign: c.id }),
      ]);
      if (recErr || !venue) throw new Error(recErr?.message ?? "venue not found");
      const tz = (venue.timezone as string) || "UTC";
      const deadline = fin?.starts_at ? new Date(fin.starts_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz }) : "";
      const label = (venue.short_name as string) || (venue.name as string);
      const rendered = ((recs ?? []) as Recipient[]).map((r) => {
        const first = r.given_name || r.display_name?.split(" ")[0] || "";
        const vars = {
          "author.first": first, "person.first": first, "paper.id": r.paper_number ? paperNo(r.paper_number) : "", "paper.title": r.paper_title ?? "",
          "missing.items": r.missing ?? "", deadline, "venue.short": label, "venue.name": venue.name as string,
          link: absUrl(r.submission_id ? `/submissions/${r.submission_id}` : "/workspace"),
        };
        const subj = renderTemplate(c.subject, vars), body = renderTemplate(c.body, vars);
        return { r, subj, body, missing: [...subj.missing, ...body.missing] };
      });
      // I5: never send a message with an empty placeholder — the whole campaign stops and the chair is told why.
      const broken = rendered.filter((x) => x.missing.length);
      if (broken.length) {
        const keys = [...new Set(broken.flatMap((x) => x.missing))].map((k) => `[${k}]`).join(", ");
        await db.rpc("cron_finish_campaign", { p_campaign: c.id, p_recipients: rendered.length, p_delivered: 0, p_bounced: 0, p_error: `Not sent: ${broken.length} recipient(s) have no value for ${keys} (I5).` });
        results.push({ id: c.id, status: "failed", recipients: rendered.length, delivered: 0, bounced: 0 });
        continue;
      }
      const mails: Mail[] = rendered.filter((x) => x.r.email).map((x) => ({ to: x.r.email!, subject: x.subj.text, text: x.body.text, replyTo: (venue.contact_email as string) ?? undefined }));
      const res = await sendMany(mails, 6);
      await pool(rendered, 6, (x) => db.rpc("cron_campaign_inbox", { p_campaign: c.id, p_person: x.r.person_id, p_subject: x.subj.text, p_body: x.body.text, p_submission: x.r.submission_id }));
      await db.rpc("cron_finish_campaign", { p_campaign: c.id, p_recipients: rendered.length, p_delivered: res.sent, p_bounced: res.failed, p_error: null });
      results.push({ id: c.id, status: "sent", recipients: rendered.length, delivered: res.sent, bounced: res.failed });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send failed";
      console.error("[cron/campaigns] campaign failed", c.id, msg);
      await db.rpc("cron_finish_campaign", { p_campaign: c.id, p_recipients: null, p_delivered: 0, p_bounced: 0, p_error: msg.slice(0, 400) });
      results.push({ id: c.id, status: "failed", recipients: 0, delivered: 0, bounced: 0 });
    }
  }
  return json({ ran: results.length, email: emailConfigured() ? "on" : "off (inbox only)", results });
}
