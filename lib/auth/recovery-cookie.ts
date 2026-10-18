import "server-only";
import { cookies } from "next/headers";

// Kept out of the "use server" module so it can't be called from the browser.
export const RECOVERY_COOKIE = "pl_recovery";
const RECOVERY_TTL = 15 * 60;

/** Marks this browser as having just proven the reset code/link. PR11 requires it. */
export async function markRecovery(userId: string) {
  // TODO(auth): also enable Supabase "Secure password change" so a stolen session alone
  // can't change the password; this cookie is a UX gate, not the security boundary.
  (await cookies()).set(RECOVERY_COOKIE, userId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: RECOVERY_TTL });
}

export async function hasRecovery(userId: string) {
  return (await cookies()).get(RECOVERY_COOKIE)?.value === userId;
}

export async function clearRecovery() {
  (await cookies()).delete(RECOVERY_COOKIE);
}
