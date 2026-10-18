"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useSchedule } from "@/components/program/program-board";
import { fmtTime, talkStart } from "@/lib/program/time";
import type { Session } from "@/lib/program/data";

/* Canvas PG02: save button + talks accordion with abstracts, authors and presenter. */

export function SaveButton({ session, all, slug, signedIn }: { session: Session; all: Session[]; slug: string; signedIn: boolean }) {
  const t = useT();
  const sched = useSchedule(all, slug);
  const auto = session.iChair || session.iPresent;
  const on = auto || !!sched.saved[session.id];
  const cl = on && sched.clashes(session);
  if (!signedIn) return <Link href={`/sign-in?next=${encodeURIComponent(`/program/${slug}/sessions/${session.code}`)}`} className="inline-flex h-11 items-center rounded-[4px] bg-[#F2A93B] px-[18px] text-[15px] font-semibold text-[#0E1B3D] no-underline">{t("Sign in to save")}</Link>;
  if (auto) return <span className="inline-flex h-11 items-center rounded-[4px] bg-[#E1F3EA] px-4 text-[15px] font-semibold text-[#14603F]">{session.iChair ? t("★ You chair this") : t("★ You present here")}</span>;
  return (
    <>
      <button type="button" aria-pressed={on} onClick={() => sched.toggle(session.id)}
        className="inline-flex h-11 items-center rounded-[4px] px-[18px] text-[15px] font-semibold"
        style={{ background: on ? (cl ? "#FDECEA" : "#E1F3EA") : "#F2A93B", color: on ? (cl ? "#B3261E" : "#14603F") : "#0E1B3D", border: 0 }}>
        {cl ? t("★ In schedule · overlaps") : on ? t("★ In my schedule") : t("+ Add to schedule")}
      </button>
      {sched.error ? <span role="alert" className="self-center text-[13px] text-[#FDECEA]">{t(sched.error)}</span> : null}
    </>
  );
}

export function TalkList({ session, tz }: { session: Session; tz: string }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(session.talks[0]?.id ?? null);
  if (!session.talks.length) return <p className="rounded-[8px] border border-dashed border-[#DADDE3] bg-white p-8 text-center text-[#4A5263]">{t("No talks listed for this session.")}</p>;
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {session.talks.map((x, i) => {
        const on = open === x.id;
        const st = talkStart(session.startsAt, session.talks, i);
        return (
          <li key={x.id} className="rounded-[8px] border border-[#DADDE3] bg-white">
            <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : x.id)} className="flex w-full items-start gap-3.5 border-0 bg-transparent px-4 py-3.5 text-left text-[#121826] sm:gap-4">
              <span className="w-[46px] flex-none pt-0.5 font-mono text-[14px] font-semibold">{fmtTime(st, tz, t.intl)}</span>
              <span className="min-w-0 flex-auto">
                <span className="block font-mono text-[11px] text-[#4A5263]">{x.number ? `#${x.number} · ` : ""}{t(session.kind === "poster" ? "poster" : session.kind === "keynote" ? "keynote" : "oral")} · {t("{a} + {b} min", { a: x.talkMin, b: x.qaMin })}{x.remote ? ` · ${t("remote")}` : ""}</span>
                <span className="mt-0.5 block text-[16px] font-bold leading-[1.3]">{x.title}</span>
                {x.authors ? <span className="mt-0.5 block text-[13px] text-[#4A5263]">{x.authors}</span> : null}
              </span>
              <span aria-hidden className="flex-none pt-1 text-[#4A5263] transition-transform" style={{ transform: on ? "rotate(180deg)" : "none" }}>▾</span>
            </button>
            {on ? (
              <div className="border-t border-[#EEF0EC] px-4 pb-4 pt-3 sm:pl-[78px]">
                <p className="m-0 max-w-[70ch] text-[14px] leading-[1.6]">{x.abstract ?? t("The abstract will appear here once the authors publish it.")}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-[#4A5263]">
                  <span>{t("Paper (IEEE Xplore after the event)")}</span>
                  {x.presenter ? <span>{t("Presenter: {name}", { name: x.presenter })}</span> : null}
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
