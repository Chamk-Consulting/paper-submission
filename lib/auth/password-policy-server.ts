import "server-only";
import { getSiteFlags } from "@/lib/config/site-flags";
import { isPwnedPassword } from "@/lib/auth/pwned";
import type { PasswordPolicy } from "@/lib/auth/password-rules";

/** The password rules set in Admin › Venues › Password rules. */
export async function serverPolicy(): Promise<PasswordPolicy> {
  return (await getSiteFlags()).passwordPolicy;
}

/** Found in a known data leak — only when that rule is on. */
export async function isLeakedIfChecked(password: string): Promise<boolean> {
  return (await serverPolicy()).checkLeaks ? isPwnedPassword(password) : false;
}
