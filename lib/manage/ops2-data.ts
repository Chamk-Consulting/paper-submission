import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session, Talk } from "@/components/manage/ops2/program-builder";

/* Shared loaders for the program builder, its print view and the event-day screen. */

type RawTalk = Omit<Talk, "presenter" | "number" | "title"> & { title: string | null; submissions: { number: number; title: string } | null; presenter: { display_name: string } | null };
type RawSession = Omit<Session, "talks" | "chair"> & { chair: { display_name: string } | null; session_talks: RawTalk[] };

export async function loadSessions(venueId: string): Promise<Session[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("sessions")
    .select("id, code, title, kind, room_id, starts_at, ends_at, chair_id, cochair_id, live_status, delay_min, live_note, chair:persons!sessions_chair_id_fkey(display_name), session_talks(id, submission_id, position, starts_at, talk_min, qa_min, presenter_id, title, attendance, noshow_note, noshow_decision, submissions(number, title), presenter:persons!session_talks_presenter_id_fkey(display_name))")
    .eq("venue_id", venueId).order("starts_at").order("code");
  return ((data ?? []) as unknown as RawSession[]).map(({ session_talks, chair, ...s }) => ({
    ...s, chair: chair?.display_name ?? null,
    talks: [...session_talks].sort((a, b) => a.position - b.position).map(({ submissions, presenter, ...x }) => ({
      ...x, number: submissions?.number ?? null, title: x.title ?? submissions?.title ?? null, presenter: presenter?.display_name ?? null,
    })),
  }));
}

export async function loadRooms(venueId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("rooms").select("id, name, seats").eq("venue_id", venueId).order("sort").order("name");
  return (data ?? []) as { id: string; name: string; seats: number | null }[];
}
