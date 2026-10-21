"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { newToken } from "@/lib/tokens";
import { scorePassword } from "@/lib/auth/password-rules";
import { notifyEvents } from "@/lib/account/data";
import { absoluteUrl } from "@/lib/config/site";

export type AccountState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; savedAt?: string; info?: string; value?: string };

/* English messages, translated by the client with t(). */
const MSG = {
  generic: "Something went wrong. Please try again.",
  signIn: "Your session has ended. Sign in again.",
  denied: "You don’t have permission to change this.",
  topics: "Pick between 3 and 10 topics.",
  firstName: "Enter your first name.",
  lastName: "Enter your last name.",
  scholar: "Use a full address starting with https://",
  ieee: "IEEE member numbers are up to 20 characters.",
  institution: "Enter the institution (at least 2 characters).",
  years: "The end year can’t be before the start year.",
  reason: "Say briefly why (at least 2 characters).",
  conflictTarget: "Pick a person or type an institution.",
  wrongPassword: "Your current password is not right.",
  weakPassword: "Use at least 12 characters, not a common password and not your email.",
  samePassword: "The new password must be different.",
  reply: "Write a reply first.",
  timezone: "Pick a time zone from the list.",
};

const friendly = (msg?: string) => {
  if (!msg) return MSG.generic;
  if (/row-level security|permission denied|not allowed|42501/i.test(msg)) return MSG.denied;
  if (/sign in first/i.test(msg)) return MSG.signIn;
  if (/replies are not possible|not possible here/i.test(msg)) return "Replies aren’t possible in this conversation — it’s a notice from Plenary.";
  return MSG.generic;
};
const saved = (): AccountState => ({ ok: true, savedAt: new Date().toISOString() });
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const issues = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));

async function ctx() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: person } = await supabase.from("persons").select("id").eq("user_id", auth.user.id).maybeSingle();
  if (!person) return null;
  return { supabase, user: auth.user, personId: person.id as string };
}
const page = (p: string) => revalidatePath(`/[lang]${p}`, "page");

/* ---------------------------------------------------------------- ST01 profile */
const profileSchema = z.object({
  given_name: z.string().trim().min(1, MSG.firstName).max(120),
  family_name: z.string().trim().min(1, MSG.lastName).max(120),
  name_script: z.string().trim().max(200),
  pronouns: z.string().trim().max(40),
  ieee_member: z.string().trim().max(20, MSG.ieee),
  scholar_url: z.string().trim().max(300).refine((v) => !v || /^https:\/\/\S+$/.test(v), MSG.scholar),
  topics: z.array(z.string().trim().min(1).max(120)).min(3, MSG.topics).max(10, MSG.topics),
});

export async function saveProfile(_: AccountState, fd: FormData): Promise<AccountState> {
  const parsed = profileSchema.safeParse({
    given_name: str(fd, "given_name"), family_name: str(fd, "family_name"), name_script: str(fd, "name_script"), pronouns: str(fd, "pronouns"),
    ieee_member: str(fd, "ieee_member"), scholar_url: str(fd, "scholar_url"), topics: [...new Set(fd.getAll("topics").map(String))],
  });
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const c = await ctx();
  if (!c) return { error: MSG.signIn };
  const v = parsed.data;
  const { error } = await c.supabase.from("persons").update({
    given_name: v.given_name, family_name: v.family_name, pronouns: v.pronouns || null, ieee_member: v.ieee_member || null, scholar_url: v.scholar_url || null,
    name_scripts: v.name_script ? [{ script: "other", name: v.name_script }] : [],
  }).eq("id", c.personId);
  if (error) return { error: friendly(error.message) };

  const { data: cur } = await c.supabase.from("person_topics").select("topic").eq("person_id", c.personId);
  const have = new Set(((cur ?? []) as { topic: string }[]).map((x) => x.topic));
  const drop = [...have].filter((x) => !v.topics.includes(x));
  const add = v.topics.filter((x) => !have.has(x));
  if (drop.length) {
    const r = await c.supabase.from("person_topics").delete().eq("person_id", c.personId).in("topic", drop);
    if (r.error) return { error: friendly(r.error.message) };
  }
  if (add.length) {
    const r = await c.supabase.from("person_topics").insert(add.map((topic) => ({ person_id: c.personId, topic })));
    if (r.error) return { error: friendly(r.error.message) };
  }
  page("/settings/profile");
  return saved();
}

const year = z.string().trim().regex(/^(19[5-9]\d|20\d\d|2100)?$/).transform((v) => (v ? Number(v) : null));
const affSchema = z.object({
  id: z.guid().or(z.literal("")),
  institution: z.string().trim().min(2, MSG.institution).max(200, MSG.institution),
  department: z.string().trim().max(200),
  position_title: z.string().trim().max(120),
  from: year,
  to: year,
  current: z.boolean(),
}).refine((v) => v.current || !v.from || !v.to || v.to >= v.from, { message: MSG.years, path: ["to"] });

export async function saveAffiliation(_: AccountState, fd: FormData): Promise<AccountState> {
  const parsed = affSchema.safeParse({
    id: str(fd, "id"), institution: str(fd, "institution"), department: str(fd, "department"), position_title: str(fd, "position_title"),
    from: str(fd, "from"), to: str(fd, "to"), current: fd.get("current") === "on",
  });
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const c = await ctx();
  if (!c) return { error: MSG.signIn };
  const v = parsed.data;
  const row = {
    institution: v.institution, department: v.department || null, position_title: v.position_title || null,
    starts_on: v.from ? `${v.from}-01-01` : null, ends_on: v.current ? null : v.to ? `${v.to}-12-31` : v.from ? `${v.from}-12-31` : null,
  };
  const { error } = v.id
    ? await c.supabase.from("affiliations").update(row).eq("id", v.id).eq("person_id", c.personId)
    : await c.supabase.from("affiliations").insert({ ...row, person_id: c.personId });
  if (error) return { error: friendly(error.message) };
  page("/settings/profile");
  return saved();
}

export async function deleteAffiliation(id: string): Promise<AccountState> {
  if (!z.guid().safeParse(id).success) return { error: MSG.generic };
  const c = await ctx();
  if (!c) return { error: MSG.signIn };
  const { error } = await c.supabase.from("affiliations").delete().eq("id", id).eq("person_id", c.personId);
  if (error) return { error: friendly(error.message) };
  page("/settings/profile");
  return saved();
}

export type PersonHit = { person_id: string; display_name: string; institution: string | null; plenary_id: string | null };
export async function findPeople(q: string): Promise<PersonHit[]> {
  const query = String(q ?? "").trim().slice(0, 120);
  if (query.length < 3) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("find_person", { p_query: query });
  return ((data ?? []) as PersonHit[]).slice(0, 8);
}

const conflictSchema = z.object({
  other_person: z.guid().or(z.literal("")),
  institution: z.string().trim().max(200),
  reason: z.string().trim().min(2, MSG.reason).max(200),
}).refine((v) => v.other_person || v.institution.length >= 2, { message: MSG.conflictTarget, path: ["institution"] });

export async function addConflict(_: AccountState, fd: FormData): Promise<AccountState> {
  const parsed = conflictSchema.safeParse({ other_person: str(fd, "other_person"), institution: str(fd, "institution"), reason: str(fd, "reason") });
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const c = await ctx();
  if (!c) return { error: MSG.signIn };
  const v = parsed.data;
  const { error } = await c.supabase.from("declared_conflicts").insert({
    person_id: c.personId, other_person: v.other_person || null, institution: v.other_person ? null : v.institution, reason: v.reason,
  });
  if (error) return { error: friendly(error.message) };
  page("/settings/profile");
  return saved();
}

export async function removeConflict(id: string): Promise<AccountState> {
  if (!z.guid().safeParse(id).success) return { error: MSG.generic };
  const c = await ctx();
  if (!c) return { error: MSG.signIn };
  const { error } = await c.supabase.from("declared_conflicts").delete().eq("id", id).eq("person_id", c.personId);
  if (error) return { error: friendly(error.message) };
  page("/settings/profile");
  return saved();
}

/* ---------------------------------------------------------------- ST02 security */
export async function changePassword(_: AccountState, fd: FormData): Promise<AccountState> {
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const c = await ctx();
  if (!c) return { error: MSG.signIn };
  const email = c.user.email ?? "";
  if (!scorePassword(next, email).ok) return { fieldErrors: { next: MSG.weakPassword } };
  if (next === current) return { fieldErrors: { next: MSG.samePassword } };
  if (!current) return { fieldErrors: { current: MSG.wrongPassword } };
  const check = await c.supabase.auth.signInWithPassword({ email, password: current });
  if (check.error) {
    await c.supabase.rpc("record_sign_in", { p_method: "password", p_place: null, p_user_agent: await userAgent(), p_result: "password change: wrong current password" });
    return { fieldErrors: { current: MSG.wrongPassword } };
  }
  const { error } = await c.supabase.auth.updateUser({ password: next });
  if (error) return { error: /weak|pwned|leaked/i.test(error.message) ? MSG.weakPassword : MSG.generic };
  page("/settings/security");
  return saved();
}

async function userAgent() {
  return ((await headers()).get("user-agent") ?? "").slice(0, 300) || null;
}

export async function signOutOthers(): Promise<AccountState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: MSG.generic };
  return saved();
}

/* ---------------------------------------------------------------- ST03 notifications */
const TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));
export async function savePrefs(_: AccountState, fd: FormData): Promise<AccountState> {
  const modes = Object.fromEntries(notifyEvents.map((k) => [k, fd.get(`mode_${k}`) === "digest" ? "digest" : "now"]));
  const reminders = { d7: fd.get("d7") === "on", d3: fd.get("d3") === "on", h24: fd.get("h24") === "on" };
  const tz = str(fd, "timezone");
  const locale = z.enum(["en", "fr", "it", "de"]).safeParse(str(fd, "locale"));
  if (tz && !TIMEZONES.has(tz) && tz !== "UTC") return { fieldErrors: { timezone: MSG.timezone } };
  const c = await ctx();
  if (!c) return { error: MSG.signIn };
  const r1 = await c.supabase.from("notification_prefs").upsert({ person_id: c.personId, modes, reminders, updated_at: new Date().toISOString() });
  if (r1.error) return { error: friendly(r1.error.message) };
  const r2 = await c.supabase.from("persons").update({ timezone: tz || null, locale: locale.success ? locale.data : null }).eq("id", c.personId);
  if (r2.error) return { error: friendly(r2.error.message) };
  page("/settings/notifications");
  return { ...saved(), value: locale.success ? locale.data : "" };
}

/* ---------------------------------------------------------------- ST04 privacy */
export async function savePrivacy(_: AccountState, fd: FormData): Promise<AccountState> {
  const vis = z.enum(["public", "signed_in", "venues_only"]).safeParse(fd.get("visibility"));
  if (!vis.success) return { error: MSG.generic };
  const c = await ctx();
  if (!c) return { error: MSG.signIn };
  const r1 = await c.supabase.from("persons").update({ visibility: vis.data, is_public: vis.data === "public" }).eq("id", c.personId);
  if (r1.error) return { error: friendly(r1.error.message) };
  const now = new Date().toISOString();
  const { data: cur } = await c.supabase.from("consents").select("kind, granted").eq("person_id", c.personId);
  const have = new Map(((cur ?? []) as { kind: string; granted: boolean }[]).map((x) => [x.kind, x.granted]));
  const want = { share_with_venues: fd.get("share_with_venues") === "on", product_news: fd.get("product_news") === "on" };
  const changed = Object.entries(want).filter(([k, g]) => have.get(k) !== g).map(([kind, granted]) => ({ person_id: c.personId, kind, granted, recorded_at: now }));
  if (changed.length) {
    const r2 = await c.supabase.from("consents").upsert(changed);
    if (r2.error) return { error: friendly(r2.error.message) };
  }
  page("/settings/privacy");
  return saved();
}

export async function requestData(kind: "export" | "delete"): Promise<AccountState> {
  if (kind !== "export" && kind !== "delete") return { error: MSG.generic };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_data", { p_kind: kind });
  if (error) return { error: friendly(error.message) };
  page("/settings/privacy");
  return { ok: true, value: String(data) };
}

/* ---------------------------------------------------------------- CL01 calendar */
const flagsSchema = z.object({ submissions: z.boolean(), reviews: z.boolean(), sessions: z.boolean(), followed: z.boolean() });
export type FeedResult = AccountState & { url?: string };

export async function saveFeedFlags(flags: z.infer<typeof flagsSchema>): Promise<AccountState> {
  const f = flagsSchema.safeParse(flags);
  if (!f.success) return { error: MSG.generic };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_calendar_feed", { p_token_hash: null, p_flags: f.data });
  if (error) return { error: friendly(error.message) };
  return saved();
}

/** Creates a feed (or replaces the old one, which stops working). The address is returned once; only its hash is stored. */
export async function newFeed(flags: z.infer<typeof flagsSchema>): Promise<FeedResult> {
  const f = flagsSchema.safeParse(flags);
  if (!f.success) return { error: MSG.generic };
  const supabase = await createClient();
  const { token, hash } = newToken();
  const { error } = await supabase.rpc("set_calendar_feed", { p_token_hash: hash, p_flags: f.data });
  if (error) return { error: friendly(error.message) };
  page("/settings/calendar");
  return { ...saved(), url: absoluteUrl(`/feed/${token}.ics`) };
}

/* ---------------------------------------------------------------- IN01 inbox */
const uuid = z.guid();
async function participant(threadId: string, patch: { read_at?: string | null; archived_at?: string | null }): Promise<AccountState> {
  if (!uuid.safeParse(threadId).success) return { error: MSG.generic };
  const c = await ctx();
  if (!c) return { error: MSG.signIn };
  const { error } = await c.supabase.from("inbox_participants").update(patch).eq("thread_id", threadId).eq("person_id", c.personId);
  if (error) return { error: friendly(error.message) };
  page("/inbox");
  return { ok: true };
}
export async function markThreadRead(threadId: string, read = true) {
  return participant(threadId, { read_at: read ? new Date().toISOString() : null });
}
export async function archiveThread(threadId: string, archived = true) {
  return participant(threadId, { archived_at: archived ? new Date().toISOString() : null });
}

export async function replyToThread(_: AccountState, fd: FormData): Promise<AccountState> {
  const threadId = str(fd, "thread");
  const body = String(fd.get("body") ?? "").trim();
  if (!uuid.safeParse(threadId).success) return { error: MSG.generic };
  if (body.length < 1) return { fieldErrors: { body: MSG.reply } };
  if (body.length > 20000) return { fieldErrors: { body: MSG.generic } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_thread", { p_thread: threadId, p_body: body });
  if (error) return { error: friendly(error.message) };
  page("/inbox");
  page("/inbox/[threadId]");
  return saved();
}
