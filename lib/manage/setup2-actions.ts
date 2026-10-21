"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/auth/me";
import { friendlyDb, markSections, refresh, venueIdBySlug, type ManageState } from "@/lib/manage/actions-util";
import { absUrl, renderTemplate, sendEmail } from "@/lib/email/send";
import { hashToken, newToken } from "@/lib/tokens";
import { ROLE_LABEL } from "@/lib/manage/data";

/* Setup part 2: committee & conflicts (EM08), invitations, emails (EM09), publishing (EM10), program & rooms (EM11),
   people (EM40), my conflicts (EMR1), audit export (EM44). */

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);
const INVITE_ROLES = ["associate_editor", "deputy_chair", "program_chair", "publication_chair", "registration_chair", "staff", "ceb_chair", "chair", "reviewer", "session_chair"] as const;
const done = (intent: string | null): ManageState => ({ ok: true, savedAt: new Date().toISOString(), ready: intent === "ready" ? true : intent === "undo" ? false : undefined });

async function resolveVenue(fd: FormData): Promise<{ slug: string; id: string } | null> {
  const slug = String(fd.get("slug") ?? "");
  if (!slugSchema.safeParse(slug).success) return null;
  const id = await venueIdBySlug(slug);
  return id ? { slug, id } : null;
}

async function templateFor(venueId: string, key: string): Promise<{ subject: string; body: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_templates").select("venue_id, subject, body").eq("key", key).or(`venue_id.is.null,venue_id.eq.${venueId}`);
  const rows = (data ?? []) as { venue_id: string | null; subject: string; body: string }[];
  return rows.find((r) => r.venue_id === venueId) ?? rows.find((r) => r.venue_id === null) ?? null;
}

/* ------------------------------------------------------------------ EM08 committee: invite */
export async function inviteCommittee(_: ManageState, fd: FormData): Promise<ManageState> {
  const v = await resolveVenue(fd);
  if (!v) return { error: "Bad request." };
  const role = String(fd.get("role") ?? "");
  if (!(INVITE_ROLES as readonly string[]).includes(role)) return { fieldErrors: { role: "Choose a role." } };
  const raw = String(fd.get("recipients") ?? "").split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  if (!raw.length) return { fieldErrors: { recipients: "Enter at least one email or Plenary ID." } };
  if (raw.length > 50) return { fieldErrors: { recipients: "Invite at most 50 people at a time." } };
  const bad = raw.filter((r) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r) && !/^pl-\d{4}-\d{4}$/i.test(r));
  if (bad.length) return { fieldErrors: { recipients: `Not an email or Plenary ID: ${bad.slice(0, 3).join(", ")}` } };

  const supabase = await createClient();
  const me = await getMe();
  const inviter = me?.person ? `${me.person.given_name} ${me.person.family_name}`.trim() : me?.email ?? "";
  const { data: venue } = await supabase.from("venues").select("name, short_name, contact_email").eq("id", v.id).single();
  const tpl = await templateFor(v.id, "committee_invitation");
  const label = ROLE_LABEL[role] ?? role;
  let sent = 0, mailed = 0;
  const errors: string[] = [];
  for (const r of raw) {
    let personId: string | null = null;
    let email: string | null = /@/.test(r) ? r.toLowerCase() : null;
    if (!email) {
      const { data: found } = await supabase.rpc("find_person", { p_query: r });
      personId = ((found as { person_id: string }[] | null)?.[0]?.person_id) ?? null;
      if (!personId) { errors.push(`${r}: no account with this Plenary ID`); continue; }
    }
    const { token, hash } = newToken();
    const { error } = await supabase.rpc("invite_member", { p_venue: v.id, p_email: email, p_person: personId, p_role: role, p_token_hash: hash, p_load_cap: null, p_message: null });
    if (error) { errors.push(`${r}: ${friendlyDb(error.message)}`); continue; }
    sent++;
    const link = absUrl(`/invite/${token}`);
    const vars = { "venue.short": venue?.short_name || venue?.name, "venue.name": venue?.name, "venue.contact": venue?.contact_email, role: label, inviter, link };
    const subject = renderTemplate(tpl?.subject ?? "Join the [venue.short] committee as [role]", vars).text;
    const body = renderTemplate(tpl?.body ?? "[inviter] invites you to join [venue.short] as [role].\n\n[link]", vars).text;
    // the person may already have an account: inbox copy + their address
    if (!personId && email) {
      const { data: found } = await supabase.rpc("find_person", { p_query: email });
      personId = ((found as { person_id: string }[] | null)?.[0]?.person_id) ?? null;
    }
    if (personId) {
      await supabase.rpc("notify_people", { p_venue: v.id, p_people: [personId], p_kind: "invite", p_subject: subject, p_body: body, p_submission: null, p_cta_label: "Open invitation", p_cta_url: `/invite/${token}` });
      if (!email) {
        const { data: em } = await supabase.rpc("people_emails", { p_venue: v.id, p_people: [personId] });
        email = ((em as { email: string | null }[] | null)?.[0]?.email) ?? null;
      }
    }
    if (email) {
      const res = await sendEmail({ to: email, subject, text: body, replyTo: venue?.contact_email ?? undefined });
      if (res.ok) mailed++;
    }
  }
  refresh(v.slug, "/setup/committee");
  if (!sent) return { error: errors.join(" · ") || "No invitation sent." };
  return { ok: true, savedAt: new Date().toISOString(), info: errors.length ? `${sent} sent · ${errors.join(" · ")}` : mailed < sent ? `${sent} sent · email not configured, inbox only` : `${sent} sent` };
}

export async function revokeInvitation(slug: string, invitationId: string): Promise<{ error?: string }> {
  if (!slugSchema.safeParse(slug).success || !z.guid().safeParse(invitationId).success) return { error: "Bad request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation: invitationId });
  if (error) return { error: friendlyDb(error.message) };
  refresh(slug, "/setup/committee");
  return {};
}

export async function removeMember(slug: string, personId: string, role: string): Promise<{ error?: string }> {
  if (!slugSchema.safeParse(slug).success || !z.guid().safeParse(personId).success) return { error: "Bad request." };
  const id = await venueIdBySlug(slug);
  if (!id) return { error: "Event not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_venue: id, p_person: personId, p_role: role });
  if (error) return { error: friendlyDb(error.message) };
  refresh(slug, "/setup/committee");
  return {};
}

/* ------------------------------------------------------------------ EM08 conflict policy */
export async function saveConflictPolicy(_: ManageState, fd: FormData): Promise<ManageState> {
  const v = await resolveVenue(fd);
  if (!v) return { error: "Bad request." };
  const parsed = z.object({ coauthor_years: z.coerce.number().int().min(1).max(10), institution_years: z.coerce.number().int().min(0).max(10) })
    .safeParse({ coauthor_years: fd.get("coauthor_years"), institution_years: fd.get("institution_years") });
  if (!parsed.success) return { error: "Check the windows: co-authorship 1–10 years, institution 0–10 years." };
  const supabase = await createClient();
  const { error } = await supabase.from("venue_settings").update({
    ...parsed.data, use_declared: fd.get("use_declared") === "on", override_second: fd.get("override_second") === "on",
  }).eq("venue_id", v.id).select("venue_id").single();
  if (error) return { error: friendlyDb(error.message) };
  const intent = fd.get("intent") as string | null;
  await markSections(v.id, ["committee", "conflicts"], intent);
  refresh(v.slug, "/setup/committee");
  return done(intent);
}

/* ------------------------------------------------------------------ /invite/[token] */
export async function respondCommitteeInvitation(token: string, accept: boolean): Promise<{ status?: string; error?: string }> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { error: "This invitation link is not valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_invitation", { p_token_hash: hashToken(token), p_accept: accept });
  if (error) return { error: friendlyDb(error.message) };
  return { status: data as string };
}

/* ------------------------------------------------------------------ EM09 emails */
const templateSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/),
  subject: z.string().trim().min(3, "Enter a subject.").max(200),
  body: z.string().trim().min(10, "Write the message (at least 10 characters).").max(20000),
});

export async function saveTemplate(_: ManageState, fd: FormData): Promise<ManageState> {
  const v = await resolveVenue(fd);
  if (!v) return { error: "Bad request." };
  const parsed = templateSchema.safeParse({ key: fd.get("key"), subject: fd.get("subject"), body: fd.get("body") });
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const supabase = await createClient();
  const intent = fd.get("intent") as string | null;
  const me = await getMe();
  const { data: base } = await supabase.from("email_templates").select("name, recipients, subject, body").eq("key", parsed.data.key).is("venue_id", null).maybeSingle();
  const { data: own } = await supabase.from("email_templates").select("id").eq("key", parsed.data.key).eq("venue_id", v.id).maybeSingle();
  const changed = !base || base.subject !== parsed.data.subject || base.body !== parsed.data.body;
  if (own) {
    const { error } = await supabase.from("email_templates").update({ subject: parsed.data.subject, body: parsed.data.body, updated_by: me?.person?.id ?? null, updated_at: new Date().toISOString() }).eq("id", own.id);
    if (error) return { error: friendlyDb(error.message) };
  } else if (changed) {
    const { error } = await supabase.from("email_templates").insert({ venue_id: v.id, key: parsed.data.key, name: base?.name ?? parsed.data.key, recipients: base?.recipients ?? "authors", subject: parsed.data.subject, body: parsed.data.body, updated_by: me?.person?.id ?? null });
    if (error) return { error: friendlyDb(error.message) };
  }
  const sendAs = fd.get("send_as_event");
  if (sendAs !== null) await supabase.from("venue_settings").update({ send_as_event: sendAs === "on" }).eq("venue_id", v.id);
  if (intent === "ready" || intent === "undo" || intent === "save") await markSections(v.id, ["emails"], intent);
  refresh(v.slug, "/setup/emails");
  return done(intent);
}

export async function resetTemplate(slug: string, key: string): Promise<{ error?: string }> {
  if (!slugSchema.safeParse(slug).success || !/^[a-z][a-z0-9_]{2,40}$/.test(key)) return { error: "Bad request." };
  const id = await venueIdBySlug(slug);
  if (!id) return { error: "Event not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("email_templates").delete().eq("venue_id", id).eq("key", key);
  if (error) return { error: friendlyDb(error.message) };
  refresh(slug, "/setup/emails");
  return {};
}

export async function sendTestTemplate(slug: string, subject: string, body: string): Promise<{ to?: string; error?: string; skipped?: boolean }> {
  if (!slugSchema.safeParse(slug).success) return { error: "Bad request." };
  const me = await getMe();
  if (!me?.email) return { error: "Sign in first." };
  const id = await venueIdBySlug(slug);
  if (!id) return { error: "Event not found." };
  const res = await sendEmail({ to: me.email, subject: `[Test] ${subject.slice(0, 190)}`, text: body.slice(0, 20000) });
  if (res.skipped) return { to: me.email, skipped: true };
  return res.ok ? { to: me.email } : { error: res.error ?? "Could not send." };
}

/* ------------------------------------------------------------------ EM10 publishing */
const feeRow = z.object({ name: z.string().trim().min(1).max(60), early: z.number().min(0).max(100000).nullable(), late: z.number().min(0).max(100000).nullable(), covers: z.enum(["n", "0", "1", "2", "3", "4", "-"]) });
export async function savePublishing(_: ManageState, fd: FormData): Promise<ManageState> {
  const v = await resolveVenue(fd);
  if (!v) return { error: "Bad request." };
  let fees: z.infer<typeof feeRow>[] = [];
  try { fees = z.array(feeRow).max(20).parse(JSON.parse(String(fd.get("fee_types") ?? "[]"))); } catch { return { error: "Check the fee table: every row needs a name; amounts are numbers." }; }
  const parsed = z.object({
    copyright_mode: z.enum(["ieee_ecf", "other_form", "none"]),
    ieee_record: z.string().trim().max(40), isbn: z.string().trim().max(40),
    papers_per_registration: z.coerce.number().int().min(1).max(4),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }).safeParse({ copyright_mode: fd.get("copyright_mode"), ieee_record: fd.get("ieee_record") ?? "", isbn: fd.get("isbn") ?? "", papers_per_registration: fd.get("papers_per_registration"), currency: String(fd.get("currency") ?? "USD").toUpperCase() });
  if (!parsed.success) return { error: "Check the highlighted fields." };
  const supabase = await createClient();
  const { error } = await supabase.from("venue_settings").update({
    copyright_mode: parsed.data.copyright_mode, ieee_record: parsed.data.ieee_record || null, isbn: parsed.data.isbn || null,
    papers_per_registration: parsed.data.papers_per_registration, currency: parsed.data.currency,
    open_access: fd.get("open_access") === "on", extra_pages_prepaid: fd.get("extra_pages_prepaid") === "on", fee_types: fees,
  }).eq("venue_id", v.id).select("venue_id").single();
  if (error) return { error: friendlyDb(error.message) };
  const intent = fd.get("intent") as string | null;
  await markSections(v.id, ["copyright", "registration"], intent);
  refresh(v.slug, "/setup/publishing");
  return done(intent);
}

/* ------------------------------------------------------------------ EM11 program & rooms */
const roomRow = z.object({ id: z.guid().nullable(), name: z.string().trim().min(1, "Every room needs a name.").max(80), seats: z.number().int().min(1).max(20000).nullable(), equipment: z.string().trim().max(200) });
const dayRow = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), label: z.string().trim().max(80), note: z.string().trim().max(120) });
export async function saveProgramSetup(_: ManageState, fd: FormData): Promise<ManageState> {
  const v = await resolveVenue(fd);
  if (!v) return { error: "Bad request." };
  let rooms: z.infer<typeof roomRow>[] = [], days: z.infer<typeof dayRow>[] = [];
  try {
    rooms = z.array(roomRow).max(60).parse(JSON.parse(String(fd.get("rooms") ?? "[]")));
    days = z.array(dayRow).max(21).parse(JSON.parse(String(fd.get("days") ?? "[]")));
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : null;
    return { error: msg && !/expected|invalid/i.test(msg) ? msg : "Check rooms and days: names are required, seats are numbers, dates use the date picker." };
  }
  const fmt = z.object({ minutes_per_paper: z.coerce.number().int().min(10).max(40), papers_per_session: z.coerce.number().int().min(3).max(8), parallel_sessions: z.coerce.number().int().min(1).max(12) })
    .safeParse({ minutes_per_paper: fd.get("minutes_per_paper"), papers_per_session: fd.get("papers_per_session"), parallel_sessions: fd.get("parallel_sessions") });
  if (!fmt.success) return { error: "Check the session format numbers." };
  const supabase = await createClient();
  const { error } = await supabase.from("venue_settings").update({
    ...fmt.data, poster_sessions: fd.get("poster_sessions") === "on", allow_remote: fd.get("allow_remote") === "on",
    program_days: days.sort((a, b) => (a.date < b.date ? -1 : 1)),
  }).eq("venue_id", v.id).select("venue_id").single();
  if (error) return { error: friendlyDb(error.message) };
  // rooms: delete removed, update kept, insert new
  const { data: existing } = await supabase.from("rooms").select("id").eq("venue_id", v.id);
  const keep = new Set(rooms.filter((r) => r.id).map((r) => r.id as string));
  const gone = ((existing ?? []) as { id: string }[]).map((r) => r.id).filter((id) => !keep.has(id));
  if (gone.length) {
    const { error: e } = await supabase.from("rooms").delete().in("id", gone);
    if (e) return { error: friendlyDb(e.message) };
  }
  for (const [i, r] of rooms.entries()) {
    const row = { venue_id: v.id, name: r.name, seats: r.seats, equipment: r.equipment || null, sort: i };
    const { error: e } = r.id ? await supabase.from("rooms").update(row).eq("id", r.id) : await supabase.from("rooms").insert(row);
    if (e) return { error: friendlyDb(e.message) };
  }
  const intent = fd.get("intent") as string | null;
  await markSections(v.id, ["program"], intent);
  refresh(v.slug, "/setup/program");
  return done(intent);
}

/* ------------------------------------------------------------------ EM40 people */
export async function messagePerson(_: ManageState, fd: FormData): Promise<ManageState> {
  const v = await resolveVenue(fd);
  if (!v) return { error: "Bad request." };
  const parsed = z.object({ person: z.guid(), subject: z.string().trim().min(2, "Add a subject.").max(200), body: z.string().trim().min(2, "Write a message.").max(8000) })
    .safeParse({ person: fd.get("person"), subject: fd.get("subject"), body: fd.get("body") });
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_message", { p_venue: v.id, p_people: [parsed.data.person], p_subject: parsed.data.subject, p_body: parsed.data.body, p_submission: null });
  if (error) return { error: friendlyDb(error.message) };
  return { ok: true, savedAt: new Date().toISOString(), info: "Message sent to their Plenary inbox." };
}

export async function logOrganizerEvent(slug: string, action: "data.export" | "view_as.started" | "view_as.ended", details: Record<string, string | number>): Promise<{ error?: string }> {
  if (!slugSchema.safeParse(slug).success) return { error: "Bad request." };
  const id = await venueIdBySlug(slug);
  if (!id) return { error: "Event not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_organizer_event", { p_venue: id, p_action: action, p_details: details });
  return error ? { error: friendlyDb(error.message) } : {};
}

/* ------------------------------------------------------------------ EMR1 declared conflicts */
export async function addDeclaredConflict(_: ManageState, fd: FormData): Promise<ManageState> {
  const parsed = z.object({ who: z.string().trim().min(2, "Name a person or an institution.").max(200), kind: z.enum(["person", "institution"]), reason: z.string().trim().min(2, "Give a short reason.").max(200), until_year: z.string().regex(/^(\d{4})?$/) })
    .safeParse({ who: fd.get("who"), kind: fd.get("kind"), reason: fd.get("reason"), until_year: String(fd.get("until_year") ?? "") });
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const me = await getMe();
  if (!me?.person) return { error: "Sign in first." };
  const supabase = await createClient();
  let other: string | null = null;
  let institution: string | null = null;
  if (parsed.data.kind === "person") {
    const { data: found } = await supabase.rpc("find_person", { p_query: parsed.data.who });
    other = ((found as { person_id: string }[] | null)?.[0]?.person_id) ?? null;
    if (!other) return { fieldErrors: { who: "No account found — use their email or Plenary ID, or declare their institution." } };
  } else institution = parsed.data.who;
  const { error } = await supabase.from("declared_conflicts").insert({ person_id: me.person.id, other_person: other, institution, reason: parsed.data.reason, until_year: parsed.data.until_year ? Number(parsed.data.until_year) : null });
  if (error) return { error: friendlyDb(error.message) };
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function removeDeclaredConflict(id: string): Promise<{ error?: string }> {
  if (!z.guid().safeParse(id).success) return { error: "Bad request." };
  const supabase = await createClient();
  const { error } = await supabase.from("declared_conflicts").delete().eq("id", id);
  return error ? { error: friendlyDb(error.message) } : {};
}
