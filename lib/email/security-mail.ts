import "server-only";
import { absoluteUrl, site } from "@/lib/config/site";
import { sendEmail } from "@/lib/email/send";

/*
 * Security emails sent by the web app itself (not the Supabase hook): the code that confirms an extra
 * email address, and notices after a security change. Same layout as the account emails (lib/email/auth-mail.ts).
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

type Layout = { subject: string; kicker: string; kickerInk: string; title: string; lead: string; code?: string | null; minutes?: number; button?: { label: string; href: string } | null; rows: [string, string][]; note: string; to: string };

function layout(l: Layout) {
  const digits = l.code
    ? l.code.split("").map((d, k) => `${k === Math.ceil(l.code!.length / 2) ? '<td style="width:10px"></td>' : ""}<td style="width:44px;height:56px;border:1px solid #DADDE3;border-radius:6px;background:#ffffff;text-align:center;font:600 30px/56px ${MONO};color:#0E1B3D">${esc(d)}</td>`).join('<td style="width:6px"></td>')
    : "";
  const codeBlock = l.code ? `
    <table role="presentation" width="100%" style="margin-top:22px;background:#F5F6F3;border-radius:8px"><tr><td style="padding:18px;text-align:center">
      <p style="margin:0;font:500 11px/1.4 ${MONO};letter-spacing:.08em;text-transform:uppercase;color:#4A5263">Your ${l.code.length}-digit code</p>
      <table role="presentation" align="center" style="margin:10px auto 0;border-collapse:separate"><tr>${digits}</tr></table>
      <p style="margin:10px 0 0;font:13px/1.5 ${SANS};color:#4A5263">Expires in ${l.minutes ?? 10} minutes · works once</p>
    </td></tr></table>` : "";
  const button = l.button ? `
    <div style="margin-top:22px;text-align:center">
      <a href="${esc(l.button.href)}" style="display:inline-block;padding:14px 26px;background:#F2A93B;color:#0E1B3D;font:700 16px/1 ${SANS};border-radius:4px;text-decoration:none">${esc(l.button.label)}</a>
    </div>` : "";
  const details = `
    <div style="margin-top:24px;border-top:1px solid #EEF0EC;padding-top:14px">
      <p style="margin:0 0 6px;font:500 11px/1.4 ${MONO};letter-spacing:.06em;text-transform:uppercase;color:#4A5263">Request details</p>
      <table role="presentation" width="100%" style="border-collapse:collapse;font:13px/1.5 ${SANS}">${l.rows.map(([k, v]) => `<tr><td style="padding:5px 0;color:#4A5263;width:110px;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;color:#121826">${esc(v)}</td></tr>`).join("")}</table>
    </div>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(l.subject)}</title></head>
<body style="margin:0;background:#EEF0EC;padding:28px 12px">
  <div style="display:none;max-height:0;overflow:hidden">${esc(l.lead)}</div>
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #DADDE3;border-radius:10px;padding:32px 28px;font:15px/1.55 ${SANS};color:#121826">
    <p style="margin:0;font:22px/1 ${SERIF};color:#121826">Plenary</p>
    <p style="margin:24px 0 0;font:500 11px/1.4 ${MONO};letter-spacing:.08em;text-transform:uppercase;color:${l.kickerInk}">${esc(l.kicker)}</p>
    <h1 style="margin:6px 0 0;font:400 30px/1.15 ${SERIF};color:#121826">${esc(l.title)}</h1>
    <p style="margin:8px 0 0;color:#4A5263">${esc(l.lead)}</p>
    ${codeBlock}${button}${details}
    <div style="margin-top:20px;padding:12px 14px;background:#FFF6E6;border:1px solid #F1D29A;border-radius:6px;font:13px/1.5 ${SANS};color:#3B2A07">${l.note}</div>
  </div>
  <p style="max-width:600px;margin:18px auto 0;font:12px/1.6 ${SANS};color:#4A5263;text-align:center">Sent to <strong style="color:#121826">${esc(l.to)}</strong> by Plenary · conference submission &amp; review.<br>This is a security email, so it can't be turned off.</p>
</body></html>`;
  const text = [l.title, "", l.lead, l.code ? `\nYour code: ${l.code} (expires in ${l.minutes ?? 10} minutes)` : "", l.button ? `\n${l.button.label}: ${l.button.href}` : "", "", ...l.rows.map(([k, v]) => `${k}: ${v}`), "", l.note.replace(/<[^>]+>/g, "")].join("\n");
  return { subject: l.subject, html, text };
}

const when = () => new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
const host = () => new URL(absoluteUrl("/")).host;

/** The code that proves the person owns an extra email address. */
export function addEmailMail(to: string, code: string, accountEmail: string) {
  return layout({
    subject: `Confirm this email for Plenary: ${code}`,
    kicker: "Confirm an email", kickerInk: "#1F47A8",
    title: "Add this email to your account",
    lead: "Enter this code on the Sign-in & security page to add this address to your Plenary account. It helps co-authors and chairs find you, and links papers sent to it.",
    code, minutes: 10,
    rows: [["Requested", when()], ["Account", accountEmail], ["Adding", to], ["Site", host()]],
    note: "<strong>Didn't ask for this?</strong> Ignore this email — the address isn't added without the code. Plenary staff will never ask you for it.",
    to,
  });
}

export type NoticeKind = "password_changed" | "email_added" | "two_step_on" | "two_step_off";

const NOTICE: Record<NoticeKind, { subject: string; title: string; lead: string }> = {
  password_changed: { subject: "Your Plenary password was changed", title: "Your password was changed", lead: "The password for your Plenary account was just changed." },
  email_added: { subject: "An email was added to your Plenary account", title: "A new email was added", lead: "An extra email address was just added to your Plenary account." },
  two_step_on: { subject: "Two-step sign-in is on for your Plenary account", title: "Two-step sign-in is on", lead: "An authenticator app was just added. From now on, signing in also asks for a 6-digit code from that app." },
  two_step_off: { subject: "An authenticator app was removed from your Plenary account", title: "An authenticator app was removed", lead: "An authenticator app was just removed from your Plenary account." },
};

/** Tell the person about a security change. Best effort: a failed send never blocks the change. */
export async function sendSecurityNotice(kind: NoticeKind, to: string, detail?: string) {
  if (!to) return;
  const n = NOTICE[kind];
  const rows: [string, string][] = [["When", when()], ["Account", to], ...(detail ? ([["Detail", detail]] as [string, string][]) : []), ["Site", host()]];
  const mail = layout({
    subject: n.subject, kicker: "Security notice", kickerInk: "#B3261E", title: n.title, lead: n.lead,
    button: { label: "Review sign-in & security", href: absoluteUrl("/workspace/account/security") },
    rows,
    note: "<strong>Wasn't you?</strong> Reset your password now from the sign-in page and sign out of all other devices under Sign-in &amp; security. Then contact Plenary support.",
    to,
  });
  try { await sendEmail({ to, from: site.email.authFrom, ...mail }); } catch { /* best effort */ }
}
