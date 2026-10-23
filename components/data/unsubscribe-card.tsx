"use client";

import Link from "@/components/site/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { saveUnsub, setUnsub, type UnsubInfo } from "@/lib/data/unsub";

/* Canvas UN01 — opening the link unsubscribes (done in the browser, so link scanners that only fetch the page don't). */

const primary = "inline-flex h-[42px] items-center justify-center rounded-[4px] border-0 bg-[#F2A93B] px-[18px] text-[15px] font-semibold text-[#0E1B3D] hover:bg-[#E89B26] disabled:opacity-60";
const ghost = "inline-flex h-[42px] items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60";

type Extra = "all_announcements" | "product_news" | "review_invitations";

function Box({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onToggle}
      className={`flex w-full items-start gap-3 rounded-[6px] border px-3.5 py-3 text-left text-[#121826] ${on ? "border-[#B9E0CB] bg-[#F3FAF6]" : "border-[#DADDE3] bg-white"}`}>
      <span aria-hidden className={`mt-px box-border flex size-5 flex-none items-center justify-center rounded-[3px] text-[13px] font-bold text-white ${on ? "bg-[#18744F]" : "border-[1.5px] border-[#8A93A6] bg-white"}`}>{on ? "✓" : ""}</span>
      <span className="text-[14px]">{children}</span>
    </button>
  );
}

export function UnsubscribeCard({ token, initial }: { token: string; initial: UnsubInfo }) {
  const t = useT();
  const [info, setInfo] = useState(initial);
  const [choice, setChoice] = useState<Record<Extra, boolean>>({ all_announcements: initial.all_announcements, product_news: initial.product_news, review_invitations: initial.review_invitations });
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const did = useRef(false);

  useEffect(() => {
    if (did.current || initial.main) return;
    did.current = true;
    start(async () => {
      const r = await setUnsub(token, "main", true);
      if (r.info) setInfo(r.info); else setMsg({ error: r.error });
    });
  }, [token, initial.main]);

  const out = info.main || (!msg.error && !initial.main && pending);
  const what = info.category === "review_invitations" ? t("review invitations from {venue}", { venue: info.venue ?? "" }) : t("announcements from {venue}", { venue: info.venue ?? t("this venue") });
  const toggle = (k: Extra) => { setChoice((c) => ({ ...c, [k]: !c[k] })); setMsg({}); };

  return (
    <section className="rounded-[8px] border border-[#DADDE3] bg-white p-6 sm:p-8">
      {out ? (
        <div className="flex items-start gap-3.5">
          <span aria-hidden className="flex size-10 flex-none items-center justify-center rounded-full bg-[#E1F3EA] font-bold text-[#14603F]">✓</span>
          <div>
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Email preferences")}</p>
            <h1 className="mb-0 mt-1 font-serif text-[34px] font-normal leading-[1.15]">{t("You're unsubscribed")}</h1>
            <p className="mb-0 mt-1.5 text-[#4A5263]">{t("{email} will no longer get", { email: info.email ?? t("Your address") })} <strong className="text-[#121826]">{what}</strong>.</p>
          </div>
        </div>
      ) : (
        <div>
          <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Email preferences")}</p>
          <h1 className="mb-0 mt-1 font-serif text-[34px] font-normal leading-[1.15]">{t("You're subscribed again")}</h1>
          <p className="mb-0 mt-1.5 text-[#4A5263]">{t("You will get {what} as before.", { what })}</p>
        </div>
      )}

      <p className="mb-2 mt-6 text-[13px] font-semibold">{t("Stop more?")}</p>
      <div className="flex flex-col gap-2">
        <Box on={choice.all_announcements} onToggle={() => toggle("all_announcements")}>{t("Announcements and calls for papers from every venue")}</Box>
        <Box on={choice.product_news} onToggle={() => toggle("product_news")}>{t("Product news from Plenary")} <span className="text-[#4A5263]">{t("(about once a month)")}</span></Box>
        {info.venue ? (
          <Box on={choice.review_invitations} onToggle={() => toggle("review_invitations")}>
            {t("Review invitations from {venue}", { venue: info.venue })}
            <span className="block text-[13px] text-[#4A5263]">{t("You can still be invited by other venues.")}</span>
          </Box>
        ) : null}
      </div>

      <div className="mt-5 rounded-[6px] bg-[#F7F8F6] px-3.5 py-3 text-[14px]">
        <strong>{t("You'll still get")}</strong> {t("emails you need: sign-in codes, receipts, decisions on your papers and reminders for reviews you accepted. These can't be turned off.")}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending} className={primary} onClick={() => start(async () => {
          const r = await saveUnsub(token, choice);
          if (r.info) { setInfo(r.info); setMsg({ ok: t("Saved.") }); } else setMsg({ error: r.error });
        })}>{t("Save")}</button>
        <button type="button" disabled={pending} className={ghost} onClick={() => start(async () => {
          const r = await setUnsub(token, "main", !info.main);
          if (r.info) { setInfo(r.info); setMsg({}); } else setMsg({ error: r.error });
        })}>{info.main ? t("Undo — keep getting these emails") : t("Unsubscribe again")}</button>
        <span role="status" className={`text-[13px] ${msg.error ? "text-[#B3261E]" : "text-[#14603F]"}`}>{msg.error ? t(msg.error) : msg.ok ?? ""}</span>
      </div>
      <p className="mb-0 mt-5 text-[13px] text-[#4A5263]">
        {t("No need to sign in on this page. To change every email setting,")} <Link href="/workspace/settings/notifications" className="text-[#2F5FD0]">{t("open notification settings")}</Link>.
      </p>
    </section>
  );
}
