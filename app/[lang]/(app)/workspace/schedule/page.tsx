import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "@/components/site/link";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { Agenda, type AgendaRow } from "@/components/workspace/agenda";
import { dayKey, fmtDay, fmtTime, tzLabel } from "@/lib/program/time";
import { getEventRows } from "@/lib/workspace/events-pages";
import { loadAgenda } from "@/lib/workspace/my-work";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Agenda") };
}

type Search = { view?: string; month?: string; day?: string; q?: string; event?: string; type?: string; clash?: string };

/** Minutes from midnight in the event's time zone. */
function minutesIn(iso: string, tz: string) {
  const p = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).formatToParts(new Date(iso));
  return Number(p.find((x) => x.type === "hour")?.value ?? 0) * 60 + Number(p.find((x) => x.type === "minute")?.value ?? 0);
}

/** My work › Agenda: your timetable across events (talks, sessions you chair or saved, deadlines), from today on. */
async function Inner({ searchParams }: { searchParams: Promise<Search> }) {
  const [ev, t, sp] = await Promise.all([getEventRows(), getT(), searchParams]);
  if (!ev.signedIn) redirect("/sign-in?next=/workspace/schedule");
  const items: AgendaRow[] = (await loadAgenda(ev.rows, Date.parse(ev.generatedAt))).map((x) => ({
    ...x, day: dayKey(x.startsAt, x.timezone), dayLabel: fmtDay(x.startsAt, x.timezone, t.intl),
    time: `${fmtTime(x.startsAt, x.timezone, t.intl)}${x.endsAt ? `–${fmtTime(x.endsAt, x.timezone, t.intl)}` : ""}`, tzl: tzLabel(x.timezone, new Date(x.startsAt)),
    startMin: minutesIn(x.startsAt, x.timezone),
    // a session crossing midnight ends at the bottom of the grid
    endMin: x.endsAt ? (dayKey(x.endsAt, x.timezone) === dayKey(x.startsAt, x.timezone) ? minutesIn(x.endsAt, x.timezone) : 24 * 60) : minutesIn(x.startsAt, x.timezone) + 30,
  }));
  const live = ev.rows.filter((r) => !r.past && (r.mine || r.reg));
  const events: [string, string][] = live.map((r) => [r.v.slug, r.v.acr]);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 font-serif text-[36px] font-normal leading-[1.1] tracking-[-0.01em]">{t("Agenda")}</h1>
          <p className="mb-0 mt-1.5 max-w-[64ch] text-[#4A5263]">{t("Your timetable across events: talks you give, sessions you chair or saved, and your deadlines. Times are in each event’s time zone.")}</p>
        </div>
        <Link href="/settings/calendar" className="inline-flex h-10 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-medium text-[#121826] no-underline hover:bg-[#F7F8F6]">{t("Sync to calendar")}</Link>
      </div>
      {events.length ? (
        <p className="mb-0 mt-3 text-[13px] text-[#4A5263]">
          {t("Save sessions from a program:")}{" "}
          {events.map(([slug, acr], i) => <span key={slug}>{i ? " · " : ""}<Link href={`/workspace/events/${slug}/program`} className="text-[#2F5FD0]">{acr}</Link></span>)}
        </p>
      ) : null}
      <div className="mt-5"><Agenda items={items} events={events} init={sp} /></div>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return <Reveal fallback={null}><Inner searchParams={searchParams} /></Reveal>;
}
