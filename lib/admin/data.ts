import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMe, type Me } from "@/lib/auth/me";

/* AD01 platform admin: loaders. Every read goes through admin_* RPCs, which refuse anyone not in platform_admins. */

export type AdminTab = "support" | "venues" | "people" | "status";
export const ADMIN_TABS: AdminTab[] = ["support", "venues", "people", "status"];

export type SupportItem = {
  source: "contact" | "help"; id: string; reference: string; topic: string; subject: string; name: string | null; email: string | null;
  person_id: string | null; plenary_id: string | null; body: string; allow_access: boolean; status: "new" | "open" | "closed";
  details: Record<string, unknown>; created_at: string; replies: { body: string; at: string; emailed: boolean }[];
};
export type AdminVenue = {
  id: string; slug: string; name: string; short_name: string | null; kind: string; starts_on: string | null; location: string | null; website: string | null;
  created_at: string; approved_at: string | null; approval_note: string | null; status: "pending" | "info" | "approved";
  owner_name: string | null; owner_email: string | null; personal_email: boolean; papers: number;
};
export type AdminPerson = {
  person_id: string; display_name: string; plenary_id: string | null; orcid: string | null; created_at: string; has_login: boolean;
  locked_at: string | null; locked_reason: string | null; merged_into: string | null;
  emails: { email: string; primary: boolean; verified: boolean }[]; roles: { venue: string; role: string }[];
  last_sign_in: { at: string; method: string; place: string | null; result: string } | null; recent_admin: { at: string; action: string; reason: string | null }[];
};
export type MaintenanceWindow = { id: number; starts_at: string; ends_at: string; message: string | null; shift_minutes: number; near_deadlines: { venue: string; label: string; at: string }[] };
export type AuditRow = { at: string; action: string; admin_name: string | null; target: string | null; reason: string | null };
export type Overview = { support_new: number; venues_pending: number; require_venue_approval: boolean };

/** Signed in + platform admin, or leave. A database without the admin migration counts as "not admin". */
export async function requireAdmin(next = "/admin"): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error || data !== true) redirect("/no-access");
  return me;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return [];
  return (data ?? []) as T[];
}

export async function loadOverview(): Promise<Overview> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_overview");
  const o = (data ?? {}) as Partial<Overview>;
  return { support_new: Number(o.support_new ?? 0), venues_pending: Number(o.venues_pending ?? 0), require_venue_approval: !!o.require_venue_approval };
}
export const loadSupport = () => rpc<SupportItem>("admin_support_list");
export const loadVenues = () => rpc<AdminVenue>("admin_venues");
export const findPeople = (q: string) => (q.trim().length >= 3 ? rpc<AdminPerson>("admin_find_person", { p_query: q.trim() }) : Promise.resolve([]));
export const loadMaintenance = () => rpc<MaintenanceWindow>("admin_maintenance");
export const loadAudit = (limit = 20) => rpc<AuditRow>("admin_audit_recent", { p_limit: limit });
