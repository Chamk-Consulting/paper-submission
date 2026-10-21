"use client";

import Link from "next/link";
import { useActionState, useMemo, useSyncExternalStore } from "react";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/config";
import { setLanguageCookie } from "@/lib/consent-client";
import { savePrefs, type AccountState } from "@/lib/account/actions";
import type { Prefs } from "@/lib/account/data";
import { sx } from "@/components/account/styles";
import { AccountSaveBar, FieldErr, useDirty } from "@/components/account/save-bar";

/* Canvas ST03 — Notifications & calendar. */

const EVENT_ROWS: [keyof Prefs["modes"], string, string][] = [
  ["review_invitation", "Review invitation", "An editor asks you to review"],
  ["review_due", "Review due soon", "Your review is due in 3 days"],
  ["coauthor_request", "Co-author request", "Someone adds you to a paper"],
  ["coauthor_changes", "Co-author changes", "A co-author edits a shared paper"],
  ["venue_announcements", "Venue announcements", "From venues you follow"],
  ["messages", "Messages", "From chairs, editors and co-authors"],
  ["new_calls", "New calls in my fields", "Open calls matching your topics"],
];
const REMINDERS: ["d7" | "d3" | "h24", string][] = [["d7", "7 days before"], ["d3", "3 days before"], ["h24", "24 hours before"]];

const radio = "m-0 size-[22px] cursor-pointer appearance-none rounded-full border-[1.5px] border-solid border-[#8A93A6] bg-white checked:border-[7px] checked:border-[#2F5FD0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]";
const th = "py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]";

const noopSubscribe = () => () => {};

function offsetLabel(tz: string) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName");
    return part ? part.value.replace("GMT", "UTC") : "";
  } catch { return ""; }
}

export function NotificationsForm({ prefs }: { prefs: Prefs }) {
  const t = useT();
  const current = useLocale();
  const { dirty, onChange, onSubmit } = useDirty();
  const [state, action] = useActionState<AccountState, FormData>(async (prev, fd) => {
    const r = await savePrefs(prev, fd);
    const next = r.value || "";
    if (r.ok && next && next !== current) {
      setLanguageCookie(next);
      window.location.reload();
    }
    return r;
  }, {});
  // Time-zone names, offsets and the browser's own zone differ between server and browser, so the
  // full list is built only after hydration (otherwise React #418).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const zones = useMemo(() => {
    if (!mounted) { const z = prefs.timezone || "UTC"; return [[z, z.replace(/_/g, " ")]] as const; }
    const list = Intl.supportedValuesOf("timeZone");
    if (prefs.timezone && !list.includes(prefs.timezone)) list.unshift(prefs.timezone);
    return list.map((z) => [z, `${z.replace(/_/g, " ")} (${offsetLabel(z)})`] as const);
  }, [prefs.timezone, mounted]);
  const guess = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  return (
    <form action={action} onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-[18px]">
      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Email me when…")}</h2>
        <table className="mt-3.5 w-full border-collapse text-[14px]">
          <thead>
            <tr><th scope="col" className={`${th} text-left`}>{t("Event")}</th><th scope="col" className={`${th} w-[90px] text-center`}>{t("Right away")}</th><th scope="col" className={`${th} w-[90px] text-center`}>{t("Daily digest")}</th></tr>
          </thead>
          <tbody>
            {EVENT_ROWS.map(([k, title, detail]) => (
              <tr key={k} className="border-t border-[#EEF0EC]">
                <th scope="row" className="py-2.5 text-left font-normal"><strong>{t(title)}</strong><span className="block text-[12px] text-[#4A5263]">{t(detail)}</span></th>
                <td className="py-2.5 text-center"><input type="radio" name={`mode_${k}`} value="now" defaultChecked={prefs.modes[k] !== "digest"} aria-label={`${t(title)}: ${t("Right away")}`} className={radio} /></td>
                <td className="py-2.5 text-center"><input type="radio" name={`mode_${k}`} value="digest" defaultChecked={prefs.modes[k] === "digest"} aria-label={`${t(title)}: ${t("Daily digest")}`} className={radio} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mb-0 mt-2.5 text-[13px] text-[#4A5263]">{t("Decisions, security alerts and deadline changes are always sent right away.")}</p>
      </section>

      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Deadline reminders")}</h2>
        <div className="mt-3.5 flex flex-col gap-2">
          {REMINDERS.map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-start gap-3 rounded-[6px] border border-[#DADDE3] bg-white px-3.5 py-3 has-[:checked]:border-[#B9E0CB] has-[:checked]:bg-[#F3FAF6]">
              <input type="checkbox" name={k} defaultChecked={prefs.reminders[k]} className="peer sr-only" />
              <span aria-hidden className="mt-px flex size-5 flex-none items-center justify-center rounded-[3px] border-[1.5px] border-[#8A93A6] bg-white text-[13px] font-bold text-white peer-checked:border-0 peer-checked:bg-[#18744F] peer-focus-visible:outline-2 peer-focus-visible:outline-[#2F5FD0] [&>span]:hidden peer-checked:[&>span]:inline"><span>✓</span></span>
              <span className="text-[14px]">{t(label)}</span>
            </label>
          ))}
        </div>
      </section>

      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Time zone and language")}</h2>
        <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
          <label className={sx.label}>{t("Time zone")}
            <select key={mounted ? "client" : "server"} name="timezone" defaultValue={prefs.timezone || guess} className={sx.input}>
              {zones.map(([z, l]) => <option key={z} value={z}>{l}</option>)}
            </select>
            <span className={sx.help}>{t("Deadlines show in AoE and in this zone.")}</span>
            <FieldErr state={state} name="timezone" />
          </label>
          <label className={sx.label}>{t("Language")}
            <select name="locale" defaultValue={prefs.locale || current} className={sx.input}>
              {LOCALES.map((l) => <option key={l} value={l} lang={l}>{LOCALE_NAMES[l]}</option>)}
            </select>
            <span className={sx.help}>{t("Used for the interface and for emails from Plenary.")}</span>
          </label>
        </div>
      </section>

      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Calendar feed")}</h2>
        <p className="mb-0 mt-3.5 text-[14px]">
          {prefs.hasFeed ? t("Your calendar feed is on.") : t("Your deadlines, reviews and sessions in one live calendar.")}{" "}
          <Link href="/settings/calendar" className="text-[#2F5FD0]">{prefs.hasFeed ? t("Manage it →") : t("Set it up →")}</Link>
        </p>
      </section>

      <AccountSaveBar state={state} dirty={dirty} />
    </form>
  );
}
