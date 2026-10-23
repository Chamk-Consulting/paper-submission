"use client";

import Link from "@/components/site/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { messagePresenters, reportNoShow, setAttendance, updateLive, type ProgramState } from "@/lib/program/actions";
import { fmtDay, fmtTime, talkStart } from "@/lib/program/time";
import type { ChairSession, ChairTalk } from "@/lib/program/data";

/* Canvas CH01 (Before / On the day) and M05 (live run sheet with the talk timer). */

const CYCLE = ["waiting", "checked_in", "presented", "no_show"] as const;
const ATT_LABEL: Record<string, [string, string, string]> = {
  waiting: ["Not here", "#EEF0EC", "#4A5263"], checked_in: ["Checked in", "#E6EDFC", "#1F47A8"], speaking: ["Speaking", "#0E1B3D", "#F2A93B"],
  presented: ["Presented ✓", "#E1F3EA", "#14603F"], no_show: ["No-show", "#FDECEA", "#B3261E"],
};

function useAttendance(talks: ChairTalk[]) {
  const [att, setAtt] = useState<Record<string, string>>(() => Object.fromEntries(talks.map((x) => [x.id, x.attendance])));
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const set = (id: string, value: string) => {
    const was = att[id];
    setAtt((m) => ({ ...m, [id]: value }));
    start(async () => {
      const r = await setAttendance(id, value);
      if (r.error) { setAtt((m) => ({ ...m, [id]: was })); setError(r.error); } else setError(null);
    });
  };
  return { att, set, error, setAtt };
}

const Tag = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className={ui.tag} style={{ background: ok ? "#E1F3EA" : "#FBEFDD", color: ok ? "#14603F" : "#7A4508" }}>{ok ? "✓ " : "· "}{label}</span>
);

export function ChairView({ s, slides, view }: { s: ChairSession; slides: Record<string, string>; view: "before" | "live" }) {
  const t = useT();
  const tz = s.timezone;
  const a = useAttendance(s.talks);
  const ready = s.talks.filter((x) => x.registered && x.slides).length;
  const per = s.talks[0] ? `${s.talks[0].talkMin + s.talks[0].qaMin}` : "20";

  return (
    <div className="flex flex-col gap-4">
      <section className={`${ui.card} print:border-0 print:p-0`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={ui.kicker}>{s.code} · {s.venueShort}</p>
            <h2 className="m-0 mt-1 font-serif text-[26px] font-normal leading-[1.15]">{s.title}</h2>
            <p className="m-0 mt-1 text-[14px] text-[#4A5263]">
              {fmtDay(s.startsAt, tz, t.intl)} {fmtTime(s.startsAt, tz, t.intl)}–{fmtTime(s.endsAt, tz, t.intl)} · {s.room ?? t("Room to be announced")}
              {s.cochair ? ` · ${t("Co-chair {name}", { name: s.cochair })}` : ""}
            </p>
          </div>
          <span className="rounded-[4px] px-2.5 py-1 text-[13px] font-semibold" style={{ background: ready === s.talks.length ? "#E1F3EA" : "#FBEFDD", color: ready === s.talks.length ? "#14603F" : "#7A4508" }}>
            {t("{n}/{total} presenters ready", { n: ready, total: s.talks.length })}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div role="tablist" className="flex gap-1 rounded-[6px] bg-[#EEF0EC] p-[3px]">
            {([["before", "Before"], ["live", "On the day"]] as const).map(([k, label]) => (
              <Link key={k} role="tab" aria-selected={view === k} href={k === "live" ? `/workspace/talks/${s.id}?view=live` : `/workspace/talks/${s.id}`} scroll={false}
                className={`inline-flex h-[34px] items-center rounded-[4px] px-3.5 text-[14px] font-semibold no-underline ${view === k ? "bg-white text-[#121826]" : "text-[#4A5263]"}`}>{t(label)}</Link>
            ))}
          </div>
          <span className="text-[13px] text-[#4A5263]">{t("{n} min per paper · {a} talk + {b} questions", { n: per, a: s.talks[0]?.talkMin ?? 15, b: s.talks[0]?.qaMin ?? 5 })}</span>
        </div>
        {a.error ? <p role="alert" className={`${ui.bad} mt-3`}>{t(a.error)}</p> : null}

        {view === "live" ? <LiveRunSheet s={s} a={a} /> : (
          <div className="mt-4 overflow-x-auto">
            <table className={`${ui.table} min-w-[640px]`}>
              <thead><tr><th className={ui.th}>{t("Time")}</th><th className={ui.th}>{t("Paper · presenter")}</th><th className={ui.th}>{t("Ready?")}</th><th className={`${ui.th} print:hidden`}>{t("On the day")}</th></tr></thead>
              <tbody>
                {s.talks.map((x, i) => {
                  const ok = x.registered && x.slides && !!x.bio;
                  const [label, bg, ink] = ATT_LABEL[a.att[x.id]] ?? ATT_LABEL.waiting;
                  const next = CYCLE[(CYCLE.indexOf(a.att[x.id] as (typeof CYCLE)[number]) + 1) % CYCLE.length];
                  return (
                    <tr key={x.id} style={{ background: ok ? undefined : "#FFFCF5" }}>
                      <td className={`${ui.td} font-mono font-semibold`}>{fmtTime(talkStart(s.startsAt, s.talks, i), tz, t.intl)}</td>
                      <td className={ui.td}>
                        <div className="font-semibold">{x.number ? `#${x.number} · ` : ""}{x.title}</div>
                        <div className="text-[13px] text-[#4A5263]">{x.presenter ?? t("Presenter not named yet")}{x.remote ? ` · ${t("remote")}` : ""}</div>
                        {x.bio ? <details className="mt-1 text-[13px]"><summary className="cursor-pointer text-[#1F47A8]">{t("Bio for your introduction")}</summary><p className="m-0 mt-1 text-[#4A5263]">{x.bio}</p></details> : null}
                      </td>
                      <td className={ui.td}><div className="flex flex-wrap gap-1"><Tag ok={x.registered} label="REG" /><Tag ok={x.slides} label="SLIDES" /><Tag ok={!!x.bio} label="BIO" /></div></td>
                      <td className={`${ui.td} print:hidden`}>
                        <button type="button" onClick={() => a.set(x.id, a.att[x.id] === "speaking" ? "presented" : next)} title={t("Click to change")}
                          className="h-8 rounded-[4px] border-0 px-2.5 text-[12px] font-bold" style={{ background: bg, color: ink }}>{t(label)}</button>
                      </td>
                    </tr>
                  );
                })}
                {!s.talks.length ? <tr><td colSpan={4} className={`${ui.td} text-center text-[#4A5263]`}>{t("No talks in this session yet.")}</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ChairActions s={s} slides={slides} />
    </div>
  );
}

function ChairActions({ s, slides }: { s: ChairSession; slides: Record<string, string> }) {
  const t = useT();
  const [open, setOpen] = useState<"" | "msg" | "slides" | "noshow">("");
  const [msg, msgAction, msgPending] = useActionState<ProgramState, FormData>(messagePresenters, {});
  const [ns, nsAction, nsPending] = useActionState<ProgramState, FormData>(reportNoShow, {});
  const n = Object.keys(slides).length;
  const btn = "inline-flex h-10 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-medium text-[#121826]";
  return (
    <section className={`${ui.card} print:hidden`}>
      <h2 className={ui.h2}>{t("Chair actions")}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btn} aria-expanded={open === "msg"} onClick={() => setOpen(open === "msg" ? "" : "msg")}>{t("Message all presenters")}</button>
        <button type="button" className={btn} aria-expanded={open === "slides"} onClick={() => setOpen(open === "slides" ? "" : "slides")} disabled={!n}>{t("Download all slides ({n})", { n })}</button>
        <button type="button" className={btn} onClick={() => window.print()}>{t("Print run sheet")}</button>
        <button type="button" className={btn} aria-expanded={open === "noshow"} onClick={() => setOpen(open === "noshow" ? "" : "noshow")}>{t("Report a no-show")}</button>
      </div>
      {open === "msg" ? (
        <form action={msgAction} className="mt-4 flex max-w-[620px] flex-col gap-3">
          <input type="hidden" name="sessionId" value={s.id} />
          <label className={ui.label}>{t("Subject")}<input name="subject" required maxLength={200} defaultValue={t("{code}: before our session", { code: s.code })} className={ui.input} /></label>
          <label className={ui.label}>{t("Message")}<textarea name="body" required rows={5} maxLength={8000} className={ui.textarea} placeholder={t("Please come to the room 10 minutes early and load your slides on the room laptop.")} /></label>
          {msg.error ? <p role="alert" className={ui.bad}>{t(msg.error)}</p> : null}
          {msg.info ? <p role="status" className={ui.ok}>✓ {t(msg.info)}</p> : null}
          <button type="submit" disabled={msgPending} className={`${ui.navy} self-start`}>{msgPending ? t("Sending…") : t("Send to presenters")}</button>
        </form>
      ) : null}
      {open === "slides" ? (
        <ul className="m-0 mt-4 flex list-none flex-col gap-1.5 p-0 text-[14px]">
          {s.talks.filter((x) => slides[x.id]).map((x) => <li key={x.id}><a href={slides[x.id]} download target="_blank" rel="noreferrer">{x.number ? `#${x.number} · ` : ""}{x.title}</a></li>)}
          <li className={ui.hint}>{t("Links work for 10 minutes. Reload the page for fresh ones.")}</li>
        </ul>
      ) : null}
      {open === "noshow" ? (
        <form action={nsAction} className="mt-4 flex max-w-[620px] flex-col gap-3">
          <label className={ui.label}>{t("Paper")}
            <select name="talkId" required className={ui.input} defaultValue="">
              <option value="" disabled>{t("Choose…")}</option>
              {s.talks.map((x) => <option key={x.id} value={x.id}>{x.number ? `#${x.number} · ` : ""}{x.title}</option>)}
            </select>
          </label>
          <label className={ui.label}>{t("Note for the program chair (optional)")}<textarea name="note" rows={3} maxLength={1000} className={ui.textarea} /></label>
          {ns.error ? <p role="alert" className={ui.bad}>{t(ns.error)}</p> : null}
          {ns.info ? <p role="status" className={ui.ok}>✓ {t(ns.info)}</p> : null}
          <button type="submit" disabled={nsPending} className={`${ui.navy} self-start`}>{t("Report no-show")}</button>
        </form>
      ) : null}
      <p className={`${ui.hint} mt-4`}>{t("No-shows are reported to the program chair after the session. Papers not presented may be left out of IEEE Xplore.")}</p>
    </section>
  );
}

/* ---------------------------------------------------------------- M05 live run sheet */

type Timer = { talkId: string; startedAt: number; extra: number };
const clock = () => new Date().getTime();
const mmss = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, "0")}`;

function LiveRunSheet({ s, a }: { s: ChairSession; a: ReturnType<typeof useAttendance> }) {
  const t = useT();
  const key = `plenary-chair-timer-${s.id}`;
  const [timer, setTimer] = useState<Timer | null>(null);
  const [now, setNow] = useState(0);
  const [live, setLive] = useState({ status: s.liveStatus, delay: s.delayMin });
  const [liveErr, setLiveErr] = useState<string | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    let saved: Timer | null = null;
    try { const raw = localStorage.getItem(key); saved = raw ? JSON.parse(raw) as Timer : null; } catch { /* storage unavailable */ }
    const id = window.setTimeout(() => { setTimer(saved); setNow(Date.now()); }, 0);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearTimeout(id); window.clearInterval(tick); };
  }, [key]);
  const save = (v: Timer | null) => {
    setTimer(v);
    try { if (v) localStorage.setItem(key, JSON.stringify(v)); else localStorage.removeItem(key); } catch { /* storage unavailable */ }
  };

  const speakingId = timer?.talkId ?? s.talks.find((x) => a.att[x.id] === "speaking")?.id ?? null;
  const idx = speakingId ? s.talks.findIndex((x) => x.id === speakingId) : -1;
  const cur = idx >= 0 ? s.talks[idx] : null;
  const pending = s.talks.filter((x, i) => i > idx && !["presented", "no_show"].includes(a.att[x.id]));
  const nextTalk = pending[0] ?? null;
  const elapsed = timer && now ? (now - timer.startedAt) / 1000 : 0;
  const talkSec = cur ? cur.talkMin * 60 + (timer?.extra ?? 0) : 900;
  const inQa = elapsed >= talkSec;
  const color = !cur ? "#F5F6F3" : elapsed >= talkSec ? "#FF8A80" : elapsed >= talkSec - 120 ? "#F2A93B" : "#F5F6F3";

  const begin = (x: ChairTalk) => {
    if (cur && cur.id !== x.id) a.set(cur.id, "presented");
    a.set(x.id, "speaking");
    save({ talkId: x.id, startedAt: clock(), extra: 0 });
  };
  const advance = () => {
    if (nextTalk) begin(nextTalk);
    else { if (cur) a.set(cur.id, "presented"); save(null); }
  };
  const pushLive = (status: string, delay: number) => {
    const was = live;
    setLive({ status, delay });
    start(async () => {
      const r = await updateLive(s.id, status, delay);
      if (r.error) { setLive(was); setLiveErr(r.error); } else setLiveErr(null);
    });
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <section aria-live="polite" className="rounded-[10px] bg-[#0E1B3D] px-5 py-5 text-[#F5F6F3]">
        <p className="m-0 font-mono text-[11px] tracking-[0.06em] text-[#F2A93B]">{s.code.toUpperCase()} · {(s.room ?? "").toUpperCase()}</p>
        <p className="m-0 mt-1 text-[14px] text-[#B9C3DA]">{s.title}</p>
        {cur ? (
          <>
            <p className="m-0 mt-4 font-mono text-[11px] tracking-[0.06em] text-[#B9C3DA]">{t("Now speaking")}</p>
            <p className="m-0 mt-0.5 text-[17px] font-semibold">{cur.presenter ?? t("Presenter")}</p>
            <p className="m-0 text-[13px] text-[#B9C3DA]">{cur.number ? `#${cur.number} · ` : ""}{inQa ? t("questions") : t("talk")}</p>
            <div className="mt-2 font-mono text-[64px] font-semibold leading-none tabular-nums sm:text-[80px]" style={{ color }}>
              {inQa ? mmss(elapsed - talkSec) : mmss(elapsed)}
            </div>
            <p className="m-0 mt-1 text-[13px] text-[#B9C3DA]">{inQa ? t("of {t} questions", { t: mmss(cur.qaMin * 60) }) : t("of {t} talk", { t: mmss(talkSec) })}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => timer && save({ ...timer, extra: timer.extra + 60 })} className="h-11 rounded-[4px] border border-[#3A4A75] bg-transparent px-4 text-[15px] font-semibold text-[#F5F6F3]">{t("+1 min")}</button>
              <button type="button" onClick={advance} className="h-11 rounded-[4px] border-0 bg-[#F2A93B] px-5 text-[15px] font-semibold text-[#0E1B3D]">{nextTalk ? t("Next talk ›") : t("End session")}</button>
            </div>
          </>
        ) : (
          <div className="mt-4">
            <p className="m-0 text-[15px]">{nextTalk ? t("Ready when you are. The timer starts with the first talk.") : t("All talks are done.")}</p>
            {nextTalk ? <button type="button" onClick={() => begin(nextTalk)} className="mt-3 h-11 rounded-[4px] border-0 bg-[#F2A93B] px-5 text-[15px] font-semibold text-[#0E1B3D]">{t("Start {who}", { who: nextTalk.presenter ?? `#${nextTalk.number ?? 1}` })}</button> : null}
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-[#4A5263]">{t("Session status:")}</span>
        {([["on_time", "On time"], ["late", "Running late"], ["break", "Break"], ["done", "Done"]] as const).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={live.status === k} onClick={() => pushLive(k, k === "late" ? Math.max(live.delay, 5) : 0)}
            className={`h-9 rounded-full px-3 text-[13px] font-semibold ${live.status === k ? "border border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border border-[#DADDE3] bg-white text-[#4A5263]"}`}>{t(label)}</button>
        ))}
        {live.status === "late" ? (
          <span className="flex items-center gap-1">
            <button type="button" aria-label={t("5 minutes less")} onClick={() => pushLive("late", Math.max(5, live.delay - 5))} className="size-9 rounded-full border border-[#DADDE3] bg-white">−</button>
            <span className="min-w-[64px] text-center font-mono text-[13px]">{t("{n} min", { n: live.delay })}</span>
            <button type="button" aria-label={t("5 minutes more")} onClick={() => pushLive("late", Math.min(180, live.delay + 5))} className="size-9 rounded-full border border-[#DADDE3] bg-white">+</button>
          </span>
        ) : null}
        {liveErr ? <span role="alert" className="text-[13px] text-[#B3261E]">{t(liveErr)}</span> : null}
      </section>

      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {s.talks.map((x, i) => {
          const st = a.att[x.id];
          const [label, bg, ink] = ATT_LABEL[st] ?? ATT_LABEL.waiting;
          const done = st === "presented" || st === "no_show";
          return (
            <li key={x.id} className="flex flex-wrap items-center gap-3 rounded-[8px] border px-3.5 py-3" style={{ borderColor: x.id === speakingId ? "#0E1B3D" : "#DADDE3", background: done ? "#F7F8F6" : "#FFFFFF" }}>
              <span className="w-[46px] flex-none font-mono text-[13px] font-semibold">{fmtTime(talkStart(s.startsAt, s.talks, i), s.timezone, t.intl)}</span>
              <div className="min-w-0 flex-auto basis-[180px]">
                <div className="truncate text-[14px] font-semibold">{x.presenter ?? t("Presenter not named yet")}</div>
                <div className="truncate text-[12px] text-[#4A5263]">{x.number ? `#${x.number} · ` : ""}{x.title}</div>
              </div>
              <span className={ui.tag} style={{ background: bg, color: ink }}>{t(label).toUpperCase()}</span>
              {!done && x.id !== speakingId ? (
                <span className="flex gap-1.5">
                  {st !== "checked_in" ? <button type="button" onClick={() => a.set(x.id, "checked_in")} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-2.5 text-[12px] font-semibold">{t("Checked in")}</button> : null}
                  <button type="button" onClick={() => a.set(x.id, "no_show")} className="h-9 rounded-[4px] border border-[#F3C3BE] bg-white px-2.5 text-[12px] font-semibold text-[#B3261E]">{t("No-show")}</button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {s.roomTechnician ? <p className="m-0 text-[14px]">{t("Room technician: {name}", { name: s.roomTechnician })}</p> : null}
    </div>
  );
}
