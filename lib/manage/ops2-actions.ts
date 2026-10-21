"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEvent, type EventCtx } from "@/lib/manage/data";
import { friendlyDb, type ManageState } from "@/lib/manage/actions-util";
import { absUrl, renderTemplate, sendMany, type Mail } from "@/lib/email/send";
import { unsubscribeUrls } from "@/lib/email/unsubscribe";
import { addMinutes, paperNo, zonedToUtc } from "@/lib/manage/ops2-time";

/* Organizer operations, part 2: EM28 finals, registrations, EM29 program, EM31 event day, EM32 proceedings, EM41 email centre. */

export type Ops2State = ManageState & { campaignId?: string; count?: number; sentTo?: number; scheduled?: boolean };

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);
const uuid = z.guid();
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const fieldErrors = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));

async function load(fd: FormData, allow: "organizer" | "chair" = "organizer") {
  const slug = s(fd, "slug");
  if (!slugSchema.safeParse(slug).success) throw new Error("Bad request.");
  const ctx = await requireEvent(slug, allow);
  return { slug, ctx, supabase: await createClient(), venueId: ctx.venue.id, me: ctx.ws.me.person?.id ?? null };
}
const done = (slug: string, sub: string) => revalidatePath(`/[lang]/manage/${slug}/${sub}`, "page");
async function guard<T extends ManageState>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect / notFound from requireEvent
    return { error: e instanceof Error ? friendlyDb(e.message) : friendlyDb() } as T;
  }
}

type Person = { person_id: string; email: string | null; given_name: string | null; display_name: string | null };
async function peopleEmails(supabase: Awaited<ReturnType<typeof createClient>>, venueId: string, ids: string[]): Promise<Map<string, Person>> {
  const out = new Map<string, Person>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await supabase.rpc("people_emails", { p_venue: venueId, p_people: ids.slice(i, i + 500) });
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as Person[]) out.set(p.person_id, p);
  }
  return out;
}
const firstName = (p?: Person) => p?.given_name || p?.display_name?.split(" ")[0] || "";

async function finalsDeadline(supabase: Awaited<ReturnType<typeof createClient>>, ctx: EventCtx): Promise<string> {
  const { data } = await supabase.from("venue_dates").select("starts_at").eq("venue_id", ctx.venue.id).eq("key", "finals").maybeSingle();
  if (!data?.starts_at) return "";
  return new Date(data.starts_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: ctx.venue.timezone });
}

/** Run promises a few at a time. */
async function pool<T>(items: T[], n: number, fn: (x: T) => PromiseLike<unknown>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

/* ================================================================ EM28 — final versions */

type FinalRow = { submission_id: string; number: number; title: string; status: string; missing: string[]; corresponding: string[] };

export async function chaseIncomplete(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, ctx, supabase, venueId } = await load(fd);
    const { data, error } = await supabase.rpc("finals_overview", { p_venue: venueId });
    if (error) return { error: friendlyDb(error.message) };
    const rows = ((data ?? []) as FinalRow[]).filter((r) => (r.status === "in_progress" || r.status === "incomplete") && r.missing.length && r.corresponding.length);
    if (!rows.length) return { info: "Nothing to chase — every paper is complete or has no corresponding author." };
    const { data: tpls } = await supabase.from("email_templates").select("venue_id, subject, body").eq("key", "final_reminder").or(`venue_id.eq.${venueId},venue_id.is.null`);
    const tpl = ((tpls ?? []) as { venue_id: string | null; subject: string; body: string }[]).sort((a, b) => (a.venue_id ? -1 : 0) - (b.venue_id ? -1 : 0))[0];
    if (!tpl) return { error: "The final-version reminder template is missing — add it in Setup → Emails." };
    const deadline = await finalsDeadline(supabase, ctx);
    const people = await peopleEmails(supabase, venueId, [...new Set(rows.flatMap((r) => r.corresponding))]);
    const mails: Mail[] = [];
    const inbox: { people: string[]; subject: string; body: string; sub: string }[] = [];
    const missingVars = new Set<string>();
    for (const r of rows) {
      for (const pid of r.corresponding) {
        const p = people.get(pid);
        const vars = { "author.first": firstName(p), "paper.id": paperNo(r.number), "paper.title": r.title, "missing.items": r.missing.join(", "), deadline, "venue.short": ctx.label, link: absUrl(`/submissions/${r.submission_id}`) };
        const subj = renderTemplate(tpl.subject, vars), body = renderTemplate(tpl.body, vars);
        [...subj.missing, ...body.missing].forEach((m) => missingVars.add(m));
        inbox.push({ people: [pid], subject: subj.text, body: body.text, sub: r.submission_id });
        if (p?.email) mails.push({ to: p.email, subject: subj.text, text: body.text, replyTo: ctx.venue.contact_email ?? undefined });
      }
    }
    if (missingVars.size) return { error: `Not sent: some values are missing (${[...missingVars].map((m) => `[${m}]`).join(", ")}). Set the finals deadline in Setup → Dates, or edit the template.` };
    const res = await sendMany(mails);
    await pool(inbox, 4, (m) => supabase.rpc("notify_people", { p_venue: venueId, p_people: m.people, p_kind: "venue", p_subject: m.subject, p_body: m.body, p_submission: m.sub, p_cta_label: "Open final version", p_cta_url: `/submissions/${m.sub}` }));
    done(slug, "finals");
    return { ok: true, count: rows.length, info: res.skipped ? "Email is not configured yet — the reminders went to their Plenary inbox only." : undefined };
  });
}

export async function finalAdminAction(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase } = await load(fd);
    const p = z.object({ submission: uuid, action: z.enum(["copyright_signed", "drop", "undrop", "unlock"]) }).safeParse({ submission: s(fd, "submission"), action: s(fd, "action") });
    if (!p.success) return { error: "Bad request." };
    const { error } = await supabase.rpc("final_admin", { p_submission: p.data.submission, p_action: p.data.action });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "finals");
    return { ok: true };
  });
}

/* ================================================================ Registrations */

const regSchema = z.object({
  id: z.guid().optional().or(z.literal("")),
  number: z.string().trim().min(1, "Enter a registration number.").max(40),
  reg_type: z.string().trim().min(1, "Choose a registration type.").max(80),
  full_name: z.string().trim().min(2, "Enter the person’s name.").max(200),
  email: z.string().trim().max(254).refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email address"),
  affiliation: z.string().trim().max(200),
  covers_papers: z.coerce.number().int().min(0).max(4),
  paid: z.boolean(),
});

async function paperIdsByNumber(supabase: Awaited<ReturnType<typeof createClient>>, venueId: string, numbers: number[]) {
  if (!numbers.length) return new Map<number, string>();
  const { data } = await supabase.from("submissions").select("id, number").eq("venue_id", venueId).in("number", numbers);
  return new Map(((data ?? []) as { id: string; number: number }[]).map((x) => [x.number, x.id]));
}
const parseNumbers = (v: string) => [...new Set(v.split(/[\s,;]+/).map((x) => parseInt(x.replace(/^#/, ""), 10)).filter((n) => Number.isFinite(n) && n > 0))];

export async function saveRegistration(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase, venueId } = await load(fd);
    const p = regSchema.safeParse({ id: s(fd, "id"), number: s(fd, "number"), reg_type: s(fd, "reg_type"), full_name: s(fd, "full_name"), email: s(fd, "email"), affiliation: s(fd, "affiliation"), covers_papers: s(fd, "covers_papers") || "1", paid: fd.get("paid") === "on" });
    if (!p.success) return { fieldErrors: fieldErrors(p.error) };
    const v = p.data;
    const row = { venue_id: venueId, number: v.number, reg_type: v.reg_type, full_name: v.full_name, email: v.email || null, affiliation: v.affiliation || null, covers_papers: v.covers_papers };
    const q = v.id
      ? supabase.from("registrations").update({ ...row, ...(v.paid ? {} : { paid_at: null }) }).eq("id", v.id).eq("venue_id", venueId).select("id, paid_at").single()
      : supabase.from("registrations").insert({ ...row, source: "manual" }).select("id, paid_at").single();
    const { data, error } = await q;
    if (error) return { error: friendlyDb(error.message) };
    if (v.paid && !data.paid_at) await supabase.from("registrations").update({ paid_at: new Date().toISOString() }).eq("id", data.id);
    const nums = parseNumbers(s(fd, "papers"));
    if (nums.length) {
      const ids = await paperIdsByNumber(supabase, venueId, nums);
      const unknown = nums.filter((n) => !ids.has(n));
      if (ids.size) await supabase.from("registration_papers").upsert([...ids.values()].map((sid) => ({ registration_id: data.id, submission_id: sid })), { onConflict: "registration_id,submission_id", ignoreDuplicates: true });
      if (unknown.length) { done(slug, "registrations"); return { ok: true, info: `Saved. Unknown paper numbers: ${unknown.map((n) => paperNo(n)).join(", ")}` }; }
    }
    done(slug, "registrations");
    return { ok: true, savedAt: new Date().toISOString() };
  });
}

export async function deleteRegistration(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase, venueId } = await load(fd);
    const id = uuid.safeParse(s(fd, "id"));
    if (!id.success) return { error: "Bad request." };
    const { error } = await supabase.from("registrations").delete().eq("id", id.data).eq("venue_id", venueId);
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "registrations");
    return { ok: true };
  });
}

export async function unlinkPaper(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase } = await load(fd);
    const p = z.object({ reg: uuid, sub: uuid }).safeParse({ reg: s(fd, "reg"), sub: s(fd, "sub") });
    if (!p.success) return { error: "Bad request." };
    const { error } = await supabase.from("registration_papers").delete().eq("registration_id", p.data.reg).eq("submission_id", p.data.sub);
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "registrations");
    return { ok: true };
  });
}

/** Split one CSV line (quotes allowed). */
function csvLine(line: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === "," || c === ";" || c === "\t") { out.push(cur.trim()); cur = ""; } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

export async function importRegistrations(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase, venueId } = await load(fd);
    const file = fd.get("file");
    let text = s(fd, "csv");
    if (file instanceof File && file.size) {
      if (file.size > 2_000_000) return { error: "The file is over 2 MB." };
      text = await file.text();
    }
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { error: "Paste or upload a CSV with a header row and at least one registration." };
    const head = csvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
    const ix = { number: col("number", "registration", "regno", "id"), name: col("name", "fullname"), email: col("email", "mail"), aff: col("affiliation", "institution", "organisation", "organization"), type: col("type", "regtype", "category"), papers: col("papers", "paper", "paperids"), paid: col("paid", "paidat") };
    if (ix.number < 0 || ix.name < 0) return { error: "The header row needs at least “number” and “name” columns." };
    const rows = lines.slice(1).map(csvLine).filter((c) => c[ix.number]).slice(0, 5000);
    const allNums = [...new Set(rows.flatMap((c) => (ix.papers >= 0 ? parseNumbers(c[ix.papers] ?? "") : [])))];
    const papers = await paperIdsByNumber(supabase, venueId, allNums);
    const now = new Date().toISOString();
    const recs = rows.map((c) => ({
      venue_id: venueId, number: c[ix.number].slice(0, 40), full_name: c[ix.name]?.slice(0, 200) || null,
      email: ix.email >= 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c[ix.email] ?? "") ? c[ix.email] : null,
      affiliation: ix.aff >= 0 ? c[ix.aff]?.slice(0, 200) || null : null, reg_type: (ix.type >= 0 && c[ix.type]?.slice(0, 80)) || "Full",
      paid_at: ix.paid >= 0 && /^(y|yes|1|true|paid|\d{4}-)/i.test(c[ix.paid] ?? "") ? now : null, source: "import" as const,
    }));
    const { data, error } = await supabase.from("registrations").upsert(recs, { onConflict: "venue_id,number" }).select("id, number");
    if (error) return { error: friendlyDb(error.message) };
    const idByNo = new Map(((data ?? []) as { id: string; number: string }[]).map((x) => [x.number, x.id]));
    const links = rows.flatMap((c) => (ix.papers >= 0 ? parseNumbers(c[ix.papers] ?? "") : []).filter((n) => papers.has(n)).map((n) => ({ registration_id: idByNo.get(c[ix.number].slice(0, 40))!, submission_id: papers.get(n)! }))).filter((l) => l.registration_id);
    if (links.length) await supabase.from("registration_papers").upsert(links, { onConflict: "registration_id,submission_id", ignoreDuplicates: true });
    const unknown = allNums.filter((n) => !papers.has(n));
    done(slug, "registrations");
    return { ok: true, count: recs.length, info: unknown.length ? `Unknown paper numbers skipped: ${unknown.slice(0, 12).map((n) => paperNo(n)).join(", ")}` : undefined };
  });
}

/* ================================================================ EM29 — program builder */

const sessionSchema = z.object({
  code: z.string().trim().min(1, "Enter a code, e.g. TuA1.").max(20),
  title: z.string().trim().min(1, "Enter a session name.").max(200),
  kind: z.enum(["keynote", "oral", "poster", "workshop", "break"]),
  room: z.guid().optional().or(z.literal("")),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a day."),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Enter a start time."),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Enter an end time."),
  chair: z.guid().optional().or(z.literal("")),
  cochair: z.guid().optional().or(z.literal("")),
}).refine((v) => v.end > v.start, { message: "The session must end after it starts.", path: ["end"] });

export async function saveSession(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, ctx, supabase, venueId } = await load(fd, "chair");
    const p = sessionSchema.safeParse(Object.fromEntries(["code", "title", "kind", "room", "day", "start", "end", "chair", "cochair"].map((k) => [k, s(fd, k)])));
    if (!p.success) return { fieldErrors: fieldErrors(p.error) };
    const v = p.data, tz = ctx.venue.timezone;
    const row = { venue_id: venueId, code: v.code, title: v.title, kind: v.kind, room_id: v.room || null, starts_at: zonedToUtc(v.day, v.start, tz), ends_at: zonedToUtc(v.day, v.end, tz), chair_id: v.chair || null, cochair_id: v.cochair || null };
    const id = s(fd, "id");
    if (id && !uuid.safeParse(id).success) return { error: "Bad request." };
    if (id) {
      const { data: prev } = await supabase.from("sessions").select("room_id").eq("id", id).single();
      const moved = prev && prev.room_id && prev.room_id !== row.room_id ? { previous_room_id: prev.room_id } : {};
      const { error } = await supabase.from("sessions").update({ ...row, ...moved }).eq("id", id).eq("venue_id", venueId);
      if (error) return { error: friendlyDb(error.message) };
      await retime(supabase, id);
    } else {
      const { error } = await supabase.from("sessions").insert(row);
      if (error) return { error: friendlyDb(error.message) };
    }
    done(slug, "program");
    return { ok: true, savedAt: new Date().toISOString() };
  });
}

export async function deleteSession(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase, venueId } = await load(fd, "chair");
    const id = uuid.safeParse(s(fd, "id"));
    if (!id.success) return { error: "Bad request." };
    const { error } = await supabase.from("sessions").delete().eq("id", id.data).eq("venue_id", venueId);
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "program");
    return { ok: true };
  });
}

/** Lay talks out back to back from the session start. */
async function retime(supabase: Awaited<ReturnType<typeof createClient>>, sessionId: string) {
  const { data: se } = await supabase.from("sessions").select("starts_at").eq("id", sessionId).single();
  const { data: talks } = await supabase.from("session_talks").select("id, talk_min, qa_min").eq("session_id", sessionId).order("position");
  if (!se) return;
  let at = se.starts_at as string;
  for (const [i, t] of ((talks ?? []) as { id: string; talk_min: number; qa_min: number }[]).entries()) {
    await supabase.from("session_talks").update({ position: i + 1, starts_at: at }).eq("id", t.id);
    at = addMinutes(at, t.talk_min + t.qa_min);
  }
}

export async function placeTalk(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, ctx, supabase } = await load(fd, "chair");
    const p = z.object({ session: uuid, submission: uuid, presenter: z.guid().optional().or(z.literal("")) }).safeParse({ session: s(fd, "session"), submission: s(fd, "submission"), presenter: s(fd, "presenter") });
    if (!p.success) return { error: "Bad request." };
    const { data: last } = await supabase.from("session_talks").select("position").eq("session_id", p.data.session).order("position", { ascending: false }).limit(1).maybeSingle();
    const mins = Number(ctx.settings?.minutes_per_paper ?? 20);
    const qa = Math.max(3, Math.round(mins / 4));
    const { data: sub } = await supabase.from("submissions").select("title").eq("id", p.data.submission).single();
    const { error } = await supabase.from("session_talks").insert({ session_id: p.data.session, submission_id: p.data.submission, title: sub?.title ?? null, position: (last?.position ?? 0) + 1, talk_min: mins - qa, qa_min: qa, presenter_id: p.data.presenter || null });
    if (error) return { error: /duplicate|23505/.test(error.message) ? "That paper is already placed in a session." : friendlyDb(error.message) };
    await retime(supabase, p.data.session);
    done(slug, "program");
    return { ok: true };
  });
}

export async function unplaceTalk(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase } = await load(fd, "chair");
    const id = uuid.safeParse(s(fd, "talk"));
    if (!id.success) return { error: "Bad request." };
    const { data: t } = await supabase.from("session_talks").select("session_id").eq("id", id.data).single();
    const { error } = await supabase.from("session_talks").delete().eq("id", id.data);
    if (error) return { error: friendlyDb(error.message) };
    if (t) await retime(supabase, t.session_id as string);
    done(slug, "program");
    return { ok: true };
  });
}

export async function publishProgram(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase, venueId } = await load(fd, "chair");
    const { data: clashes } = await supabase.rpc("program_clashes", { p_venue: venueId });
    if ((clashes ?? []).length) return { error: "Resolve the clashes before publishing." };
    const { data, error } = await supabase.rpc("publish_program", { p_venue: venueId });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "program");
    return { ok: true, count: Number(data ?? 0) };
  });
}

/* ================================================================ EM31 — event day */

export async function checkIn(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase } = await load(fd);
    const id = uuid.safeParse(s(fd, "id"));
    if (!id.success) return { error: "Bad request." };
    const { error } = await supabase.rpc("check_in", { p_registration: id.data });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "live");
    return { ok: true };
  });
}

export async function registerAtDesk(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase, venueId } = await load(fd);
    const p = z.object({ full_name: z.string().trim().min(2, "Enter the person’s name.").max(200), email: z.string().trim().max(254), reg_type: z.string().trim().min(1).max(80) })
      .safeParse({ full_name: s(fd, "full_name"), email: s(fd, "email"), reg_type: s(fd, "reg_type") || "Full" });
    if (!p.success) return { fieldErrors: fieldErrors(p.error) };
    const { count } = await supabase.from("registrations").select("id", { count: "exact", head: true }).eq("venue_id", venueId).eq("source", "desk");
    const number = `D-${String((count ?? 0) + 1).padStart(4, "0")}`;
    const { data, error } = await supabase.from("registrations").insert({ venue_id: venueId, number, full_name: p.data.full_name, email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.data.email) ? p.data.email : null, reg_type: p.data.reg_type, source: "desk", covers_papers: 0, paid_at: new Date().toISOString() }).select("id").single();
    if (error) return { error: friendlyDb(error.message) };
    await supabase.rpc("check_in", { p_registration: data.id });
    done(slug, "live");
    return { ok: true, info: number };
  });
}

export async function setRoomStatus(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase, venueId } = await load(fd, "chair");
    const p = z.object({ id: uuid, live_status: z.enum(["scheduled", "on_time", "late", "break", "open", "done"]), delay_min: z.coerce.number().int().min(0).max(240), live_note: z.string().trim().max(300) })
      .safeParse({ id: s(fd, "id"), live_status: s(fd, "live_status"), delay_min: s(fd, "delay_min") || "0", live_note: s(fd, "live_note") });
    if (!p.success) return { error: "Bad request." };
    const { error } = await supabase.from("sessions").update({ live_status: p.data.live_status, delay_min: p.data.live_status === "late" ? p.data.delay_min : 0, live_note: p.data.live_note || null }).eq("id", p.data.id).eq("venue_id", venueId);
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "live");
    return { ok: true };
  });
}

export async function setAttendance(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase, me } = await load(fd, "chair");
    const p = z.object({ talk: uuid, attendance: z.enum(["waiting", "checked_in", "speaking", "presented", "no_show"]), note: z.string().trim().max(1000) })
      .safeParse({ talk: s(fd, "talk"), attendance: s(fd, "attendance"), note: s(fd, "note") });
    if (!p.success) return { error: "Bad request." };
    const noShow = p.data.attendance === "no_show";
    const { error } = await supabase.from("session_talks").update({ attendance: p.data.attendance, noshow_note: noShow ? p.data.note || null : null, noshow_reported_by: noShow ? me : null }).eq("id", p.data.talk);
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "live"); done(slug, "proceedings");
    return { ok: true };
  });
}

export async function sendAnnouncement(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, ctx, supabase, venueId, me } = await load(fd);
    const p = z.object({ title: z.string().trim().min(2, "Add a short title.").max(200), body: z.string().trim().min(2, "Write the announcement.").max(5000), session: z.guid().optional().or(z.literal("")) })
      .safeParse({ title: s(fd, "title"), body: s(fd, "body"), session: s(fd, "session") });
    if (!p.success) return { fieldErrors: fieldErrors(p.error) };
    const { data: aud, error: e1 } = await supabase.rpc("announcement_audience", { p_venue: venueId, p_session: p.data.session || null });
    if (e1) return { error: friendlyDb(e1.message) };
    const people = ((aud ?? []) as { person_id: string }[]).map((x) => x.person_id);
    const { error } = await supabase.from("announcements").insert({ venue_id: venueId, title: p.data.title, body: p.data.body, channels: ["push", "inbox"], author_role: ctx.roleLabel, affected: people.length, created_by: me });
    if (error) return { error: friendlyDb(error.message) };
    for (let i = 0; i < people.length; i += 1000) {
      const { error: e2 } = await supabase.rpc("notify_people", { p_venue: venueId, p_people: people.slice(i, i + 1000), p_kind: "venue", p_subject: p.data.title, p_body: p.data.body, p_cta_label: "Open program", p_cta_url: `/venues/${slug}/program` });
      if (e2) return { error: friendlyDb(e2.message) };
    }
    done(slug, "live");
    return { ok: true, count: people.length };
  });
}

/* ================================================================ EM32 — proceedings */

const STEP_KEYS = ["confirmed", "noshows", "metadata", "exported"] as const;

export async function setNoshowDecision(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase } = await load(fd);
    const p = z.object({ submission: uuid, decision: z.enum(["keep", "leave_out", ""]) }).safeParse({ submission: s(fd, "submission"), decision: s(fd, "decision") });
    if (!p.success) return { error: "Bad request." };
    const { error } = await supabase.from("session_talks").update({ noshow_decision: p.data.decision || null }).eq("submission_id", p.data.submission).select("id").single();
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "proceedings");
    return { ok: true };
  });
}

export async function markProceedingsStep(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase, venueId } = await load(fd);
    const step = z.enum(STEP_KEYS).safeParse(s(fd, "step"));
    if (!step.success) return { error: "Bad request." };
    if (step.data === "confirmed") {
      // Every placed talk not reported as a no-show counts as presented.
      const { data: ses } = await supabase.from("sessions").select("id").eq("venue_id", venueId);
      const ids = ((ses ?? []) as { id: string }[]).map((x) => x.id);
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await supabase.from("session_talks").update({ attendance: "presented" }).in("session_id", ids.slice(i, i + 200)).in("attendance", ["waiting", "checked_in", "speaking"]).not("submission_id", "is", null);
        if (error) return { error: friendlyDb(error.message) };
      }
    }
    if (step.data === "noshows") {
      const { data } = await supabase.rpc("proceedings_papers", { p_venue: venueId });
      const open = ((data ?? []) as { attendance: string | null; noshow_decision: string | null }[]).filter((r) => r.attendance === "no_show" && !r.noshow_decision).length;
      if (open) return { error: `Decide on ${open} no-show paper(s) first.` };
    }
    if (step.data === "metadata") {
      const { data } = await supabase.rpc("proceedings_papers", { p_venue: venueId });
      const bad = ((data ?? []) as { number: number; locked: boolean; authors: unknown[] }[]).filter((r) => !r.locked || !r.authors.length);
      if (bad.length) return { error: `Not ready: ${bad.slice(0, 8).map((r) => paperNo(r.number)).join(", ")} ${bad.length > 8 ? "…" : ""} have no locked title and authors (G2).` };
    }
    const { data: cur } = await supabase.from("proceedings_exports").select("steps").eq("venue_id", venueId).maybeSingle();
    const steps = { ...((cur?.steps as Record<string, string>) ?? {}), [step.data]: new Date().toISOString() };
    const { error } = await supabase.from("proceedings_exports").upsert({ venue_id: venueId, steps, ...(step.data === "exported" ? { exported_at: new Date().toISOString() } : {}) }, { onConflict: "venue_id" });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "proceedings");
    return { ok: true };
  });
}

export async function archiveEvent(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, supabase, venueId } = await load(fd, "chair");
    if (s(fd, "confirm") !== "archive") return { error: "Type “archive” to confirm." };
    const { error } = await supabase.rpc("archive_event", { p_venue: venueId });
    if (error) return { error: friendlyDb(error.message) };
    done(slug, "proceedings");
    return { ok: true };
  });
}

/* ================================================================ EM41 — email centre */

const ROLES = ["authors", "reviewers", "aes", "session_chairs", "committee"] as const;
const CONDS = ["acc", "inc", "late", "unsub"] as const;
type Aud = { person_id: string; submission_id: string | null; paper_number: number | null; paper_title: string | null; missing: string | null };

const pickList = <T extends string>(fd: FormData, k: string, allowed: readonly T[]) => fd.getAll(k).map(String).filter((x): x is T => (allowed as readonly string[]).includes(x));

async function audience(supabase: Awaited<ReturnType<typeof createClient>>, venueId: string, roles: string[], conds: string[]): Promise<Aud[]> {
  if (!roles.length) return [];
  const { data, error } = await supabase.rpc("campaign_audience", { p_venue: venueId, p_roles: roles, p_conditions: conds });
  if (error) throw new Error(error.message);
  return (data ?? []) as Aud[];
}

/** Live recipient count for the "Who gets it" step (deduplicated in SQL). */
export async function audienceCount(slug: string, roles: string[], conds: string[]): Promise<number> {
  if (!slugSchema.safeParse(slug).success) return 0;
  const ctx = await requireEvent(slug, "chair");
  const supabase = await createClient();
  const r = roles.filter((x) => (ROLES as readonly string[]).includes(x)), c = conds.filter((x) => (CONDS as readonly string[]).includes(x));
  return (await audience(supabase, ctx.venue.id, r, c)).length;
}

function varsFor(ctx: EventCtx, a: Aud | undefined, p: Person | undefined, deadline: string): Record<string, string> {
  return {
    "author.first": firstName(p), "person.first": firstName(p), "paper.id": a?.paper_number ? paperNo(a.paper_number) : "", "paper.title": a?.paper_title ?? "",
    "missing.items": a?.missing ?? "", deadline, "venue.short": ctx.label, "venue.name": ctx.venue.name,
    link: absUrl(a?.submission_id ? `/submissions/${a.submission_id}` : "/workspace"),
  };
}

const msgSchema = z.object({ subject: z.string().trim().min(3, "Write a subject (3+ characters).").max(200), body: z.string().trim().min(10, "Write the message (10+ characters).").max(20000) });

/** Save (or refresh) the draft and send one rendered copy to me. Required before sending (I3). */
export async function sendTestCampaign(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { ctx, supabase, venueId, me } = await load(fd, "chair");
    const m = msgSchema.safeParse({ subject: s(fd, "subject"), body: s(fd, "body") });
    if (!m.success) return { fieldErrors: fieldErrors(m.error) };
    const roles = pickList(fd, "roles", ROLES), conds = pickList(fd, "conds", CONDS);
    if (!roles.length) return { error: "Choose at least one role." };
    const aud = await audience(supabase, venueId, roles, conds);
    const deadline = await finalsDeadline(supabase, ctx);
    const sample = aud[0];
    const people = await peopleEmails(supabase, venueId, [me, sample?.person_id].filter((x): x is string => !!x));
    const vars = varsFor(ctx, sample, sample ? people.get(sample.person_id) : undefined, deadline);
    const subj = renderTemplate(m.data.subject, vars), body = renderTemplate(m.data.body, vars);
    const row = { venue_id: venueId, roles, conditions: conds, subject: m.data.subject, body: m.data.body, recipients: aud.length, test_sent_at: new Date().toISOString() };
    const cid = s(fd, "campaign");
    const q = cid && uuid.safeParse(cid).success
      ? supabase.from("email_campaigns").update(row).eq("id", cid).eq("status", "draft").select("id").single()
      : supabase.from("email_campaigns").insert(row).select("id").single();
    const { data, error } = await q;
    if (error) return { error: friendlyDb(error.message) };
    const mine = me ? people.get(me)?.email : null;
    if (mine) await sendMany([{ to: mine, subject: `[TEST] ${subj.text}`, text: body.text }]);
    if (me) await supabase.rpc("notify_people", { p_venue: venueId, p_people: [me], p_kind: "system", p_subject: `[TEST] ${subj.text}`, p_body: body.text });
    const miss = [...new Set([...subj.missing, ...body.missing])];
    return { ok: true, campaignId: data.id as string, count: aud.length, info: miss.length ? `Test sent, but these placeholders have no value for some recipients: ${miss.map((x) => `[${x}]`).join(", ")}` : undefined };
  });
}

export async function sendCampaign(_: Ops2State, fd: FormData): Promise<Ops2State> {
  return guard(async () => {
    const { slug, ctx, supabase, venueId, me } = await load(fd, "chair");
    const cid = uuid.safeParse(s(fd, "campaign"));
    if (!cid.success) return { error: "Send a test to yourself first (I3)." };
    const m = msgSchema.safeParse({ subject: s(fd, "subject"), body: s(fd, "body") });
    if (!m.success) return { fieldErrors: fieldErrors(m.error) };
    const { data: camp } = await supabase.from("email_campaigns").select("id, subject, body, roles, conditions, test_sent_at, status").eq("id", cid.data).eq("venue_id", venueId).single();
    if (!camp || camp.status !== "draft") return { error: "This message was already sent or scheduled. Start a new message." };
    if (!camp.test_sent_at || camp.subject !== m.data.subject || camp.body !== m.data.body) return { error: "You changed the message after the test — send a new test first (I3)." };
    const roles = pickList(fd, "roles", ROLES), conds = pickList(fd, "conds", CONDS);
    if (roles.join() !== (camp.roles as string[]).join() || conds.join() !== (camp.conditions as string[]).join()) return { error: "You changed the audience after the test — send a new test first (I3)." };
    const aud = await audience(supabase, venueId, roles, conds);
    if (!aud.length) return { error: "No one matches this audience." };
    const twice = fd.get("confirm_twice") === "on";
    if (aud.length > 500 && !twice) return { error: `Confirm a second time to send to ${aud.length} people (over 500, I3).` };
    const deadline = await finalsDeadline(supabase, ctx);
    const people = await peopleEmails(supabase, venueId, aud.map((a) => a.person_id));
    const rendered = aud.map((a) => {
      const p = people.get(a.person_id), vars = varsFor(ctx, a, p, deadline);
      const subj = renderTemplate(m.data.subject, vars), body = renderTemplate(m.data.body, vars);
      return { a, p, subj, body, missing: [...subj.missing, ...body.missing] };
    });
    const broken = rendered.filter((r) => r.missing.length);
    if (broken.length) {
      const keys = [...new Set(broken.flatMap((r) => r.missing))];
      return { error: `Not sent: ${broken.length} recipient(s) have no value for ${keys.map((k) => `[${k}]`).join(", ")} (I5). Narrow the audience or remove the placeholder.` };
    }
    if (s(fd, "mode") === "schedule") {
      const p = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/) }).safeParse({ day: s(fd, "day"), time: s(fd, "time") });
      if (!p.success) return { fieldErrors: { when: "Pick a date and time." } };
      const at = zonedToUtc(p.data.day, p.data.time, ctx.venue.timezone);
      if (new Date(at).getTime() < Date.now() + 5 * 60000) return { fieldErrors: { when: "Pick a time at least 5 minutes from now." } };
      const { error } = await supabase.from("email_campaigns").update({ status: "scheduled", scheduled_at: at, recipients: aud.length, confirmed_twice: twice, sent_by: me }).eq("id", cid.data);
      if (error) return { error: friendlyDb(error.message) };
      await supabase.rpc("log_campaign", { p_campaign: cid.data });
      done(slug, "email");
      return { ok: true, sentTo: aud.length, scheduled: true };
    }
    // optional mail (not about the person's own paper or review) carries an unsubscribe link (UN01)
    const optional = !conds.some((c) => c === "acc" || c === "inc" || c === "late");
    const links = optional ? await unsubscribeUrls(venueId, rendered.filter((r) => r.p?.email).map((r) => r.a.person_id)) : new Map<string, string>();
    const mails: Mail[] = rendered.filter((r) => r.p?.email).map((r) => ({ to: r.p!.email!, subject: r.subj.text, text: r.body.text, replyTo: ctx.venue.contact_email ?? undefined, unsubscribeUrl: links.get(r.a.person_id) }));
    const res = await sendMany(mails, 6);
    await pool(rendered, 6, (r) => supabase.rpc("notify_people", { p_venue: venueId, p_people: [r.a.person_id], p_kind: "venue", p_subject: r.subj.text, p_body: r.body.text, p_submission: r.a.submission_id }));
    const { error } = await supabase.from("email_campaigns").update({ status: "sent", sent_at: new Date().toISOString(), recipients: aud.length, delivered: res.sent, bounced: res.failed, confirmed_twice: twice, sent_by: me }).eq("id", cid.data);
    if (error) return { error: friendlyDb(error.message) };
    await supabase.rpc("log_campaign", { p_campaign: cid.data });
    done(slug, "email");
    return { ok: true, sentTo: aud.length, info: res.skipped ? "Email is not configured yet — the message went to their Plenary inbox only." : undefined };
  });
}
