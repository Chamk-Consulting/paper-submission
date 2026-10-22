"use client";

import Link from "@/components/site/link";
import { useActionState } from "react";
import { useT } from "@/lib/i18n/client";
import { savePrefs, type AccountState } from "@/lib/account/actions";
import type { NotifyEvent, Prefs } from "@/lib/account/data";
import { sx } from "@/components/account/styles";
import { AccountSaveBar, useDirty } from "@/components/account/save-bar";

/* Settings › Notifications: which emails you get and when. The Plenary inbox always gets a copy. */

const GROUPS: [string, [NotifyEvent, string, string][]][] = [
  ["Your papers", [
    ["coauthor_request", "Co-author request", "Someone adds you as an author of a paper"],
    ["coauthor_changes", "Changes to a shared paper", "A co-author edits, revises or withdraws it"],
    ["paper_steps", "Next steps on your papers", "A rebuttal or final-version step opens"],
  ]],
  ["Reviewing", [
    ["review_invitation", "Review invitation", "An editor asks you to review a paper"],
    ["review_due", "Review due soon", "A review you accepted is due in 3 days"],
  ]],
  ["Events", [
    ["venue_announcements", "Announcements", "From events you take part in or follow"],
    ["program_changes", "Changes to your talk or session", "New time, room or chair"],
    ["new_calls", "New calls in your topics", "Open calls for papers matching your review topics"],
  ]],
  ["Messages", [
    ["messages", "Messages", "From chairs, editors and co-authors"],
  ]],
];
const MODES: ["now" | "digest" | "off", string][] = [["now", "Right away"], ["digest", "Daily digest"], ["off", "Off"]];
const ALWAYS = ["Decisions on your papers", "Security alerts and sign-in codes", "Deadline changes", "Receipts and invoices"];
const REMINDERS: ["d7" | "d3" | "h24", string][] = [["d7", "7 days before"], ["d3", "3 days before"], ["h24", "24 hours before"]];
const SCOPE: ["papers" | "reviews" | "followed", string][] = [["papers", "Your papers"], ["reviews", "Your reviews"], ["followed", "Events you follow"]];

const radio = "m-0 size-[20px] cursor-pointer appearance-none rounded-full border-[1.5px] border-solid border-[#8A93A6] bg-white checked:border-[6px] checked:border-[#2F5FD0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]";
const th = "py-1.5 text-[12px] font-semibold text-[#4A5263]";

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-[6px] border border-[#DADDE3] bg-white px-3 py-2.5 text-[14px] has-[:checked]:border-[#B9E0CB] has-[:checked]:bg-[#F3FAF6]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-[18px] flex-none accent-[#14603F]" />
      {label}
    </label>
  );
}

export function NotificationsForm({ prefs }: { prefs: Prefs }) {
  const t = useT();
  const { dirty, onChange, onSubmit } = useDirty();
  const [state, action] = useActionState<AccountState, FormData>(savePrefs, {});
  return (
    <form action={action} onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-[18px]">
      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Email me about…")}</h2>
        <p className={sx.sub + " text-[13px]"}>
          {t("Sent to {email}.", { email: prefs.email })}{" "}
          <Link href="/settings/security" className="text-[#2F5FD0]">{t("Change it in Security")}</Link>
          {" · "}{t("Everything also arrives in your Plenary inbox, even when email is off.")}
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[14px]">
            <thead>
              <tr>
                <th scope="col" className={`${th} text-start`}><span className="sr-only">{t("Email about")}</span></th>
                {MODES.map(([m, l]) => <th key={m} scope="col" className={`${th} w-[92px] text-center`}>{t(l)}</th>)}
              </tr>
            </thead>
            {GROUPS.map(([group, rows]) => (
              <tbody key={group}>
                <tr><th scope="colgroup" colSpan={4} className="pb-1 pt-4 text-start text-[13px] font-semibold text-[#121826]">{t(group)}</th></tr>
                {rows.map(([k, title, detail]) => (
                  <tr key={k} className="border-t border-[#EEF0EC]">
                    <th scope="row" className="py-2.5 pe-3 text-start font-normal">
                      <span className="font-medium">{t(title)}</span>
                      <span className="block text-[12px] text-[#4A5263]">{t(detail)}</span>
                    </th>
                    {MODES.map(([m, l]) => (
                      <td key={m} className="py-2.5 text-center">
                        <input type="radio" name={`mode_${k}`} value={m} defaultChecked={prefs.modes[k] === m} aria-label={`${t(title)}: ${t(l)}`} className={radio} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="mb-0 mt-3 text-[13px] text-[#4A5263]">{t("Daily digests are being set up. Until then, emails set to Daily digest arrive right away.")}</p>
      </section>

      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Always sent")}</h2>
        <p className={sx.sub + " text-[13px]"}>{t("These can’t be switched off, because missing them could cost you a paper or your account.")}</p>
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0">
          {ALWAYS.map((x) => <li key={x} className="rounded-full bg-[#EEF0EC] px-3 py-1 text-[13px] text-[#121826]">{t(x)}</li>)}
        </ul>
      </section>

      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Deadline reminders")}</h2>
        <p className={sx.sub + " text-[13px]"}>{t("When to remind you")}</p>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
          {REMINDERS.map(([k, l]) => <Check key={k} name={k} label={t(l)} defaultChecked={prefs.reminders[k]} />)}
        </div>
        <p className={sx.sub + " mt-4 text-[13px]"}>{t("For which deadlines")}</p>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
          {SCOPE.map(([k, l]) => <Check key={k} name={k} label={t(l)} defaultChecked={prefs.reminders[k]} />)}
        </div>
      </section>

      <AccountSaveBar state={state} dirty={dirty} />
    </form>
  );
}
