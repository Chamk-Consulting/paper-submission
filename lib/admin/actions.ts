"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { absoluteUrl } from "@/lib/config/site";
import type { SupportItem } from "@/lib/admin/data";

/* AD01 server actions. Messages are English keys; the forms translate them. The database re-checks admin rights on every call. */

export type AdminState = { error?: string; ok?: string; at?: number };

const done = (ok: string): AdminState => { revalidatePath("/[lang]/admin", "page"); return { ok, at: Date.now() }; };
const fail = (msg?: string): AdminState => {
  if (!msg) return { error: "Something went wrong. Please try again." };
  if (/platform admins only|42501/i.test(msg)) return { error: "Only Plenary admins can do this." };
  if (/give a reason/i.test(msg)) return { error: "Give a reason — the person can see it." };
  if (/lock your own/i.test(msg)) return { error: "You can’t lock your own account." };
  if (/write a reply/i.test(msg)) return { error: "Write a reply first." };
  if (/end must be after/i.test(msg)) return { error: "The end must be after the start." };
  if (/future/i.test(msg)) return { error: "Pick a time in the future." };
  if (/12 hours/i.test(msg)) return { error: "Keep a maintenance window under 12 hours." };
  if (/write what you need/i.test(msg)) return { error: "Write what you need to know." };
  return { error: "Something went wrong. Please try again." };
};

const source = z.enum(["contact", "help"]);
const uuid = z.string().uuid();

export async function replySupport(_: AdminState, fd: FormData): Promise<AdminState> {
  const p = z.object({ source, id: uuid, body: z.string().trim().min(2).max(8000) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Write a reply first." };
  const supabase = await createClient();
  const { data: list, error: le } = await supabase.rpc("admin_support_list");
  if (le) return fail(le.message);
  const item = ((list ?? []) as SupportItem[]).find((x) => x.id === p.data.id && x.source === p.data.source);
  if (!item) return { error: "This message no longer exists." };
  let emailed = false;
  if (item.email) {
    const r = await sendEmail({
      to: item.email,
      subject: `Re: ${item.subject} [${item.reference}]`,
      text: `${p.data.body}\n\n— Plenary support\nReference ${item.reference}`,
    });
    emailed = r.ok;
  }
  const { error } = await supabase.rpc("admin_support_reply", { p_source: p.data.source, p_id: p.data.id, p_body: p.data.body, p_emailed: emailed });
  if (error) return fail(error.message);
  return done(emailed ? "Reply sent by email and saved." : "Reply saved. Email isn’t set up yet, so it wasn’t sent — copy it to the person.");
}

export async function closeSupport(_: AdminState, fd: FormData): Promise<AdminState> {
  const p = z.object({ source, id: uuid, reopen: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Something went wrong. Please try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_support_close", { p_source: p.data.source, p_id: p.data.id, p_reopen: p.data.reopen === "1" });
  if (error) return fail(error.message);
  return done(p.data.reopen === "1" ? "Reopened." : "Marked solved.");
}

export async function decideVenue(_: AdminState, fd: FormData): Promise<AdminState> {
  const p = z.object({ id: uuid, intent: z.enum(["approve", "info"]), note: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Something went wrong. Please try again." };
  const supabase = await createClient();
  const { error } = p.data.intent === "approve"
    ? await supabase.rpc("admin_approve_venue", { p_venue: p.data.id, p_note: p.data.note || null })
    : await supabase.rpc("admin_request_venue_info", { p_venue: p.data.id, p_message: p.data.note ?? "" });
  if (error) return fail(error.message);
  return done(p.data.intent === "approve" ? "Approved. The owner was told." : "Sent to the owner’s Plenary inbox.");
}

export async function setRequireApproval(_: AdminState, fd: FormData): Promise<AdminState> {
  const supabase = await createClient();
  const on = fd.get("on") === "1";
  const { error } = await supabase.rpc("admin_set_require_approval", { p_on: on });
  if (error) return fail(error.message);
  return done(on ? "New events now wait for approval before opening." : "Events can open without approval.");
}

export async function lockPerson(_: AdminState, fd: FormData): Promise<AdminState> {
  const p = z.object({ id: uuid, reason: z.string().trim().max(300), lock: z.enum(["1", "0"]) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Give a reason — the person can see it." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_lock_person", { p_person: p.data.id, p_reason: p.data.reason, p_lock: p.data.lock === "1" });
  if (error) return fail(error.message);
  return done(p.data.lock === "1" ? "Account locked and signed out everywhere." : "Account unlocked.");
}

export async function personAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const p = z.object({ id: uuid, action: z.enum(["verification.resent", "person.signed_out"]), email: z.string().email().optional().or(z.literal("")) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Something went wrong. Please try again." };
  const supabase = await createClient();
  if (p.data.action === "verification.resent") {
    if (!p.data.email) return { error: "This person has no email to verify." };
    const { error: re } = await supabase.auth.resend({ type: "signup", email: p.data.email, options: { emailRedirectTo: absoluteUrl("/auth/confirm") } });
    if (re) return { error: "Supabase refused to resend — the email may already be verified." };
  }
  const { error } = await supabase.rpc("admin_note", { p_action: p.data.action, p_person: p.data.id, p_reason: null });
  if (error) return fail(error.message);
  return done(p.data.action === "verification.resent" ? "Verification email sent again." : "Signed out on every device.");
}

export async function scheduleMaintenance(_: AdminState, fd: FormData): Promise<AdminState> {
  const p = z.object({ starts: z.string().min(10), ends: z.string().min(10), message: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Pick a start and an end." };
  const starts = new Date(`${p.data.starts}Z`), ends = new Date(`${p.data.ends}Z`);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return { error: "Pick a start and an end." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_schedule_maintenance", { p_starts: starts.toISOString(), p_ends: ends.toISOString(), p_message: p.data.message ?? null });
  if (error) return fail(error.message);
  return done("Scheduled. It shows on the maintenance page.");
}

export async function cancelMaintenance(_: AdminState, fd: FormData): Promise<AdminState> {
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id)) return { error: "Something went wrong. Please try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_maintenance", { p_id: id });
  if (error) return fail(error.message);
  return done("Maintenance cancelled.");
}
