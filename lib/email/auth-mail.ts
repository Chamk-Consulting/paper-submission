import "server-only";

/*
 * Account emails (sign-in, sign-up, reset, invite, email change) sent by Plenary itself through Resend,
 * via the Supabase "Send Email" hook. Layout follows canvas EML01–EML04: code + button + request details.
 */

export type AuthAction = "signup" | "magiclink" | "recovery" | "invite" | "email_change" | "email" | "reauthentication";

const copy: Record<string, { subject: string; kicker: string; kickerInk: string; title: string; lead: string; button: string; ignore: string }> = {
  magiclink: { subject: "Your Plenary sign-in code", kicker: "Sign-in code", kickerInk: "#18744F", title: "Sign in to Plenary", lead: "Enter this code on the sign-in page, or use the button on this device.", button: "Sign in to Plenary", ignore: "<strong>Didn't ask for this?</strong> Ignore this email — nobody can sign in without the code. Plenary staff will never ask you for it." },
  signup: { subject: "Confirm your email for Plenary", kicker: "Step 2 of 3 · confirm your email", kickerInk: "#1F47A8", title: "Welcome to Plenary", lead: "Enter this code on the page where you created your account, or use the button. Then add your affiliation and research topics — it takes about a minute.", button: "Confirm my email", ignore: "<strong>Didn't create an account?</strong> Ignore this email — no account is created without the code." },
  recovery: { subject: "Reset your Plenary password", kicker: "Password reset", kickerInk: "#B3261E", title: "Reset your password", lead: "Enter this code on the reset page, or use the button to choose a new password. Your current password keeps working until you change it.", button: "Choose a new password", ignore: "<strong>Didn't ask for a reset?</strong> Your password hasn't changed. Ignore this email." },
  invite: { subject: "You're invited to Plenary", kicker: "Invitation", kickerInk: "#1F47A8", title: "Join Plenary", lead: "Use the button to accept the invitation and set up your account.", button: "Accept invitation", ignore: "<strong>Not expecting this?</strong> Ignore this email — nothing happens unless you accept." },
  email_change: { subject: "Confirm your new email for Plenary", kicker: "Email change", kickerInk: "#1F47A8", title: "Confirm your new email", lead: "Enter this code, or use the button, to switch your Plenary account to this address.", button: "Confirm new email", ignore: "<strong>Didn't ask for this?</strong> Ignore this email — your address stays the same." },
  reauthentication: { subject: "Your Plenary security code", kicker: "Security code", kickerInk: "#18744F", title: "Confirm it's you", lead: "Enter this code to finish the change you started.", button: "", ignore: "<strong>Didn't ask for this?</strong> Ignore this email and consider changing your password." },
};
copy.email = copy.magiclink;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

export type AuthMailInput = { action: string; code: string | null; link: string | null; to: string; name?: string | null; minutes?: number; continueTo?: string | null; siteHost: string; requestedAt?: Date };

export function authMail(i: AuthMailInput) {
  const c = copy[i.action] ?? copy.magiclink;
  const minutes = i.minutes ?? 60;
  const title = i.action === "signup" && i.name ? `Welcome to Plenary, ${i.name}` : c.title;
  const when = (i.requestedAt ?? new Date()).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const subject = i.code ? `${c.subject}: ${i.code}` : c.subject;

  const digits = i.code
    ? i.code.split("").map((d, k) => `${k === Math.ceil(i.code!.length / 2) ? '<td style="width:10px"></td>' : ""}<td style="width:44px;height:56px;border:1px solid #DADDE3;border-radius:6px;background:#ffffff;text-align:center;font:600 30px/56px ${MONO};color:#0E1B3D">${esc(d)}</td>`).join('<td style="width:6px"></td>')
    : "";
  const codeBlock = i.code ? `
    <table role="presentation" width="100%" style="margin-top:22px;background:#F5F6F3;border-radius:8px"><tr><td style="padding:18px;text-align:center">
      <p style="margin:0;font:500 11px/1.4 ${MONO};letter-spacing:.08em;text-transform:uppercase;color:#4A5263">Your ${i.code ? i.code.length : 6}-digit code</p>
      <table role="presentation" align="center" style="margin:10px auto 0;border-collapse:separate"><tr>${digits}</tr></table>
      <p style="margin:10px 0 0;font:13px/1.5 ${SANS};color:#4A5263">Expires in ${minutes} minutes · works once</p>
    </td></tr></table>` : "";
  const button = i.link && c.button ? `
    <div style="margin-top:22px;text-align:center">
      <a href="${esc(i.link)}" style="display:inline-block;padding:14px 26px;background:#F2A93B;color:#0E1B3D;font:700 16px/1 ${SANS};border-radius:4px;text-decoration:none">${esc(c.button)}</a>
      <p style="margin:10px 0 0;font:12px/1.5 ${SANS};color:#4A5263">Button not working? Paste this link:<br><a href="${esc(i.link)}" style="font:11px/1.5 ${MONO};color:#2F5FD0;word-break:break-all">${esc(i.link)}</a></p>
    </div>` : "";
  const cont = i.continueTo ? `
    <table role="presentation" width="100%" style="margin-top:22px;border:1px solid #DADDE3;border-radius:8px"><tr><td style="padding:12px 14px">
      <p style="margin:0;font:10px/1.4 ${MONO};letter-spacing:.06em;text-transform:uppercase;color:#4A5263">After this you'll continue to</p>
      <p style="margin:2px 0 0;font:600 14px/1.4 ${SANS};color:#121826">${esc(i.continueTo)}</p>
    </td></tr></table>` : "";
  const rows: [string, string][] = [["Requested", when], ["Sent to", i.to], ["Site", i.siteHost]];
  const details = `
    <div style="margin-top:24px;border-top:1px solid #EEF0EC;padding-top:14px">
      <p style="margin:0 0 6px;font:500 11px/1.4 ${MONO};letter-spacing:.06em;text-transform:uppercase;color:#4A5263">Request details</p>
      <table role="presentation" width="100%" style="border-collapse:collapse;font:13px/1.5 ${SANS}">${rows.map(([k, v]) => `<tr><td style="padding:5px 0;color:#4A5263;width:110px;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;color:#121826">${esc(v)}</td></tr>`).join("")}</table>
    </div>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#EEF0EC;padding:28px 12px">
  <div style="display:none;max-height:0;overflow:hidden">${esc(c.lead)}</div>
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #DADDE3;border-radius:10px;padding:32px 28px;font:15px/1.55 ${SANS};color:#121826">
    <p style="margin:0;font:22px/1 ${SERIF};color:#121826">Plenary</p>
    <p style="margin:24px 0 0;font:500 11px/1.4 ${MONO};letter-spacing:.08em;text-transform:uppercase;color:${c.kickerInk}">${esc(c.kicker)}</p>
    <h1 style="margin:6px 0 0;font:400 30px/1.15 ${SERIF};color:#121826">${esc(title)}</h1>
    <p style="margin:8px 0 0;color:#4A5263">${esc(c.lead)}</p>
    ${codeBlock}${button}${cont}${details}
    <div style="margin-top:20px;padding:12px 14px;background:#FFF6E6;border:1px solid #F1D29A;border-radius:6px;font:13px/1.5 ${SANS};color:#3B2A07">${c.ignore}</div>
  </div>
  <p style="max-width:600px;margin:18px auto 0;font:12px/1.6 ${SANS};color:#4A5263;text-align:center">Sent to <strong style="color:#121826">${esc(i.to)}</strong> by Plenary · conference submission &amp; review.<br>This is a security email, so it can't be turned off.</p>
</body></html>`;

  const text = [c.title, "", c.lead, i.code ? `\nYour code: ${i.code} (expires in ${minutes} minutes)` : "", i.link && c.button ? `\n${c.button}: ${i.link}` : "", i.continueTo ? `\nAfter this you'll continue to: ${i.continueTo}` : "", `\nRequested: ${when}\nSent to: ${i.to}`, `\n${c.ignore.replace(/<[^>]+>/g, "")}`].join("\n");
  return { subject, html, text };
}
