import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { site } from "@/lib/config/site";
import { getBrand } from "@/lib/config/brand";

/*
 * Daily sign-up housekeeping (plan C5 + E3), Vercel cron:
 *  - one reminder to accounts left unconfirmed for 1–3 days (a fresh code + link),
 *  - delete accounts never confirmed after 30 days (frees the address),
 *  - alert when confirmation emails fail or codes fail far more than usual.
 * Needs CRON_SECRET and SUPABASE_SECRET_KEY (Vercel dashboard only).
 */
export const maxDuration = 60;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

export async function GET(req: Request) {
  const brand = await getBrand();
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "not_configured" }, 503);
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  if (!process.env.SUPABASE_SECRET_KEY) return json({ error: "not_configured" }, 503);
  const admin = createAdminClient();

  let reminded = 0;
  const { data: due } = await admin.rpc("due_signup_reminders");
  for (const email of (due as string[] | null) ?? []) {
    const { error } = await admin.auth.resend({ type: "signup", email });
    if (!error) reminded++;
    else if (error.status === 429) break; // email limit reached: the rest are marked and skipped
  }

  const { data: deleted, error: delErr } = await admin.rpc("cleanup_unconfirmed_accounts");

  // E3: a failing email provider must be noticed the same day.
  const { data: counts } = await admin.rpc("signup_funnel_counts", { p_hours: 24 });
  const c = Object.fromEntries(((counts as { step: string; n: number }[] | null) ?? []).map((r) => [r.step, Number(r.n)]));
  const sent = c.code_sent ?? 0, emailFailed = c.email_failed ?? 0, codeFailed = c.code_failed ?? 0;
  const alerts: string[] = [];
  if (emailFailed >= 3 && emailFailed > sent * 0.2) alerts.push(`${emailFailed} sign-up emails failed in 24 h (${sent} sent).`);
  if (codeFailed >= 20 && codeFailed > (c.confirmed ?? 0) * 3) alerts.push(`${codeFailed} wrong or expired codes in 24 h (${c.confirmed ?? 0} confirmed).`);
  if (alerts.length) {
    console.error("[alert] sign-up:", alerts.join(" "));
    if (site.supportEmail) await sendEmail({ to: site.supportEmail, subject: `${brand} sign-up alert`, text: `Daily sign-up check:\n\n${alerts.join("\n")}\n\nCheck Supabase Auth logs and the email provider.` });
  }

  return json({ reminded, deleted: delErr ? null : deleted, funnel: c, alerts: alerts.length });
}
