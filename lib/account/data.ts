import "server-only";
import { createClient } from "@/lib/supabase/server";
import { readMyPerson } from "@/lib/auth/my-person";

/* Reads for the account pages (ST01–ST04, CL01), inbox (IN01) and search (SR01). RLS limits every read to the signed-in person. */

export type Affiliation = { id: string; institution: string; department: string | null; position_title: string | null; country: string | null; starts_on: string | null; ends_on: string | null; ror_id: string | null };
export type NameScript = { lang: string; name: string; latin: string };
const SCRIPT_LANGS = ["ar", "zh-Hans", "zh-Hant", "ja", "ko", "ru", "uk", "el", "he", "hi", "fa", "th", "other"];
export type Conflict = { id: string; other_person: string | null; other_name: string | null; other_plenary_id: string | null; institution: string | null; reason: string; until_year: number | null };
export type Profile = {
  personId: string;
  email: string;
  given_name: string; family_name: string; pronouns: string; plenary_id: string | null; orcid: string | null;
  ieee_member: string; scholar_url: string;
  middle_name: string; name_order: "given_first" | "family_first"; paper_name: string; badge_name: string; name_pronunciation: string;
  name_scripts: NameScript[]; other_names: string[]; former_names: string[];
  orcid_verified: boolean;
  scopus_id: string; researcher_id: string; dblp_url: string; semantic_scholar_id: string; xplore_author_id: string; website_url: string;
  affiliations: Affiliation[];
  topics: string[];
  conflicts: Conflict[];
  review_languages: string[];
  availability: "normal" | "low" | "off"; available_from: string | null;
};

type PersonRow = {
  id: string; given_name: string; family_name: string; pronouns: string | null; plenary_id: string | null; orcid: string | null;
  ieee_member: string | null; scholar_url: string | null; name_scripts: { lang?: string; script?: string; name?: string; latin?: string }[] | null;
  visibility: string | null; timezone: string | null; locale: string | null;
  middle_name?: string | null; name_order?: string | null; paper_name?: string | null; badge_name?: string | null; name_pronunciation?: string | null;
  other_names?: string[] | null; former_names?: string[] | null; orcid_verified_at?: string | null;
  review_languages?: string[] | null; availability?: string | null; available_from?: string | null;
  scopus_id?: string | null; researcher_id?: string | null; dblp_url?: string | null; semantic_scholar_id?: string | null; xplore_author_id?: string | null; website_url?: string | null;
};

async function me() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const person = await readMyPerson(supabase, auth.user.id);
  if (!person) return null;
  return { supabase, user: auth.user, person: person as PersonRow };
}

export async function getProfile(): Promise<Profile | null> {
  const m = await me();
  if (!m) return null;
  const { supabase, user, person } = m;
  const [{ data: affs }, { data: topics }, { data: conflicts }] = await Promise.all([
    supabase.from("affiliations").select("id, institution, department, position_title, country, starts_on, ends_on, ror_id").eq("person_id", person.id).order("ends_on", { ascending: false, nullsFirst: true }).order("starts_on", { ascending: false }),
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
    middle_name: person.middle_name ?? "",
    name_order: person.name_order === "family_first" ? "family_first" : "given_first",
    paper_name: person.paper_name ?? "",
    badge_name: person.badge_name ?? "",
    name_pronunciation: person.name_pronunciation ?? "",
    // older rows stored {script:"other", name}; newer {lang, name, latin}
    name_scripts: (person.name_scripts ?? []).filter((x) => x && x.name).map((x) => {
      const l = x.lang ?? x.script ?? "other";
      return { lang: SCRIPT_LANGS.includes(l) ? l : l === "zh" ? "zh-Hans" : "other", name: x.name ?? "", latin: x.latin ?? "" };
    }),
    other_names: person.other_names ?? [],
    former_names: person.former_names ?? [],
    orcid_verified: !!person.orcid_verified_at,
    scopus_id: person.scopus_id ?? "",
    researcher_id: person.researcher_id ?? "",
    dblp_url: person.dblp_url ?? "",
    semantic_scholar_id: person.semantic_scholar_id ?? "",
    xplore_author_id: person.xplore_author_id ?? "",
    website_url: person.website_url ?? "",
    affiliations: (affs ?? []) as Affiliation[],
    topics: ((topics ?? []) as { topic: string }[]).map((x) => x.topic),
    conflicts: (conflicts ?? []) as Conflict[],
    review_languages: person.review_languages ?? [],
    availability: person.availability === "low" || person.availability === "off" ? person.availability : "normal",
    available_from: person.available_from ?? null,
  };
}

/** Topic suggestions for the Reviewing tab: the keyword lists of the events you take part in, else the default list. */
export async function getTopicSuggestions(): Promise<{ group: string; keywords: string[] }[]> {
  const m = await me();
  if (!m) return [];
  const { data } = await m.supabase.from("venue_members").select("venues(short_name, name, details)").eq("person_id", m.person.id);
  type V = { short_name: string | null; name: string; details: { keyword_groups?: { group: string; keywords: string[] }[] } | null };
  const seen = new Set<string>();
  const out: { group: string; keywords: string[] }[] = [];
  for (const row of (data ?? []) as unknown as { venues: V | V[] | null }[]) {
    const v = Array.isArray(row.venues) ? row.venues[0] : row.venues;
    if (!v || seen.has(v.name)) continue;
    seen.add(v.name);
    const kws = [...new Set((v.details?.keyword_groups ?? []).flatMap((g) => g.keywords))];
    if (kws.length) out.push({ group: v.short_name ?? v.name, keywords: kws });
  }
  if (out.length) return out;
  const { DEFAULT_KEYWORDS } = await import("@/lib/submission/steps");
  return DEFAULT_KEYWORDS.map((g) => ({ group: g.group, keywords: [...g.keywords] }));
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

export const notifyEvents = ["coauthor_request", "coauthor_changes", "paper_steps", "review_invitation", "review_due", "venue_announcements", "program_changes", "new_calls", "messages"] as const;
export type NotifyEvent = (typeof notifyEvents)[number];
export type NotifyMode = "now" | "digest" | "off";
export type Reminders = { d7: boolean; d3: boolean; h24: boolean; papers: boolean; reviews: boolean; followed: boolean };
export type Prefs = { modes: Record<NotifyEvent, NotifyMode>; reminders: Reminders; email: string; hasFeed: boolean };
const defaultModes: Prefs["modes"] = {
  coauthor_request: "now", coauthor_changes: "digest", paper_steps: "now", review_invitation: "now", review_due: "now",
  venue_announcements: "digest", program_changes: "now", new_calls: "digest", messages: "now",
};
const MODES: readonly NotifyMode[] = ["now", "digest", "off"];

export async function getPrefs(): Promise<Prefs | null> {
  const m = await me();
  if (!m) return null;
  const [{ data }, { data: feed }] = await Promise.all([
    m.supabase.from("notification_prefs").select("modes, reminders").eq("person_id", m.person.id).maybeSingle(),
    m.supabase.rpc("my_calendar_feed"),
  ]);
  const saved = (data?.modes ?? {}) as Record<string, unknown>;
  const modes = Object.fromEntries(notifyEvents.map((k) => [k, MODES.includes(saved[k] as NotifyMode) ? saved[k] : defaultModes[k]])) as Prefs["modes"];
  const reminders = { d7: true, d3: true, h24: true, papers: true, reviews: true, followed: false, ...((data?.reminders ?? {}) as Partial<Reminders>) };
  return { modes, reminders, email: m.user.email ?? "", hasFeed: ((feed ?? []) as unknown[]).length > 0 };
}

/** Settings › Preferences: language, time zone and the display/workspace choices. */
export async function getPreferences() {
  const m = await me();
  if (!m) return null;
  const { parseUi } = await import("@/lib/account/ui-prefs");
  return { locale: m.person.locale ?? "", timezone: m.person.timezone ?? "", ui: parseUi((m.person as { ui_prefs?: unknown }).ui_prefs) };
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
