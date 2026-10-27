"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyDb, markSections, refresh, venueIdBySlug, type ManageState } from "@/lib/manage/actions-util";
import { MILESTONES, FORM_FIELDS, PDF_RULES, aoeInstant, dateProblems, slugKey, type MilestoneKey } from "@/lib/manage/setup1-shared";
import { newToken } from "@/lib/tokens";
import { absUrl, renderTemplate, sendMany, sendEmail, type Mail } from "@/lib/email/send";
import { ROLE_LABEL } from "@/lib/manage/data";
import { getMe } from "@/lib/auth/me";

/* Setup screens EM01, EM04, EM05, EM07, EM13. RLS + security-definer RPCs enforce who may do what. */

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const issues = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));
const done = (intent: string | null): ManageState => ({ ok: true, savedAt: new Date().toISOString(), ready: intent === "ready" ? true : intent === "undo" ? false : undefined });

async function bySlug(fd: FormData): Promise<{ slug: string; id: string } | { error: string }> {
  const slug = String(fd.get("slug") ?? "");
  if (!slugSchema.safeParse(slug).success) return { error: "Bad request." };
  const id = await venueIdBySlug(slug);
  return id ? { slug, id } : { error: "Event not found." };
}

/* ---------------------------------------------------------------- EM01 create an event */
const createSchema = z.object({
  kind: z.enum(["conference", "workshop", "journal"]),
  name: z.string().trim().min(3, "Enter the full name (at least 3 characters).").max(300),
  short_name: z.string().trim().max(40).optional(),
  sponsor: z.string().trim().max(120).optional(),
  starts_on: z.union([dateSchema, z.literal("")]).optional(),
  ends_on: z.union([dateSchema, z.literal("")]).optional(),
  format: z.enum(["in_person", "hybrid", "online"]),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  location: z.string().trim().max(300).optional(),
});

export async function createEvent(_: ManageState, fd: FormData): Promise<ManageState> {
  const get = (k: string) => (fd.get(k) as string | null) ?? undefined;
  const parsed = createSchema.safeParse(Object.fromEntries(["kind", "name", "short_name", "sponsor", "starts_on", "ends_on", "format", "city", "country", "location"].map((k) => [k, get(k)])));
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const v = parsed.data;
  if (v.starts_on && v.ends_on && v.ends_on < v.starts_on) return { fieldErrors: { ends_on: "The last day must be on or after the first day." } };
  const copyFrom = String(fd.get("copy_from") ?? "");
  const copying = /^[0-9a-f-]{36}$/i.test(copyFrom);
  const copy = { dates: fd.get("c_dates") === "on", types: fd.get("c_types") === "on", review: fd.get("c_review") === "on", emails: fd.get("c_emails") === "on", program: fd.get("c_program") === "on" };
  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("create_event", {
    p: {
      kind: v.kind, name: v.name, short_name: v.short_name ?? "", sponsor: v.sponsor === "None / independent" ? "" : v.sponsor ?? "",
      starts_on: v.starts_on ?? "", ends_on: v.ends_on ?? "", format: v.format, city: v.city ?? "", country: v.country ?? "", location: v.location ?? "",
      copy_from: copying ? copyFrom : "", copy,
    },
  });
  if (error || !slug) return { error: friendlyDb(error?.message) };
  if (copying && fd.get("c_committee") === "on") await copyCommittee(copyFrom, String(slug), v.short_name || v.name);
  redirect(`/manage/${slug}/setup`);
}

/** K1: copy the committee of an earlier event as new invitations — people must accept again. */
async function copyCommittee(fromVenue: string, newSlug: string, label: string) {
  const supabase = await createClient();
  const newId = await venueIdBySlug(newSlug);
  if (!newId) return;
  const { data: people } = await supabase.rpc("venue_people", { p_venue: fromVenue });
  const rows = ((people ?? []) as { person_id: string; roles: string[] }[]);
  const invites: { person: string; role: string; token: string }[] = [];
  for (const p of rows) {
    for (const role of p.roles.filter((r) => !["owner", "author", "reviewer"].includes(r))) {
      const { token, hash } = newToken();
      const { error } = await supabase.rpc("invite_member", { p_venue: newId, p_email: null, p_person: p.person_id, p_role: role, p_token_hash: hash });
      if (!error) invites.push({ person: p.person_id, role, token });
    }
  }
  if (!invites.length) return;
  const { data: emails } = await supabase.rpc("people_emails", { p_venue: newId, p_people: [...new Set(invites.map((i) => i.person))] });
  const byId = new Map(((emails ?? []) as { person_id: string; email: string | null; given_name: string }[]).map((e) => [e.person_id, e]));
  const mails: Mail[] = [];
  for (const i of invites) {
    const e = byId.get(i.person);
    const link = absUrl(`/invite/${i.token}`);
    const role = ROLE_LABEL[i.role] ?? i.role;
    if (e?.email) mails.push({ to: e.email, subject: `Join the ${label} committee as ${role}`, text: `Dear ${e.given_name || "colleague"},\n\nYou were on the committee last time. Would you join ${label} as ${role}? The role starts when you accept.\n\n${link}` });
    await supabase.rpc("notify_people", { p_venue: newId, p_people: [i.person], p_kind: "invite", p_subject: `Join ${label} as ${role}`,
      p_body: `You were on the committee last time. The role starts when you accept.`, p_cta_label: "Open invitation", p_cta_url: `/invite/${i.token}` });
  }
  await sendMany(mails);
}

/* ---------------------------------------------------------------- EM04 dates & phases */
export async function saveDates(_: ManageState, fd: FormData): Promise<ManageState> {
  const ev = await bySlug(fd);
  if ("error" in ev) return { error: ev.error };
  const values: Partial<Record<MilestoneKey, string>> = {};
  const errs: Record<string, string> = {};
  for (const m of MILESTONES) {
    const v = String(fd.get(`d_${m.key}`) ?? "").trim();
    if (!v) continue;
    if (!dateSchema.safeParse(v).success) errs[m.key] = "Use a valid date.";
    else values[m.key] = v;
  }
  if (Object.keys(errs).length) return { fieldErrors: errs };
  const problems = dateProblems(values);
  if (problems.length) {
    const label = (k: MilestoneKey) => MILESTONES.find((m) => m.key === k)!.label;
    return { error: `‘${label(problems[0].a)}’ must be before ‘${label(problems[0].b)}’.`, fieldErrors: Object.fromEntries(problems.map((p) => [p.b, "Out of order"])) };
  }
  const p = MILESTONES.filter((m) => values[m.key]).map((m) => ({
    key: m.key, kind: m.kind, label: m.label, at: aoeInstant(values[m.key]!, m.startOfDay), hard: fd.get(`h_${m.key}`) === "on", note: m.note,
  }));
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_milestones", { p_venue: ev.id, p_dates: p });
  if (error) return { error: friendlyDb(error.message) };
  // keep the event's first/last day in sync with "Conference starts" when it isn't set yet
  if (values.conference) await supabase.from("venues").update({ starts_on: values.conference }).eq("id", ev.id).is("starts_on", null);
  const intent = fd.get("intent") as string | null;
  if (intent === "ready" && !values.paper_deadline) return { error: "Set the paper deadline before marking this ready." };
  await markSections(ev.id, ["dates"], intent);
  refresh(ev.slug, "/setup/dates");
  return done(intent);
}

/* ---------------------------------------------------------------- EM05 submission types */
const typeSchema = z.object({
  name: z.string().trim().min(2, "Name the type.").max(80),
  description: z.string().trim().max(200).optional(),
  pages: z.coerce.number().int().min(1, "At least 1 page.").max(60),
  extra_pages: z.coerce.number().int().min(0).max(20),
  extra_page_fee: z.union([z.coerce.number().int().min(0).max(100000), z.literal("")]).optional(),
  revision_pages: z.union([z.coerce.number().int().min(1).max(80), z.literal("")]).optional(),
  deadline: z.union([dateSchema, z.literal("")]).optional(),
  blind_override: z.enum(["", "double", "single", "open"]).optional(),
});

export async function saveType(_: ManageState, fd: FormData): Promise<ManageState> {
  const ev = await bySlug(fd);
  if ("error" in ev) return { error: ev.error };
  const get = (k: string) => (fd.get(k) as string | null) ?? undefined;
  const parsed = typeSchema.safeParse(Object.fromEntries(["name", "description", "pages", "extra_pages", "extra_page_fee", "revision_pages", "deadline", "blind_override"].map((k) => [k, get(k)])));
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const v = parsed.data;
  const row = {
    venue_id: ev.id, name: v.name, description: v.description || null, pages: v.pages, extra_pages: v.extra_pages,
    extra_page_fee: v.extra_page_fee === "" || v.extra_page_fee === undefined ? null : v.extra_page_fee,
    revision_pages: v.revision_pages === "" || v.revision_pages === undefined ? null : v.revision_pages,
    deadline_at: v.deadline ? aoeInstant(v.deadline) : null, blind_override: v.blind_override || null,
  };
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const q = /^[0-9a-f-]{36}$/i.test(id)
    ? supabase.from("submission_types").update(row).eq("id", id).eq("venue_id", ev.id).select("id").single()
    : supabase.from("submission_types").insert({ ...row, enabled: true, sort: 99 }).select("id").single();
  const { error } = await q;
  if (error) return { error: friendlyDb(error.message) };
  await markSections(ev.id, ["submission_types"], null);
  refresh(ev.slug, "/setup/submissions");
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function toggleType(slug: string, id: string, enabled: boolean): Promise<ManageState> {
  if (!slugSchema.safeParse(slug).success || !/^[0-9a-f-]{36}$/i.test(id)) return { error: "Bad request." };
  const venue = await venueIdBySlug(slug);
  if (!venue) return { error: "Event not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("submission_types").update({ enabled }).eq("id", id).eq("venue_id", venue).select("id").single();
  if (error) return { error: friendlyDb(error.message) };
  refresh(slug, "/setup/submissions");
  return { ok: true };
}

export async function deleteType(slug: string, id: string): Promise<ManageState> {
  if (!slugSchema.safeParse(slug).success || !/^[0-9a-f-]{36}$/i.test(id)) return { error: "Bad request." };
  const venue = await venueIdBySlug(slug);
  if (!venue) return { error: "Event not found." };
  const supabase = await createClient();
  const { data: t } = await supabase.from("submission_types").select("name").eq("id", id).eq("venue_id", venue).maybeSingle();
  if (!t) return { error: "Type not found." };
  const { count } = await supabase.from("submissions").select("id", { count: "exact", head: true }).eq("venue_id", venue).eq("paper_type", t.name as string).eq("is_test", false);
  if (count) return { error: "Papers already use this type — switch it off instead (K3)." };
  const { error } = await supabase.from("submission_types").delete().eq("id", id).eq("venue_id", venue);
  if (error) return { error: friendlyDb(error.message) };
  refresh(slug, "/setup/submissions");
  return { ok: true };
}

/* ---------------------------------------------------------------- EM05 form + PDF rules */
const questionSchema = z.array(z.object({ label: z.string().trim().min(2).max(200), kind: z.enum(["text", "yesno"]), required: z.boolean() })).max(20);

export async function saveSubmissionSettings(_: ManageState, fd: FormData): Promise<ManageState> {
  const ev = await bySlug(fd);
  if ("error" in ev) return { error: ev.error };
  const form_fields: Record<string, string> = {};
  for (const f of FORM_FIELDS) {
    const v = String(fd.get(`f_${f.key}`) ?? "optional");
    form_fields[f.key] = ["required", "optional", "hidden"].includes(v) ? v : "optional";
  }
  for (const k of ["title", "abstract", "authors"]) form_fields[k] = "required"; // the wizard always needs these
  let custom: z.infer<typeof questionSchema> = [];
  try {
    const q = questionSchema.safeParse(JSON.parse(String(fd.get("custom_questions") ?? "[]")));
    if (!q.success) return { fieldErrors: { custom_questions: "Each question needs a label of at least 2 characters." } };
    custom = q.data;
  } catch { return { error: "Bad request." }; }
  const pdf_rules = Object.fromEntries(PDF_RULES.map((r) => [r.key, fd.get(`p_${r.key}`) === "on"]));
  const maxRaw = String(fd.get("max_papers") ?? "").trim();
  const max = maxRaw === "" ? null : Number(maxRaw);
  if (max !== null && (!Number.isInteger(max) || max < 1 || max > 20)) return { fieldErrors: { max_papers: "Use a number from 1 to 20, or leave empty." } };
  const supabase = await createClient();
  const { error } = await supabase.from("venue_settings").update({
    form_fields, custom_questions: custom, pdf_rules, max_papers_per_author: max, keyword_list: String(fd.get("keyword_list") ?? "").trim().slice(0, 200) || null,
  }).eq("venue_id", ev.id).select("venue_id").single();
  if (error) return { error: friendlyDb(error.message) };
  const intent = fd.get("intent") as string | null;
  if (intent === "ready") {
    const { count } = await supabase.from("submission_types").select("id", { count: "exact", head: true }).eq("venue_id", ev.id).eq("enabled", true);
    if (!count) return { error: "Switch on at least one submission type before marking this ready." };
  }
  await markSections(ev.id, ["submission_types", "submission_form", "pdf_rules"], intent);
  refresh(ev.slug, "/setup/submissions");
  return done(intent);
}

/* ---------------------------------------------------------------- EM07 review setup */
const criteriaSchema = z.array(z.object({ key: z.string().max(40).optional(), name: z.string().trim().min(2).max(60), help: z.string().trim().max(160) })).min(1).max(10);

export async function saveReviewSetup(_: ManageState, fd: FormData): Promise<ManageState> {
  const ev = await bySlug(fd);
  if ("error" in ev) return { error: ev.error };
  const num = (k: string, lo: number, hi: number) => { const n = Number(fd.get(k)); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
  const min = num("min_reviews", 1, 6), max = num("max_reviewers", 1, 8), cap = num("ae_cap", 5, 40), days = num("invite_days", 1, 14);
  const errs: Record<string, string> = {};
  if (min === null) errs.min_reviews = "Use 1 to 6.";
  if (max === null) errs.max_reviewers = "Use 1 to 8.";
  if (min !== null && max !== null && max < min) errs.max_reviewers = "Must be at least the minimum.";
  if (cap === null) errs.ae_cap = "Use 5 to 40.";
  if (days === null) errs.invite_days = "Use 1 to 14.";
  const blind = String(fd.get("blind_type") ?? "");
  const ai = String(fd.get("ai_policy") ?? "");
  if (!["double", "single", "open"].includes(blind)) errs.blind_type = "Choose a blind type.";
  if (!["language_only", "allowed_with_declaration", "not_allowed"].includes(ai)) errs.ai_policy = "Choose an AI policy.";
  let criteria: { key: string; name: string; help: string }[] = [];
  try {
    const c = criteriaSchema.safeParse(JSON.parse(String(fd.get("criteria") ?? "[]")));
    if (!c.success) errs.criteria = "Each criterion needs a name (2–60 characters); keep 1 to 10.";
    else {
      const seen = new Set<string>();
      criteria = c.data.map((x) => { let k = x.key || slugKey(x.name); while (seen.has(k)) k += "_2"; seen.add(k); return { key: k, name: x.name, help: x.help }; });
    }
  } catch { errs.criteria = "Bad request."; }
  if (Object.keys(errs).length) return { fieldErrors: errs };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("venue_settings").select("locked_at, blind_type, criteria").eq("venue_id", ev.id).maybeSingle();
  const me = await getMe();
  const { data: own } = me?.person
    ? await supabase.from("venue_members").select("role").eq("venue_id", ev.id).eq("person_id", me.person.id).eq("role", "owner")
    : { data: [] };
  const locked = !!cur?.locked_at && !(own ?? []).length;
  const row: Record<string, unknown> = {
    min_reviews: min, max_reviewers: max, ae_cap: cap, invite_days: days, ai_policy: ai,
    bidding: fd.get("bidding") === "on", discussion: fd.get("discussion") === "on", named_discussion: fd.get("named_discussion") === "on",
    rebuttal: fd.get("rebuttal") === "on", round2: fd.get("round2") === "on",
  };
  if (!locked) { row.blind_type = blind; row.criteria = criteria; }
  const { error } = await supabase.from("venue_settings").update(row).eq("venue_id", ev.id).select("venue_id").single();
  if (error) return { error: friendlyDb(error.message) };
  // keep the public "double-blind" flag in line
  if (!locked) await supabase.from("venues").update({ double_blind: blind === "double", review_mode: blind === "double" ? "Double-blind" : blind === "single" ? "Single-blind" : "Open" }).eq("id", ev.id);
  const intent = fd.get("intent") as string | null;
  await markSections(ev.id, ["review"], intent);
  refresh(ev.slug, "/setup/review");
  return done(intent);
}

/* ---------------------------------------------------------------- EM13 go-live */
export async function openSubmissions(_: ManageState, fd: FormData): Promise<ManageState> {
  const ev = await bySlug(fd);
  if ("error" in ev) return { error: ev.error };
  if (fd.get("ack") !== "on") return { fieldErrors: { ack: "Tick this box to confirm." } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("open_submissions", { p_venue: ev.id, p_ack: true });
  if (error) return { error: friendlyDb(error.message) };
  let info = "";
  if (fd.get("notify") === "on") {
    const n = await notifyCommittee(ev.id, ev.slug);
    info = n.sent || n.inbox ? `Committee told: ${n.inbox} in Plenary${n.sent ? `, ${n.sent} by email` : ""}.` : "";
  }
  refresh(ev.slug, "/setup/go-live");
  return { ok: true, savedAt: new Date().toISOString(), info };
}

async function notifyCommittee(venueId: string, slug: string): Promise<{ sent: number; inbox: number }> {
  const supabase = await createClient();
  const [{ data: people }, { data: venue }, { data: tpls }] = await Promise.all([
    supabase.rpc("venue_people", { p_venue: venueId }),
    supabase.from("venues").select("name, short_name, contact_email").eq("id", venueId).maybeSingle(),
    supabase.from("email_templates").select("venue_id, subject, body").eq("key", "submissions_open"),
  ]);
  const ids = ((people ?? []) as { person_id: string; roles: string[] }[]).filter((p) => p.roles.some((r) => r !== "author")).map((p) => p.person_id);
  if (!ids.length || !venue) return { sent: 0, inbox: 0 };
  const list = (tpls ?? []) as { venue_id: string | null; subject: string; body: string }[];
  const tpl = list.find((x) => x.venue_id === venueId) ?? list.find((x) => !x.venue_id);
  const short = (venue.short_name as string) || (venue.name as string);
  const vars = { "venue.short": short, "venue.name": venue.name as string, "venue.contact": (venue.contact_email as string) ?? "", link: absUrl(`/events/${slug}`) };
  const subject = renderTemplate(tpl?.subject ?? `Submissions are open — ${short}`, vars).text;
  const body = renderTemplate(tpl?.body ?? `Submissions for ${short} are now open.\n\n[link]`, vars).text;
  await supabase.rpc("notify_people", { p_venue: venueId, p_people: ids, p_kind: "venue", p_subject: subject, p_body: body, p_cta_label: "Open event", p_cta_url: `/manage/${slug}` });
  const { data: emails } = await supabase.rpc("people_emails", { p_venue: venueId, p_people: ids });
  const mails = ((emails ?? []) as { email: string | null }[]).filter((e) => e.email).map((e) => ({ to: e.email!, subject, text: body }));
  const r = await sendMany(mails);
  return { sent: r.sent, inbox: ids.length };
}

/** "Send test to me" style check used by the go-live page: emails the signed-in organizer the public link. */
export async function sendGoLiveTest(slug: string, email: string): Promise<ManageState> {
  if (!slugSchema.safeParse(slug).success || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Bad request." };
  const r = await sendEmail({ to: email, subject: "Plenary go-live test", text: `This is a test from the go-live review.\n\nPublic page: ${absUrl(`/events/${slug}`)}` });
  return r.ok ? { ok: true, info: "Test email sent." } : r.skipped ? { info: "Email isn’t configured yet — nothing was sent." } : { error: r.error ?? "Couldn’t send." };
}
