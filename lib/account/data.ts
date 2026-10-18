import "server-only";
import { createClient } from "@/lib/supabase/server";

/* Reads for the account pages (ST01–ST04, CL01), inbox (IN01) and search (SR01). RLS limits every read to the signed-in person. */

export type Affiliation = { id: string; institution: string; department: string | null; position_title: string | null; country: string | null; starts_on: string | null; ends_on: string | null };
export type Conflict = { id: string; other_person: string | null; other_name: string | null; other_plenary_id: string | null; institution: string | null; reason: string; until_year: number | null };
export type Profile = {
  personId: string;
  email: string;
  given_name: string; family_name: string; pronouns: string; plenary_id: string | null; orcid: string | null;
  ieee_member: string; scholar_url: string;
  name_script: string;
  affiliations: Affiliation[];
  topics: string[];
  conflicts: Conflict[];
};

type PersonRow = {
  id: string; given_name: string; family_name: string; pronouns: string | null; plenary_id: string | null; orcid: string | null;
  ieee_member: string | null; scholar_url: string | null; name_scripts: { script?: string; name?: string }[] | null;
  visibility: string | null; timezone: string | null; locale: string | null;
};

async function me() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: person } = await supabase.from("persons").select("*").eq("user_id", auth.user.id).maybeSingle();
  if (!person) return null;
  return { supabase, user: auth.user, person: person as PersonRow };
}

export async function getProfile(): Promise<Profile | null> {
  const m = await me();
  if (!m) return null;
  const { supabase, user, person } = m;
  const [{ data: affs }, { data: topics }, { data: conflicts }] = await Promise.all([
    supabase.from("affiliations").select("id, institution, department, position_title, country, starts_on, ends_on").eq("person_id", person.id).order("ends_on", { ascending: false, nullsFirst: true }).order("starts_on", { ascending: false }),
    supabase.from("person_topics").select("topic").eq("person_id", person.id),
    supabase.rpc("my_conflicts"),
  ]);
  return {
    personId: person.id,
    email: user.email ?? "",
    given_name: person.given_name ?? "",
    family_name: person.family_name ?? "",
    pronouns: person.pronouns ?? "",
    plenary_id: person.plenary_id,
    orcid: person.orcid,
    ieee_member: person.ieee_member ?? "",
    scholar_url: person.scholar_url ?? "",
    name_script: person.name_scripts?.[0]?.name ?? "",
    affiliations: (affs ?? []) as Affiliation[],
    topics: ((topics ?? []) as { topic: string }[]).map((x) => x.topic),
    conflicts: (conflicts ?? []) as Conflict[],
  };
}

export type SignInEvent = { id: number; method: string; place: string | null; user_agent: string | null; result: string; at: string };
export async function getSecurity() {
  const m = await me();
  if (!m) return null;
  const { data } = await m.supabase.from("sign_in_events").select("id, method, place, user_agent, result, at").order("at", { ascending: false }).limit(10);
  const u = m.user as { email?: string; updated_at?: string; last_sign_in_at?: string; identities?: { provider: string }[] };
  return {
    email: u.email ?? "",
    lastSignInAt: u.last_sign_in_at ?? null,
    providers: (u.identities ?? []).map((i) => i.provider),
    events: (data ?? []) as SignInEvent[],
  };
}

export const notifyEvents = ["review_invitation", "review_due", "coauthor_request", "coauthor_changes", "venue_announcements", "messages", "new_calls"] as const;
export type NotifyEvent = (typeof notifyEvents)[number];
export type Prefs = { modes: Record<NotifyEvent, "now" | "digest">; reminders: { d7: boolean; d3: boolean; h24: boolean }; timezone: string; locale: string; hasFeed: boolean };
const defaultModes: Prefs["modes"] = { review_invitation: "now", review_due: "now", coauthor_request: "now", coauthor_changes: "digest", venue_announcements: "digest", messages: "now", new_calls: "digest" };

export async function getPrefs(): Promise<Prefs | null> {
  const m = await me();
  if (!m) return null;
  const [{ data }, { data: feed }] = await Promise.all([
    m.supabase.from("notification_prefs").select("modes, reminders").eq("person_id", m.person.id).maybeSingle(),
    m.supabase.rpc("my_calendar_feed"),
  ]);
  const modes = { ...defaultModes, ...((data?.modes ?? {}) as Partial<Prefs["modes"]>) };
  const reminders = { d7: true, d3: true, h24: true, ...((data?.reminders ?? {}) as Partial<Prefs["reminders"]>) };
  return { modes, reminders, timezone: m.person.timezone ?? "", locale: m.person.locale ?? "", hasFeed: ((feed ?? []) as unknown[]).length > 0 };
}

export type Consents = { processing: string | null; share_with_venues: boolean; product_news: boolean };
export type DataRequest = { id: string; kind: "export" | "delete" | "merge" | "import"; status: string; scheduled_for: string | null; blocked_reason: string | null; file_path: string | null; created_at: string };
export async function getPrivacy() {
  const m = await me();
  if (!m) return null;
  const [{ data: cons }, { data: reqs }] = await Promise.all([
    m.supabase.from("consents").select("kind, granted, recorded_at").eq("person_id", m.person.id),
    m.supabase.from("data_requests").select("id, kind, status, scheduled_for, blocked_reason, file_path, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const rows = (cons ?? []) as { kind: string; granted: boolean; recorded_at: string }[];
  const get = (k: string) => rows.find((r) => r.kind === k);
  const requests = (reqs ?? []) as DataRequest[];
  return {
    visibility: (m.person.visibility ?? "signed_in") as "public" | "signed_in" | "venues_only",
    consents: {
      processing: get("processing")?.recorded_at ?? (m.user as { created_at?: string }).created_at ?? null,
      share_with_venues: get("share_with_venues")?.granted ?? true,
      product_news: get("product_news")?.granted ?? false,
    } satisfies Consents,
    lastExport: requests.find((r) => r.kind === "export") ?? null,
    lastDelete: requests.find((r) => r.kind === "delete" && r.status !== "cancelled") ?? null,
  };
}

export type CalItem = { category: "submissions" | "reviews" | "sessions" | "followed"; uid: string; title: string; starts_at: string; ends_at: string | null; location: string | null; description: string | null; url: string | null };
export type FeedFlags = { submissions: boolean; reviews: boolean; sessions: boolean; followed: boolean };
export async function getCalendar() {
  const m = await me();
  if (!m) return null;
  const [{ data: feed }, { data: items }] = await Promise.all([
    m.supabase.rpc("my_calendar_feed"),
    m.supabase.rpc("my_calendar_items", { p_flags: { submissions: true, reviews: true, sessions: true, followed: true } }),
  ]);
  const f = ((feed ?? []) as { id: string; flags: Partial<FeedFlags>; created_at: string }[])[0] ?? null;
  return {
    feed: f,
    flags: { submissions: true, reviews: true, sessions: true, followed: false, ...(f?.flags ?? {}) } as FeedFlags,
    items: ((items ?? []) as CalItem[])
      .filter((i) => new Date(i.starts_at).getTime() > Date.now() - 864e5)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    timezone: m.person.timezone ?? null,
  };
}

export type InboxRow = {
  thread_id: string; kind: string; subject: string; venue: string | null; submission_id: string | null; last_body: string | null; last_from: string | null;
  last_at: string | null; unread: boolean; reply_allowed: boolean; archived: boolean; cta_label: string | null; cta_url: string | null;
};
export type ThreadMessage = { id: string; sender: string; is_me: boolean; body: string; cta_label: string | null; cta_url: string | null; created_at: string };

export async function getInbox() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_inbox");
  if (error) return [] as InboxRow[];
  return ((data ?? []) as InboxRow[]).sort((a, b) => (b.last_at ?? "").localeCompare(a.last_at ?? ""));
}

export async function getThreadMessages(threadId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("thread_messages", { p_thread: threadId });
  return (data ?? []) as ThreadMessage[];
}

export type SearchHit = { kind: "paper" | "venue" | "person" | "review"; id: string; title: string; meta: string | null; href: string | null };
export async function search(q: string): Promise<SearchHit[]> {
  if (q.trim().length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_everything", { p_q: q.trim().slice(0, 120) });
  return (data ?? []) as SearchHit[];
}
