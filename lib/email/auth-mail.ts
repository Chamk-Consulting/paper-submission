import "server-only";

/* Sign-in / sign-up / reset emails sent by Plenary itself (Supabase "Send Email" hook → Resend). */

export type AuthAction = "signup" | "magiclink" | "recovery" | "invite" | "email_change" | "email" | "reauthentication";

const COPY: Record<string, { subject: string; title: string; lead: string; button: string }> = {
  magiclink: { subject: "Your Plenary sign-in code", title: "Sign in to Plenary", lead: "Enter this code on the sign-in page, or use the button. Both work once and expire in 1 hour.", button: "Sign in" },
  email: { subject: "Your Plenary sign-in code", title: "Sign in to Plenary", lead: "Enter this code on the sign-in page, or use the button. Both work once and expire in 1 hour.", button: "Sign in" },
  signup: { subject: "Confirm your email for Plenary", title: "Confirm your email", lead: "Enter this code to finish creating your account, or use the button. It expires in 1 hour.", button: "Confirm email" },
  invite: { subject: "You're invited to Plenary", title: "Join Plenary", lead: "Use the button to accept the invitation and set up your account.", button: "Accept invitation" },
  recovery: { subject: "Reset your Plenary password", title: "Reset your password", lead: "Enter this code on the reset page, or use the button to choose a new password. It expires in 1 hour.", button: "Choose a new password" },
  email_change: { subject: "Confirm your new email for Plenary", title: "Confirm your new email", lead: "Enter this code, or use the button, to switch your Plenary account to this address.", button: "Confirm new email" },
  reauthentication: { subject: "Your Plenary security code", title: "Confirm it's you", lead: "Enter this code to finish the change you started. It expires in a few minutes.", button: "" },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function authMail(action: string, code: string | null, link: string | null, to: string) {
  const c = COPY[action] ?? COPY.magiclink;
  const codeBlock = code
    ? `<p style="margin:24px 0 6px;font:500 12px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#4A5263">Your code</p>
       <p style="margin:0;font:600 34px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.18em;color:#0E1B3D">${esc(code)}</p>`
    : "";
  const button = link && c.button
    ? `<p style="margin:28px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#F2A93B;color:#0E1B3D;font:600 16px/1 system-ui,sans-serif;text-decoration:none;padding:14px 22px;border-radius:4px">${esc(c.button)}</a></p>
       <p style="margin:16px 0 0;font:13px/1.5 system-ui,sans-serif;color:#4A5263">Button not working? Copy this link:<br><a href="${esc(link)}" style="color:#2F5FD0;word-break:break-all">${esc(link)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#F5F6F3;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #DADDE3;border-radius:8px;padding:32px 28px;font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;color:#121826">
    <p style="margin:0;font:22px/1 Georgia,serif;color:#0E1B3D">Plenary</p>
    <h1 style="margin:24px 0 0;font:400 28px/1.2 Georgia,serif;color:#121826">${esc(c.title)}</h1>
    <p style="margin:10px 0 0;color:#4A5263">${esc(c.lead)}</p>
    ${codeBlock}${button}
    <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #EEF0EC;font:12px/1.5 system-ui,sans-serif;color:#4A5263">Sent to ${esc(to)}. If you didn't ask for this, ignore this email — nothing changes without the code or the button.</p>
  </div></body></html>`;
  const text = [c.title, "", c.lead, code ? `\nYour code: ${code}` : "", link && c.button ? `\n${c.button}: ${link}` : "", `\n\nSent to ${to}. If you didn't ask for this, ignore this email.`].join("\n");
  return { subject: c.subject, html, text };
}
