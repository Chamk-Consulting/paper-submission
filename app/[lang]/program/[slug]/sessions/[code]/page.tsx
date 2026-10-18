import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader, PublicFooter } from "@/components/venues/public-header";
import { ProgramHero } from "@/components/program/hero";
import { SaveButton, TalkList } from "@/components/program/session-view";
import { ProgramSkeleton } from "@/components/skeletons/program";
import { Reveal } from "@/components/motion/reveal";
import { loadProgram, loadRoom } from "@/lib/program/data";
import { KIND_STYLE, fmtDay, fmtTime, overlaps } from "@/lib/program/time";
import { getT } from "@/lib/i18n/server";

/* Canvas PG02 — one session: talks, room facts, what else runs at the same time. */

type Params = { slug: string; code: string };

async function find(p: Promise<Params>) {
  const { slug, code } = await p;
  const data = await loadProgram(slug);
  const s = data?.sessions.find((x) => x.code === decodeURIComponent(code));
  return data && s ? { data, s } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const [r, t] = await Promise.all([find(params), getT()]);
  if (!r) return { title: t("Session not found") };
  return { title: `${r.s.code} · ${r.s.title}`, description: t("{code} at {name}: talks, room and time.", { code: r.s.code, name: r.data.venue.shortName ?? r.data.venue.name }) };
}

async function Inner({ params }: { params: Promise<Params> }) {
  const [r, t] = await Promise.all([find(params), getT()]);
  if (!r) notFound();
  const { data: { venue, sessions, signedIn }, s } = r;
  const tz = venue.timezone;
  const room = await loadRoom(s.roomId);
  const [kb, ki, kl] = KIND_STYLE[s.kind] ?? KIND_STYLE.oral;
  const same = sessions.filter((o) => o.id !== s.id && overlaps(o, s));
  const changed = !!(s.previousRoom && s.previousRoom !== s.room);
  const acr = venue.shortName ?? venue.name;

  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <PublicHeader signedIn={signedIn} />
      <ProgramHero t={t} venue={venue}
        crumbs={[[acr, `/venues/${venue.slug}`], [t("Program"), `/program/${venue.slug}`], [fmtDay(s.startsAt, tz, t.intl), null], [s.code, null]]}
        title={<><span className="mb-2 block"><span className="rounded-[2px] px-2 py-0.5 align-middle font-mono text-[11px] font-medium uppercase tracking-[0.04em]" style={{ background: kb, color: ki }}>{t(kl)} · {s.code}</span></span>{s.title}</>}
        sub={<>
          {fmtTime(s.startsAt, tz, t.intl)}–{fmtTime(s.endsAt, tz, t.intl)} · {s.room ?? t("Room to be announced")}
          {changed ? <> (<s>{s.previousRoom}</s>)</> : null}
          {s.chair ? ` · ${t("Chair {name}", { name: s.chair })}` : ""}{s.cochair ? ` · ${t("Co-chair {name}", { name: s.cochair })}` : ""}
          {s.liveStatus === "late" && s.delayMin > 0 ? ` · ${t("{n} min late", { n: s.delayMin })}` : ""}
        </>}
        actions={<>
          <SaveButton session={s} all={sessions} slug={venue.slug} signedIn={signedIn} />
          <a href={`/feed/session/${s.id}`} className="inline-flex h-11 items-center rounded-[4px] border border-[#3A4A75] px-4 text-[15px] font-medium text-[#F5F6F3] no-underline">{t("Add to calendar")}</a>
        </>} />
      <main className="mx-auto box-border flex w-full max-w-[1280px] flex-auto flex-col gap-6 px-4 pb-16 pt-6 sm:px-8 lg:flex-row lg:items-start">
        <section aria-labelledby="talks-h" className="min-w-0 flex-auto">
          <h2 id="talks-h" className="m-0 mb-3 font-serif text-[24px] font-normal">{t(s.kind === "poster" ? "Posters" : "Talks")}</h2>
          {changed ? <p className="mb-3 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-2.5 text-[14px] text-[#3B2A07]"><strong>{t("Room change:")}</strong> {t("this session moved from {old} to {room}.", { old: s.previousRoom ?? "", room: s.room ?? "" })}</p> : null}
          <TalkList session={s} tz={tz} />
        </section>
        <aside className="flex w-full flex-col gap-4 lg:w-[300px] lg:flex-none">
          <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[18px] py-4 text-[14px]">
            <p className="m-0 mb-2 font-mono text-[11px] tracking-[0.06em] text-[#4A5263]">{t("ROOM")}</p>
            <div className="font-semibold">{s.room ?? t("Room to be announced")}</div>
            {room ? (
              <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0 text-[#4A5263]">
                {room.level ? <li>{room.level}</li> : null}
                {room.seats ? <li>{t("{n} seats", { n: room.seats })}</li> : null}
                <li>{room.stepFree ? t("Step-free access") : t("Not step-free — ask at the desk")}</li>
                {room.equipment ? <li>{room.equipment}</li> : null}
              </ul>
            ) : null}
            <Link href={`/venues/${venue.slug}#program`} className="mt-2 inline-block">{t("Venue map & travel")}</Link>
          </section>
          <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[18px] py-4 text-[14px]">
            <p className="m-0 mb-2 font-mono text-[11px] tracking-[0.06em] text-[#4A5263]">{t("SAME TIME")}</p>
            {same.length ? (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {same.map((o) => (
                  <li key={o.id}>
                    <Link href={`/program/${venue.slug}/sessions/${encodeURIComponent(o.code)}`} className="font-semibold text-[#121826]">{o.code} · {o.title}</Link>
                    <div className="text-[12px] text-[#4A5263]">{o.room ?? "—"} · {fmtTime(o.startsAt, tz, t.intl)}–{fmtTime(o.endsAt, tz, t.intl)}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="m-0 text-[#4A5263]">{t("Nothing else runs at the same time.")}</p>}
          </section>
          <Link href={`/program/${venue.slug}`} className="text-[14px]">{t("← Back to the program")}</Link>
        </aside>
      </main>
      <PublicFooter />
    </div>
  );
}

export default function Page(props: { params: Promise<Params> }) {
  return (
    <Reveal fallback={<ProgramSkeleton variant="session" />}>
      <Inner {...props} />
    </Reveal>
  );
}
