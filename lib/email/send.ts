import "server-only";
import { site } from "@/lib/config/site";

/*
 * Outgoing email through Resend's HTTP API. Configure RESEND_API_KEY in Vercel (never in code or chat).
 * Without the key nothing is sent ({ skipped: true }) — callers still deliver the Plenary inbox copy (I2),
 * so the product keeps working in staging.
 */
export type Mail = { to: string | string[]; subject: string; text: string; html?: string; from?: string; replyTo?: string };
export type MailResult = { ok: boolean; skipped?: boolean; id?: string; error?: string };

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

export async function sendEmail(m: Mail): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: m.from ?? site.email.eventsFrom, to: Array.isArray(m.to) ? m.to : [m.to], subject: m.subject, text: m.text, html: m.html ?? textToHtml(m.text), reply_to: m.replyTo }),
      signal: AbortSignal.timeout(10000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    return res.ok ? { ok: true, id: body.id } : { ok: false, error: body.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Send many, a few at a time. Returns counts for EM27/EM41 statistics. */
export async function sendMany(list: Mail[], concurrency = 4): Promise<{ sent: number; failed: number; skipped: number }> {
  let i = 0, sent = 0, failed = 0, skipped = 0;
  const worker = async () => {
    while (i < list.length) {
      const r = await sendEmail(list[i++]);
      if (r.ok) sent++; else if (r.skipped) skipped++; else failed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  return { sent, failed, skipped };
}

/** Fill [placeholders] (canvas EM09 syntax). Unknown or empty values are reported, so sending can be blocked (I5). */
export function renderTemplate(tpl: string, vars: Record<string, string | number | null | undefined>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = tpl.replace(/\[([a-z]+(?:\.[a-z_]+)+|link|deadline|submitter|inviter|role)\]/g, (m, k: string) => {
    const v = vars[k];
    if (v === undefined || v === null || v === "") { missing.add(k); return m; }
    return String(v);
  });
  return { text, missing: [...missing] };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function textToHtml(text: string): string {
  const body = esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#121826;max-width:600px">${body}<p style="margin:24px 0 0;font-size:12px;color:#4A5263">Sent by ${site.name}. A copy is in your Plenary inbox.</p></div>`;
}

export const absUrl = (path: string) => `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
