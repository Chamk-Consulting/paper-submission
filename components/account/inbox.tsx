"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { archiveThread, markThreadRead, replyToThread, type AccountState } from "@/lib/account/actions";
import type { InboxRow, ThreadMessage } from "@/lib/account/data";

/* Canvas IN01 — Inbox: filters + thread list on the left, the open thread on the right. */

const FILTERS: [string, string, string[]][] = [
  ["all", "All", []], ["decision", "Decisions", ["decision"]], ["invite", "Invitations", ["invite"]],
  ["coauthor", "Co-authors", ["coauthor"]], ["venue", "Venues", ["venue", "message"]], ["account", "Account", ["system", "support"]],
  ["archived", "Archived", []],
];
const KIND_TAG: Record<string, [string, string, string]> = {
  decision: ["DECISION", "#E1F3EA", "#14603F"], invite: ["INVITATION", "#E6EDFC", "#1F47A8"], coauthor: ["CO-AUTHOR", "#FBEFDD", "#7A4508"],
  venue: ["ANNOUNCEMENT", "#EEF0EC", "#4A5263"], message: ["MESSAGE", "#EEF0EC", "#4A5263"], system: ["PLENARY", "#EEF0EC", "#4A5263"], support: ["SUPPORT", "#EEF0EC", "#4A5263"],
};

function useWhen() {
  const t = useT();
  const day = new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short" });
  const time = new Intl.DateTimeFormat(t.intl, { hour: "2-digit", minute: "2-digit" });
  const full = new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return {
    short: (iso: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      return d.toDateString() === new Date().toDateString() ? time.format(d) : day.format(d);
    },
    full: (iso: string) => full.format(new Date(iso)),
  };
}

export function InboxList({ rows, selected }: { rows: InboxRow[]; selected: string | null }) {
  const t = useT();
  const when = useWhen();
  const params = useSearchParams();
  const f = FILTERS.some(([k]) => k === params.get("f")) ? params.get("f")! : "all";
  const kinds = FILTERS.find(([k]) => k === f)?.[2] ?? [];
  const list = rows.filter((r) => (f === "archived" ? r.archived : !r.archived && (!kinds.length || kinds.includes(r.kind))));
  const unread = rows.filter((r) => r.unread && !r.archived).length;
  const qs = f === "all" ? "" : `?f=${f}`;

  return (
    <div className={`${selected ? "hidden md:flex" : "flex"} w-full flex-col border-[#DADDE3] md:w-[380px] md:flex-none md:border-r`}>
      <div className="flex flex-wrap gap-1.5 border-b border-[#DADDE3] p-3" role="group" aria-label={t("Filter messages")}>
        {FILTERS.map(([k, label]) => {
          const on = f === k;
          return (
            <Link key={k} href={`${selected ? `/inbox/${selected}` : "/inbox"}${k === "all" ? "" : `?f=${k}`}`} aria-pressed={on} scroll={false}
              className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-semibold no-underline ${on ? "border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#4A5263] hover:border-[#B7BDC9]"}`}>
              {t(label)}{k === "all" && unread ? ` · ${unread}` : ""}
            </Link>
          );
        })}
      </div>
      {list.length === 0 ? (
        <p className="m-0 px-[18px] py-6 text-[14px] text-[#4A5263]">{f === "all" ? t("No messages yet. Chairs, editors and co-authors reach you here.") : t("Nothing here.")}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {list.map((r) => {
            const on = r.thread_id === selected;
            return (
              <li key={r.thread_id}>
                <Link href={`/inbox/${r.thread_id}${qs}`} aria-current={on ? "page" : undefined} scroll={false}
                  className={`flex gap-2.5 border-b border-l-[3px] border-b-[#EEF0EC] px-3.5 py-3 text-[#121826] no-underline ${on ? "border-l-[#2F5FD0] bg-[#F3F6FD]" : "border-l-transparent bg-white hover:bg-[#FAFBFC]"}`}>
                  <span aria-hidden className={`mt-[7px] size-2 flex-none rounded-full ${r.unread ? "bg-[#F2A93B]" : "bg-transparent"}`} />
                  <span className="min-w-0 flex-auto">
                    <span className="flex justify-between gap-2">
                      <span className={`truncate text-[14px] ${r.unread ? "font-semibold" : ""}`}>{r.last_from ?? r.venue ?? "Plenary"}</span>
                      <span suppressHydrationWarning className="whitespace-nowrap font-mono text-[11px] text-[#4A5263]">{when.short(r.last_at)}</span>
                    </span>
                    <span className={`block truncate text-[13px] ${r.unread ? "font-semibold" : ""}`}>{r.unread ? <span className="sr-only">{t("Unread")}: </span> : null}{r.subject}</span>
                    <span className="block truncate text-[12px] text-[#4A5263]">{r.last_body}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ThreadView({ row, messages }: { row: InboxRow; messages: ThreadMessage[] }) {
  const t = useT();
  const when = useWhen();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, sending] = useActionState<AccountState, FormData>(async (prev, fd) => {
    const r = await replyToThread(prev, fd);
    if (r.ok) formRef.current?.reset();
    return r;
  }, {});
  const [err, setErr] = useState<string | null>(null);
  const [tag, bg, ink] = KIND_TAG[row.kind] ?? KIND_TAG.message;
  const last = messages.at(-1);
  const other = [...messages].reverse().find((m) => !m.is_me)?.sender ?? row.last_from ?? "Plenary";
  const cta = [...messages].reverse().find((m) => m.cta_url && m.cta_label);

  // Opening a thread marks it read (server action; no local state involved).
  const marked = useRef<string | null>(null);
  useEffect(() => {
    if (row.unread && marked.current !== row.thread_id) {
      marked.current = row.thread_id;
      void markThreadRead(row.thread_id, true).then(() => router.refresh());
    }
  }, [row.thread_id, row.unread, router]);

  const qs = params.get("f") ? `?f=${params.get("f")}` : "";
  const run = (fn: () => Promise<AccountState>, after?: () => void) => start(async () => { const r = await fn(); setErr(r.error ?? null); if (!r.error) after?.(); });

  return (
    <article aria-labelledby="thread-subject" className="flex min-w-0 flex-auto flex-col">
      <div className="border-b border-[#DADDE3] px-6 py-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Link href={`/inbox${qs}`} className="mr-1 text-[13px] text-[#2F5FD0] md:hidden">← {t("Inbox")}</Link>
            <span className="rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]" style={{ background: bg, color: ink }}>{t(tag)}</span>
            {row.venue ? <span className="text-[13px] text-[#4A5263]">{row.venue}</span> : null}
          </span>
          <span className="flex gap-3">
            <button type="button" disabled={pending} onClick={() => run(() => markThreadRead(row.thread_id, false), () => router.push(`/inbox${qs}`))} className="border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline disabled:opacity-60">{t("Mark unread")}</button>
            <button type="button" disabled={pending} onClick={() => run(() => archiveThread(row.thread_id, !row.archived), () => { router.push(`/inbox${qs}`); router.refresh(); })} className="border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline disabled:opacity-60">{row.archived ? t("Move to inbox") : t("Archive")}</button>
          </span>
        </div>
        <h2 id="thread-subject" className="mb-0 mt-2 font-serif text-[26px] font-normal leading-tight">{row.subject}</h2>
        {last ? <p className="mb-0 mt-1 text-[13px] text-[#4A5263]">{t("From")} <strong className="text-[#121826]">{other}</strong> · <span suppressHydrationWarning>{when.full(last.created_at)}</span></p> : null}
        {err ? <p role="alert" className="mb-0 mt-2 text-[13px] text-[#B3261E]">{t(err)}</p> : null}
      </div>

      <div className="flex-auto px-6 py-5 text-[15px] leading-[1.65]">
        {messages.map((m, i) => (
          <div key={m.id} className={i ? "mt-5 border-t border-[#EEF0EC] pt-5" : ""}>
            {messages.length > 1 ? <p className="mb-1.5 mt-0 text-[13px] text-[#4A5263]"><strong className="text-[#121826]">{m.is_me ? t("You") : m.sender}</strong> · <span suppressHydrationWarning>{when.full(m.created_at)}</span></p> : null}
            {m.body.split(/\n{2,}/).map((p, k) => <p key={k} className={`${k ? "mt-3" : "mt-0"} mb-0 whitespace-pre-line`}>{p}</p>)}
          </div>
        ))}
        {cta?.cta_url ? <Link href={cta.cta_url} className="mt-4 inline-flex h-[38px] items-center rounded-[4px] bg-[#F2A93B] px-4 text-[13px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{cta.cta_label}</Link> : null}
      </div>

      <div className="border-t border-[#DADDE3] bg-[#FBFBF9] px-6 py-4">
        {row.reply_allowed ? (
          <form ref={formRef} action={action}>
            <input type="hidden" name="thread" value={row.thread_id} />
            <label htmlFor="reply" className="text-[13px] font-semibold">{t("Reply to {name}", { name: other })}</label>
            <textarea id="reply" name="body" rows={3} required maxLength={20000} className="mt-1.5 box-border w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 py-2.5 text-[14px] text-[#121826]" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-[#4A5263]">{t("Replies are kept with the paper's history.")}</span>
              <button type="submit" disabled={sending} className="inline-flex h-9 items-center rounded-[4px] border-0 bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white disabled:opacity-60">{sending ? t("Sending…") : t("Send")}</button>
            </div>
            {state.error || state.fieldErrors?.body ? <p role="alert" className="mb-0 mt-2 text-[13px] text-[#B3261E]">{t(state.error ?? state.fieldErrors?.body ?? "")}</p> : null}
            {state.ok ? <div role="status" className="mt-2 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3 py-2.5 text-[13px] text-[#0F3B27]">{t("Sent.")}</div> : null}
          </form>
        ) : (
          <p className="m-0 text-[13px] text-[#4A5263]">{t("This is an automatic message — replies are not possible.")}</p>
        )}
      </div>
    </article>
  );
}
