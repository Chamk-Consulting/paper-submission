import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/auth/me";

/* Program data (canvas PG01–PG03, CH01, M05, M07). Times are shown in the event's time zone. */

export type Talk = {
  id: string; position: number; startsAt: string | null; talkMin: number; qaMin: number; number: number | null; submissionId: string | null;
  title: string; abstract: string | null; presenter: string | null; presenterId: string | null; remote: boolean; attendance: string; authors: string | null;
};
export type Session = {
  id: string; code: string; title: string; kind: "keynote" | "oral" | "poster" | "workshop" | "break"; room: string | null; roomId: string | null;
  previousRoom: string | null; startsAt: string; endsAt: string; chair: string | null; cochair: string | null; liveStatus: string; delayMin: number;
  talks: Talk[]; saved: boolean; iChair: boolean; iPresent: boolean;
};
export type ProgramVenue = {
  id: string; slug: string; name: string; shortName: string | null; timezone: string; location: string | null; city: string | null;
  startsOn: string | null; endsOn: string | null; isPublished: boolean;
};

const mapTalk = (t: Record<string, unknown>): Talk => ({
  id: t.id as string, position: Number(t.position ?? 0), startsAt: (t.starts_at as string) ?? null, talkMin: Number(t.talk_min ?? 15), qaMin: Number(t.qa_min ?? 5),
  number: (t.number as number) ?? null, submissionId: (t.submission_id as string) ?? null, title: (t.title as string) ?? "", abstract: (t.abstract as string) ?? null,
  presenter: (t.presenter as string) ?? null, presenterId: (t.presenter_id as string) ?? null, remote: !!t.remote, attendance: (t.attendance as string) ?? "waiting",
  authors: (t.authors as string) ?? null,
});

export async function loadProgram(slug: string): Promise<{ venue: ProgramVenue; sessions: Session[]; signedIn: boolean; published: boolean } | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) return null;
  const supabase = await createClient();
  const { data: v } = await supabase.from("venues").select("id, slug, name, short_name, timezone, location, city, starts_on, ends_on, is_published").eq("slug", slug).maybeSingle();
  if (!v) return null;
  const [{ data: rows }, me, { count }] = await Promise.all([
    supabase.rpc("program", { p_venue: v.id }),
    getMe(),
    supabase.from("program_publications").select("id", { count: "exact", head: true }).eq("venue_id", v.id),
  ]);
  const sessions: Session[] = ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.session_id as string, code: r.code as string, title: r.title as string, kind: r.kind as Session["kind"], room: (r.room as string) ?? null,
    roomId: (r.room_id as string) ?? null, previousRoom: (r.previous_room as string) ?? null, startsAt: r.starts_at as string, endsAt: r.ends_at as string,
    chair: (r.chair as string) ?? null, cochair: (r.cochair as string) ?? null, liveStatus: (r.live_status as string) ?? "scheduled", delayMin: Number(r.delay_min ?? 0),
    talks: ((r.talks as Record<string, unknown>[]) ?? []).map(mapTalk), saved: !!r.in_my_schedule, iChair: !!r.i_chair, iPresent: !!r.i_present,
  }));
  return {
    venue: { id: v.id, slug: v.slug as string, name: v.name as string, shortName: (v.short_name as string) ?? null, timezone: (v.timezone as string) || "UTC",
      location: (v.location as string) ?? null, city: (v.city as string) ?? null, startsOn: (v.starts_on as string) ?? null, endsOn: (v.ends_on as string) ?? null,
      isPublished: !!v.is_published },
    sessions, signedIn: !!me, published: (count ?? 0) > 0,
  };
}

export type RoomFacts = { name: string; level: string | null; seats: number | null; stepFree: boolean; equipment: string | null };
export async function loadRoom(roomId: string | null): Promise<RoomFacts | null> {
  if (!roomId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("rooms").select("name, level, seats, step_free, equipment").eq("id", roomId).maybeSingle();
  return data ? { name: data.name as string, level: (data.level as string) ?? null, seats: (data.seats as number) ?? null, stepFree: !!data.step_free, equipment: (data.equipment as string) ?? null } : null;
}

/* ---------------------------------------------------------------- session chairs */
export type ChairTalk = Talk & { slides: boolean; slidesPath: string | null; bio: string | null; registered: boolean; noshowNote: string | null };
export type ChairSession = {
  id: string; venueId: string; venueName: string; venueShort: string; venueSlug: string; timezone: string; code: string; title: string; kind: string;
  startsAt: string; endsAt: string; liveStatus: string; delayMin: number; liveNote: string | null;
  room: string | null; roomLevel: string | null; roomSeats: number | null; roomEquipment: string | null; roomTechnician: string | null; roomStepFree: boolean;
  chair: string | null; cochair: string | null; iChair: boolean; talks: ChairTalk[];
};
export type ChairListItem = { id: string; timezone: string; venueShort: string; venueSlug: string; code: string; title: string; room: string | null; startsAt: string; endsAt: string; ready: number; total: number };

export async function loadMyChairedSessions(): Promise<ChairListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_chaired_sessions");
  const rows = (data ?? []) as Record<string, unknown>[];
  const ids = [...new Set(rows.map((r) => r.venue_id as string))];
  const { data: vs } = ids.length ? await supabase.from("venues").select("id, timezone").in("id", ids) : { data: [] };
  const tzOf = new Map(((vs ?? []) as { id: string; timezone: string | null }[]).map((v) => [v.id, v.timezone || "UTC"]));
  return rows.map((r) => {
    const talks = ((r.talks as Record<string, unknown>[]) ?? []);
    return {
      id: r.session_id as string, timezone: tzOf.get(r.venue_id as string) ?? "UTC", venueShort: r.venue_short as string, venueSlug: r.venue_slug as string, code: r.code as string, title: r.title as string,
      room: (r.room as string) ?? null, startsAt: r.starts_at as string, endsAt: r.ends_at as string,
      ready: talks.filter((t) => t.registered && t.slides).length, total: talks.length,
    };
  });
}

export async function loadChairSession(id: string): Promise<ChairSession | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("chair_session", { p_session: id });
  const r = ((data ?? []) as Record<string, unknown>[])[0];
  if (!r) return null;
  return {
    id: r.session_id as string, venueId: r.venue_id as string, venueName: r.venue_name as string, venueShort: r.venue_short as string, venueSlug: r.venue_slug as string,
    timezone: (r.timezone as string) || "UTC", code: r.code as string, title: r.title as string, kind: r.kind as string, startsAt: r.starts_at as string, endsAt: r.ends_at as string,
    liveStatus: (r.live_status as string) ?? "scheduled", delayMin: Number(r.delay_min ?? 0), liveNote: (r.live_note as string) ?? null,
    room: (r.room as string) ?? null, roomLevel: (r.room_level as string) ?? null, roomSeats: (r.room_seats as number) ?? null, roomEquipment: (r.room_equipment as string) ?? null,
    roomTechnician: (r.room_technician as string) ?? null, roomStepFree: r.room_step_free !== false, chair: (r.chair as string) ?? null, cochair: (r.cochair as string) ?? null,
    iChair: !!r.i_chair,
    talks: ((r.talks as Record<string, unknown>[]) ?? []).map((t) => ({
      ...mapTalk(t), slides: !!t.slides, slidesPath: (t.slides_path as string) ?? null, bio: (t.bio as string) ?? null, registered: !!t.registered, noshowNote: (t.noshow_note as string) ?? null,
    })),
  };
}

/** Short-lived links to the slides of a chaired session (storage policy papers_select_session_slides). */
export async function slideLinks(talks: ChairTalk[]): Promise<Record<string, string>> {
  const supabase = await createClient();
  const out: Record<string, string> = {};
  await Promise.all(talks.filter((t) => t.slidesPath).map(async (t) => {
    const { data } = await supabase.storage.from("papers").createSignedUrl(t.slidesPath!, 600);
    if (data?.signedUrl) out[t.id] = data.signedUrl;
  }));
  return out;
}
