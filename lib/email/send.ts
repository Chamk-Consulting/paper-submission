import "server-only";
import { site } from "@/lib/config/site";
import { getBrand } from "@/lib/config/brand";
import { brandify } from "@/lib/i18n/t-core";

/*
 * Outgoing email through Resend's HTTP API. Configure RESEND_API_KEY in Vercel (never in code or chat).
 * Without the key nothing is sent ({ skipped: true }) — callers still deliver the Plenary inbox copy (I2),
 * so the product keeps working in staging.
 */
/** unsubscribeUrl (optional mail only, see lib/email/unsubscribe.ts): adds List-Unsubscribe headers and a footer link. */
export type Mail = { to: string | string[]; subject: string; text: string; html?: string; from?: string; replyTo?: string; unsubscribeUrl?: string };
export type MailResult = { ok: boolean; skipped?: boolean; id?: string; error?: string };

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

// Reserved test domains (RFC 2606/6761) never receive mail: sending there only bounces and hurts the domain's
// reputation. Such sends are logged and reported as delivered so test flows keep working.
const RESERVED = /@(?:[^@\s]+\.)?(?:example\.(?:com|org|net)|example|test|invalid|localhost)$/i;

export async function sendEmail(m: Mail): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  const to = (Array.isArray(m.to) ? m.to : [m.to]).filter(Boolean);
  const real = to.filter((a) => !RESERVED.test(a.trim()));
  if (real.length === 0) {
    console.info(`[email] not sent to reserved test address(es): ${to.join(", ")} · ${m.subject}`);
    return { ok: true, id: "test-address" };
  }
  if (real.length < to.length) m = { ...m, to: real };
  // The product name from the database, in the sender name, subject and body (organizers' "plenary session" is kept).
  const brand = await getBrand();
  m = { ...m, subject: brandify(m.subject, brand), text: brandify(m.text, brand), html: m.html ? brandify(m.html, brand) : m.html, from: brandify(m.from ?? site.email.eventsFrom, brand) };
  const u = m.unsubscribeUrl;
  const text = u ? `${m.text}\n\n—\nStop these emails: ${u}` : m.text;
  const html = brandify(m.html ? (u ? `${m.html}${unsubFooter(u)}` : m.html) : textToHtml(m.text, u), brand);
  const headers = u ? { "List-Unsubscribe": `<${u.replace("/unsubscribe/", "/api/unsubscribe/")}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: m.from, to: Array.isArray(m.to) ? m.to : [m.to], subject: m.subject, text, html, reply_to: m.replyTo, headers }),
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
const unsubFooter = (u: string) => `<p style="margin:8px 0 0;font-size:12px;color:#4A5263"><a href="${esc(u)}" style="color:#4A5263">Unsubscribe from these emails</a></p>`;
export function textToHtml(text: string, unsubscribeUrl?: string): string {
  const body = esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#121826;max-width:600px">${body}<p style="margin:24px 0 0;font-size:12px;color:#4A5263">Sent by ${site.name}. A copy is in your Plenary inbox.</p>${unsubscribeUrl ? unsubFooter(unsubscribeUrl) : ""}</div>`;
}

export const absUrl = (path: string) => `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
