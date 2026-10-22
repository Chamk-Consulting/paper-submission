import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Mail } from "@/lib/email/send";

/** The kinds a person can switch off in Settings › Notifications (the rest are always sent). */
export type OptionalKind = "review_invitation" | "review_due" | "coauthor_request" | "coauthor_changes" | "paper_steps" | "venue_announcements" | "program_changes" | "new_calls" | "messages";

/**
 * Leaves out the emails whose recipient chose "Off" for this kind. The Plenary inbox copy is still delivered by
 * the caller, so nothing is lost — only the email. If the check fails, mail goes out as before.
 */
export async function dropOptedOut(supabase: SupabaseClient, mails: Mail[], kind: OptionalKind): Promise<Mail[]> {
  const to = [...new Set(mails.flatMap((m) => (Array.isArray(m.to) ? m.to : [m.to])).map((a) => a.toLowerCase()))];
  if (!to.length) return mails;
  const { data, error } = await supabase.rpc("email_optouts", { p_emails: to, p_kind: kind });
  if (error || !Array.isArray(data) || !data.length) return mails;
  const off = new Set((data as string[]).map((a) => a.toLowerCase()));
  return mails
    .map((m) => ({ ...m, to: (Array.isArray(m.to) ? m.to : [m.to]).filter((a) => !off.has(a.toLowerCase())) }))
    .filter((m) => m.to.length > 0);
}
