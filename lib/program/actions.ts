"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* Program + session-chair actions (PG01–PG03, CH01, M05). The database functions do the permission checks. */

export type ProgramState = { error?: string; ok?: boolean; info?: string };
const uuid = z.guid();

const friendly = (msg?: string) => {
  if (!msg) return "Something went wrong. Please try again.";
  if (/sign in first/i.test(msg)) return "Sign in to keep a schedule.";
  if (/not your session|permission|42501/i.test(msg)) return "Only the session’s chairs can do this.";
  if (/no presenters/i.test(msg)) return "No presenters in this session yet.";
  return msg.replace(/^.*?ERROR:\s*/, "").slice(0, 200);
};

export async function toggleSchedule(sessionId: string): Promise<{ saved?: boolean; error?: string; signin?: boolean }> {
  if (!uuid.safeParse(sessionId).success) return { error: "Bad request." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { signin: true };
  const { data, error } = await supabase.rpc("toggle_schedule", { p_session: sessionId });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/[lang]/program/[slug]", "layout");
  return { saved: !!data };
}

const ATT = z.enum(["waiting", "checked_in", "speaking", "presented", "no_show"]);
export async function setAttendance(talkId: string, attendance: string, note?: string): Promise<ProgramState> {
  const a = ATT.safeParse(attendance);
  if (!uuid.safeParse(talkId).success || !a.success) return { error: "Bad request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_talk_attendance", { p_talk: talkId, p_attendance: a.data, p_note: note?.trim().slice(0, 1000) || null });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/[lang]/chair", "layout");
  return { ok: true };
}

const LIVE = z.enum(["scheduled", "on_time", "late", "break", "open", "done"]);
export async function updateLive(sessionId: string, status: string, delay: number, note?: string): Promise<ProgramState> {
  const s = LIVE.safeParse(status);
  if (!uuid.safeParse(sessionId).success || !s.success || !Number.isFinite(delay) || delay < 0 || delay > 180) return { error: "Bad request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("chair_update", { p_session: sessionId, p_live_status: s.data, p_delay: Math.round(delay), p_note: note?.trim().slice(0, 300) || null });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/[lang]/chair", "layout");
  return { ok: true };
}

const msgSchema = z.object({
  sessionId: z.guid(),
  subject: z.string().trim().min(2, "Write a subject.").max(200),
  body: z.string().trim().min(2, "Write a message.").max(8000),
});
export async function messagePresenters(_: ProgramState, fd: FormData): Promise<ProgramState> {
  const p = msgSchema.safeParse({ sessionId: fd.get("sessionId"), subject: fd.get("subject"), body: fd.get("body") });
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("message_session_presenters", { p_session: p.data.sessionId, p_subject: p.data.subject, p_body: p.data.body });
  if (error) return { error: friendly(error.message) };
  return { ok: true, info: "Sent to every presenter’s Plenary inbox." };
}

const noShowSchema = z.object({ talkId: z.guid(), note: z.string().trim().max(1000).optional() });
export async function reportNoShow(_: ProgramState, fd: FormData): Promise<ProgramState> {
  const p = noShowSchema.safeParse({ talkId: fd.get("talkId"), note: fd.get("note") || undefined });
  if (!p.success) return { error: "Pick the talk." };
  const r = await setAttendance(p.data.talkId, "no_show", p.data.note);
  return r.error ? r : { ok: true, info: "Reported to the program chair." };
}
