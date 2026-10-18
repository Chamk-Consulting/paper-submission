import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getT } from "@/lib/i18n/server";
import { INTL } from "@/lib/i18n/config";
import { requireEvent } from "@/lib/manage/data";
import { createClient } from "@/lib/supabase/server";
import { loadRooms, loadSessions } from "@/lib/manage/ops2-data";
import { fmtDayLabel, paperNo, utcToZoned } from "@/lib/manage/ops2-time";
import { ManagePage, ui } from "@/components/manage/chrome";
import { AnnouncementForm, CheckInDesk, NoShowPanel, RoomCards, type DeskRow, type NoShow, type RoomNow } from "@/components/manage/ops2/live-desk";
import { Reveal } from "@/components/motion/reveal";
import { LiveSkeleton } from "@/components/skeletons/ops2";

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Event day") };
}

type RawReg = Omit<DeskRow, "papers" | "presents" | "paid"> & { person_id: string | null; paid_at: string | null; registration_papers: { submissions: { number: number } | null }[] };

async function Inner({ params, searchParams }: P) {
  const { slug } = await params;
  const { q: rawQ } = await searchParams;
  const ctx = await requireEvent(slug);
  const [t, locale, supabase] = [await getT(), await getLocale(), await createClient()];
  const id = ctx.venue.id, tz = ctx.venue.timezone;
  const [sessions, rooms] = await Promise.all([loadSessions(id), loadRooms(id)]);
  const now = new Date();
  const nowZ = utcToZoned(now.toISOString(), tz);
  const days = [...new Set(sessions.map((s) => utcToZoned(s.starts_at, tz).day))].sort();
  const day = days.includes(nowZ.day) ? nowZ.day : days.find((d) => d > nowZ.day) ?? days[days.length - 1] ?? nowZ.day;
  const isToday = day === nowZ.day;
  const today = sessions.filter((s) => utcToZoned(s.starts_at, tz).day === day);
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const fmt = (iso: string) => utcToZoned(iso, tz).time;
  const ref = isToday ? now.getTime() : new Date(today[0]?.starts_at ?? now).getTime();

  // Rooms right now: the running session, else the next one, per room.
  const roomCards: RoomNow[] = rooms.map((r) => {
    const list = today.filter((s) => s.room_id === r.id);
    const cur = list.find((s) => new Date(s.starts_at).getTime() <= ref && ref < new Date(s.ends_at).getTime());
    const nxt = cur ?? list.find((s) => new Date(s.starts_at).getTime() > ref);
    if (!nxt) return { room: r.name, sessionId: null, code: null, title: null, status: "open", delay: 0, note: null, range: null, nowTalk: null, progress: 0, next: false };
    const a = new Date(nxt.starts_at).getTime(), b = new Date(nxt.ends_at).getTime();
    const talk = cur ? [...nxt.talks].reverse().find((x) => x.starts_at && new Date(x.starts_at).getTime() <= ref) : undefined;
    return {
      room: r.name, sessionId: nxt.id, code: nxt.code, title: nxt.title, status: nxt.live_status ?? "scheduled", delay: nxt.delay_min ?? 0, note: nxt.live_note ?? null,
      range: `${fmt(nxt.starts_at)}–${fmt(nxt.ends_at)}`, nowTalk: talk ? `${talk.number ? paperNo(talk.number) + " " : ""}${talk.title ?? ""}${talk.presenter ? ` — ${talk.presenter}` : ""}` : null,
      progress: cur ? Math.min(1, Math.max(0, (ref - a) / (b - a))) : 0, next: !cur,
    };
  });
  const block = today.find((s) => new Date(s.starts_at).getTime() <= ref && ref < new Date(s.ends_at).getTime());

  // Check-in search (server-side, so the desk works with thousands of registrations).
  const q = (rawQ ?? "").replace(/[%,()*\\]/g, " ").trim().slice(0, 80);
  let rows: DeskRow[] = [];
  const talksByPresenter = new Map<string, string>();
  for (const s of today) for (const x of s.talks) if (x.presenter_id && x.starts_at) talksByPresenter.set(x.presenter_id, `${x.number ? paperNo(x.number) : ""} · ${fmt(x.starts_at)} · ${s.room_id ? roomName.get(s.room_id) ?? s.code : s.code}`);
  if (q) {
    const { data } = await supabase.from("registrations")
      .select("id, number, full_name, email, affiliation, reg_type, paid_at, checked_in_at, badges, person_id, registration_papers(submissions(number))")
      .eq("venue_id", id).or(`full_name.ilike.%${q}%,email.ilike.%${q}%,number.ilike.%${q}%,affiliation.ilike.%${q}%`).order("full_name").limit(15);
    rows = ((data ?? []) as unknown as RawReg[]).map(({ registration_papers, person_id, paid_at, ...r }) => ({
      ...r, paid: !!paid_at, papers: registration_papers.map((x) => x.submissions?.number).filter((n): n is number => !!n).map(paperNo),
      presents: person_id ? talksByPresenter.get(person_id) ?? null : null,
    }));
  }
  const [{ count: registered }, { count: checked }, { data: everyone }] = await Promise.all([
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("venue_id", id),
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("venue_id", id).not("checked_in_at", "is", null),
    supabase.rpc("announcement_audience", { p_venue: id, p_session: null }),
  ]);
  const perSession = await Promise.all(today.filter((s) => s.kind !== "break").map(async (s) => {
    const { data } = await supabase.rpc("announcement_audience", { p_venue: id, p_session: s.id });
    return { id: s.id, label: `${s.code} · ${s.title} (${fmt(s.starts_at)})`, count: (data ?? []).length };
  }));
  const options = [{ id: "", label: t("Everyone registered"), count: (everyone ?? []).length }, ...perSession];

  const talksToday = today.flatMap((s) => s.talks.filter((x) => x.submission_id));
  const presented = talksToday.filter((x) => x.attendance === "presented").length;
  const reports: NoShow[] = sessions.flatMap((s) => s.talks.filter((x) => x.attendance === "no_show").map((x) => ({ talk: x.id, label: `${x.number ? paperNo(x.number) : ""} ${x.title ?? ""} · ${s.code}`, note: x.noshow_note ?? null })));
  const reportable = talksToday.filter((x) => x.attendance !== "no_show").map((x) => ({ id: x.id, label: `${x.starts_at ? fmt(x.starts_at) : ""} ${x.number ? paperNo(x.number) : ""} ${x.title ?? ""}` }));

  return (
    <ManagePage ctx={ctx} active="live" title={t("Event day")} sub={t("Live rooms, check-in desk, announcements and no-shows.")}
      actions={<Link href={`/manage/${slug}/registrations`} className={ui.ghost}>{t("Registrations")}</Link>}>
      <div className="flex flex-col gap-5">
        {!isToday ? <p className={`${ui.warn} m-0`}>{days.length ? t("The event is not running today — showing {day}.", { day: fmtDayLabel(day, INTL[locale]) }) : t("No sessions yet — build the program first.")}</p> : null}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className={ui.card}><p className={ui.kicker}>{t("Now")}</p><p className="m-0 mt-1 font-serif text-[30px]">{now.toLocaleTimeString(INTL[locale], { hour: "2-digit", minute: "2-digit", timeZone: tz })}</p><p className={`${ui.hint} m-0`}>{block ? `${fmt(block.starts_at)}–${fmt(block.ends_at)} · ${block.title}` : t("between sessions")}</p></div>
          <div className={ui.card}><p className={ui.kicker}>{t("Checked in")}</p><p className="m-0 mt-1 font-serif text-[30px]">{checked ?? 0}</p><p className={`${ui.hint} m-0`}>{t("of {n} registered", { n: registered ?? 0 })}</p></div>
          <div className={ui.card}><p className={ui.kicker}>{t("Talks today")}</p><p className="m-0 mt-1 font-serif text-[30px]">{talksToday.length}</p><p className={`${ui.hint} m-0`}>{t("{n} presented so far", { n: presented })}</p></div>
          <div className={ui.card}><p className={ui.kicker}>{t("No-shows reported")}</p><p className="m-0 mt-1 font-serif text-[30px]">{reports.length}</p><p className={`${ui.hint} m-0`}>{t("final status after the event (H5)")}</p></div>
        </div>
        <section>
          <h2 className={`${ui.h2} mb-3`}>{t("Rooms right now")}</h2>
          <RoomCards slug={slug} rooms={roomCards} canEdit={ctx.isChair} />
        </section>
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
          <CheckInDesk slug={slug} q={q} rows={rows} />
          <aside className="flex flex-col gap-4">
            <section className={ui.card}><h2 className={`${ui.h2} mb-3`}>{t("Announcement")}</h2><AnnouncementForm slug={slug} options={options} /></section>
            <section className={ui.card}><h2 className={`${ui.h2} mb-3`}>{t("No-show reports")}</h2><NoShowPanel slug={slug} reports={reports} talks={reportable} canEdit={ctx.isChair} /></section>
          </aside>
        </div>
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<LiveSkeleton />}><Inner {...props} /></Reveal>;
}
