"use client";

import Link from "@/components/site/link";
import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { sendVenueMessage, toggleAnnouncements } from "@/lib/site/actions";
import { useWhen } from "@/components/site/due-next";

/* Canvas VN01 — My venue page: tabs, contacts with "Send message", announcement email toggle. */

export type WorkRow = { id: string; role: "AUTHOR" | "REVIEWER" | "ASSOC. EDITOR" | "CHAIR"; title: string; detail: string; at: string | null; href: string };
export type DeadlineRow = { id: string; label: string; who: string; at: string; mine: boolean };
export type ContactItem = { personId: string; name: string; role: string };
export type NewsItem = { id: string; title: string; body: string; by: string | null; at: string };

const PILL: Record<WorkRow["role"], [string, string]> = { AUTHOR: ["#E6EDFC", "#1F47A8"], REVIEWER: ["#FBEFDD", "#7A4508"], "ASSOC. EDITOR": ["#E1F3EA", "#14603F"], CHAIR: ["#E1F3EA", "#14603F"] };

export function VenueMeTabs({ venueId, work, news, deadlines, contacts, now }: { venueId: string; work: WorkRow[]; news: NewsItem[]; deadlines: DeadlineRow[]; contacts: ContactItem[]; now: number }) {
  const t = useT();
  const when = useWhen();
  const [tab, setTab] = useState<"overview" | "deadlines" | "contacts">("overview");
  const tabCls = (on: boolean) => `h-11 cursor-pointer border-0 border-b-[3px] bg-transparent px-1 text-[15px] font-semibold ${on ? "border-[#F2A93B] text-[#121826]" : "border-transparent text-[#4A5263] hover:text-[#121826]"}`;
  const date = (iso: string) => new Date(iso).toLocaleDateString(t.intl, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div>
      <div role="tablist" aria-label={t("Venue sections")} className="flex gap-6 border-b border-[#DADDE3]">
        <button type="button" role="tab" aria-selected={tab === "overview"} onClick={() => setTab("overview")} className={tabCls(tab === "overview")}>{t("Overview")}</button>
        <button type="button" role="tab" aria-selected={tab === "deadlines"} onClick={() => setTab("deadlines")} className={tabCls(tab === "deadlines")}>{t("My deadlines")}</button>
        <button type="button" role="tab" aria-selected={tab === "contacts"} onClick={() => setTab("contacts")} className={tabCls(tab === "contacts")}>{t("Contacts")}</button>
      </div>

      {tab === "overview" ? (
        <div className="mt-5 flex flex-col gap-5">
          <section className="rounded-[8px] border border-[#DADDE3] bg-white">
            <h2 className="m-0 px-5 pb-2 pt-4 font-serif text-[22px] font-normal">{t("My work at this venue")}</h2>
            {work.length ? (
              <ul className="m-0 list-none p-0">
                {work.map((w) => {
                  const [bg, ink] = PILL[w.role];
                  const tm = when(w.at, now);
                  return (
                    <li key={w.id} className="grid grid-cols-12 items-center gap-x-3 gap-y-1 border-t border-[#EEF0EC] px-5 py-3">
                      <span className="col-span-12 sm:col-span-2"><span className="inline-flex rounded-[3px] px-1.5 py-px font-mono text-[11px] font-medium uppercase tracking-[0.04em]" style={{ background: bg, color: ink }}>{t(w.role)}</span></span>
                      <Link href={w.href} className="col-span-12 min-w-0 text-[#121826] no-underline hover:underline sm:col-span-7">
                        <span className="block truncate font-medium">{w.title}</span>
                        <span className="block truncate text-[13px] text-[#4A5263]">{t(w.detail)}</span>
                      </Link>
                      <span className={`col-span-12 text-[13px] sm:col-span-3 sm:text-right ${tm.soon ? "font-semibold text-[#A8600F]" : "text-[#4A5263]"}`} suppressHydrationWarning>{w.at ? tm.text : ""}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="m-0 border-t border-[#EEF0EC] px-5 py-6 text-[#4A5263]">{t("Nothing for you here yet.")}</p>}
          </section>
          <section className="rounded-[8px] border border-[#DADDE3] bg-white p-5">
            <h2 className="m-0 font-serif text-[22px] font-normal">{t("Announcements")}</h2>
            {news.length ? (
              <ul className="m-0 mt-2 list-none p-0">
                {news.map((n) => (
                  <li key={n.id} className="border-b border-[#EEF0EC] py-3 last:border-b-0">
                    <details className="group">
                      <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">{n.title}</summary>
                      <p className="mb-1 mt-1.5 whitespace-pre-line text-[14px] leading-[1.6] text-[#4A5263]">{n.body}</p>
                    </details>
                    <span className="text-[13px] text-[#4A5263]" suppressHydrationWarning>{[n.by, date(n.at)].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mb-0 mt-2 text-[14px] text-[#4A5263]">{t("No announcements yet.")}</p>}
          </section>
        </div>
      ) : null}

      {tab === "deadlines" ? (
        <section className="mt-5 rounded-[8px] border border-[#DADDE3] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 font-serif text-[22px] font-normal">{t("Deadlines that apply to you")}</h2>
            <Link href="/workspace/settings/calendar" className="inline-flex h-9 items-center rounded-[4px] border border-[#B7BDC9] px-3 text-[13px] font-medium text-[#121826] no-underline">{t("Add to calendar")}</Link>
          </div>
          {deadlines.length ? (
            <ul className="m-0 mt-3 list-none p-0">
              {deadlines.map((d) => {
                const tm = when(d.at, now);
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 border-b border-[#EEF0EC] py-3 last:border-b-0">
                    <span aria-hidden className={`size-2.5 flex-none rounded-full ${d.mine ? "bg-[#F2A93B]" : "bg-[#DADDE3]"}`} />
                    <span className="min-w-0 flex-auto"><span className="block font-medium">{d.label}</span><span className="block text-[13px] text-[#4A5263]">{t(d.who)}</span></span>
                    <span className={`text-[13px] ${tm.soon ? "font-semibold text-[#A8600F]" : "text-[#4A5263]"}`} suppressHydrationWarning>{tm.text}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="mb-0 mt-3 text-[14px] text-[#4A5263]">{t("No upcoming deadlines.")}</p>}
        </section>
      ) : null}

      {tab === "contacts" ? (
        <section className="mt-5 rounded-[8px] border border-[#DADDE3] bg-white p-5">
          <h2 className="m-0 font-serif text-[22px] font-normal">{t("Who to contact")}</h2>
          <p className="mb-0 mt-1 text-[14px] text-[#4A5263]">{t("Messages go to their Plenary inbox. For problems with Plenary itself,")} <Link href="/contact" className="text-[#2F5FD0]">{t("contact support")}</Link>.</p>
          {contacts.length ? (
            <ul className="m-0 mt-3 list-none p-0">{contacts.map((c) => <ContactRow key={`${c.role}-${c.personId}`} venueId={venueId} c={c} />)}</ul>
          ) : <p className="mb-0 mt-3 text-[14px] text-[#4A5263]">{t("The organizers haven’t listed contacts yet.")}</p>}
        </section>
      ) : null}
    </div>
  );
}

function ContactRow({ venueId, c }: { venueId: string; c: ContactItem }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <li className="border-b border-[#EEF0EC] py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span><span className="block font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t(c.role)}</span><span className="font-medium">{c.name}</span></span>
        <button type="button" onClick={() => { setOpen(!open); setMsg(null); }} aria-expanded={open} className="inline-flex h-9 cursor-pointer items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-medium text-[#121826] hover:bg-[#F7F8F6]">{t("Send message")}</button>
      </div>
      {open ? (
        <form className="mt-3 flex flex-col gap-2.5" action={(fd) => start(async () => {
          const r = await sendVenueMessage({ venue: venueId, person: c.personId, subject: String(fd.get("subject") ?? ""), body: String(fd.get("body") ?? "") });
          setMsg({ ok: r.ok, text: r.ok ? t("Sent. The reply will arrive in your inbox.") : t(r.message ?? "Couldn’t send. Try again.") });
          if (r.ok) setOpen(false);
        })}>
          <label className="flex flex-col gap-1 text-[13px] font-medium">{t("Subject")}<input name="subject" required maxLength={200} className="h-10 rounded-[4px] border border-[#B7BDC9] px-3 text-[14px] font-normal" /></label>
          <label className="flex flex-col gap-1 text-[13px] font-medium">{t("Message")}<textarea name="body" required rows={4} maxLength={4000} className="rounded-[4px] border border-[#B7BDC9] px-3 py-2 text-[14px] font-normal" /></label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="inline-flex h-9 cursor-pointer items-center rounded-[4px] border-0 bg-[#0E1B3D] px-3.5 text-[13px] font-semibold text-white disabled:opacity-60">{pending ? t("Sending…") : t("Send")}</button>
            <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 cursor-pointer items-center rounded-[4px] border-0 bg-transparent px-2 text-[13px] text-[#4A5263]">{t("Cancel")}</button>
          </div>
        </form>
      ) : null}
      {msg ? <p role="status" className={`mb-0 mt-2 text-[13px] ${msg.ok ? "text-[#14603F]" : "text-[#B3261E]"}`}>{msg.text}</p> : null}
    </li>
  );
}

export function AnnouncementToggle({ venueId, initial }: { venueId: string; initial: boolean }) {
  const t = useT();
  const [on, setOn] = useState(initial);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="rounded-[8px] border border-[#DADDE3] bg-white p-5">
      <h2 className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("Following")}</h2>
      <label className="mt-2.5 flex items-start gap-2.5 text-[14px]">
        <input type="checkbox" checked={on} disabled={pending} className="mt-0.5 size-[18px] flex-none accent-[#0E1B3D]"
          onChange={(e) => { const v = e.target.checked; setOn(v); setErr(""); start(async () => { const r = await toggleAnnouncements(venueId, v); if (!r.ok) { setOn(!v); setErr(t(r.message ?? "Couldn’t save that. Try again.")); } }); }} />
        <span>{t("Email me venue announcements")}<span className="block text-[13px] text-[#4A5263]">{t("They always appear in your Plenary inbox too.")}</span></span>
      </label>
      {err ? <p role="alert" className="mb-0 mt-2 text-[13px] text-[#B3261E]">{err}</p> : null}
    </section>
  );
}

export function NextDeadline({ label, at, now }: { label: string; at: string; now: number }) {
  const t = useT();
  const ms = Math.max(0, Date.parse(at) - now);
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 3600e3);
  const aoe = new Date(Date.parse(at) - 12 * 3600e3);
  const day = aoe.toLocaleDateString(t.intl, { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <section className="rounded-[8px] bg-[#0E1B3D] p-5 text-[#F5F6F3]">
      <h2 className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#F2A93B]">{t("Next deadline")}</h2>
      <p className="mb-0 mt-2 font-serif text-[40px] leading-none" suppressHydrationWarning>{t("{d}d {h}h", { d, h })}</p>
      <p className="mb-0 mt-2 text-[14px] text-[#D6DCEA]" suppressHydrationWarning>{label} · {day} {String(aoe.getUTCHours()).padStart(2, "0")}:{String(aoe.getUTCMinutes()).padStart(2, "0")} AoE</p>
    </section>
  );
}
