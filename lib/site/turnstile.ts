import "server-only";

/** Cloudflare Turnstile check. Passes when no secret is configured (CAPTCHA switched off). */
export async function turnstileOk(formData: FormData, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!token) return false;
  return fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.json()).then((j: { success?: boolean }) => !!j.success).catch(() => false);
}
