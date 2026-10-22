"use client";

import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client";
import { createEvent } from "@/lib/manage/setup1-actions";
import { ui } from "@/components/manage/ui";
import { RadioCards } from "@/components/manage/setup1/bits";
import type { ManageState } from "@/lib/manage/actions-util";

/* EM01 — create an event: type, name and dates, optionally copy settings from an earlier event. */

const TYPES = [
  { value: "conference", title: "Conference", desc: "Papers, reviews, sessions, proceedings" },
  { value: "workshop", title: "Workshop", desc: "Smaller; often single round, no proceedings" },
  { value: "journal", title: "Journal", desc: "Rolling submissions, revision rounds" },
];
const FORMATS = [
  { value: "in_person", title: "In person" },
  { value: "hybrid", title: "Hybrid", desc: "Some talks remote" },
  { value: "online", title: "Online" },
];
const SPONSORS = ["IEEE Control Systems Society", "IEEE Robotics and Automation Society", "IFAC", "None / independent"];
const COPY: [string, string, string | null, boolean][] = [
  ["c_dates", "Dates shifted by one year", null, true],
  ["c_types", "Submission types, form and PDF rules", null, true],
  ["c_review", "Review form and settings", null, true],
  ["c_emails", "Email templates", null, true],
  ["c_committee", "Committee — as new invitations", "People must accept again (K1)", true],
  ["c_program", "Rooms and program format", null, false],
];

export type PastEvent = { id: string; label: string; detail: string };

function Submit() {
  const t = useT();
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={ui.primary}>{pending ? t("Creating…") : t("Create event and open setup →")}</button>;
}

export function CreateEventForm({ past }: { past: PastEvent[] }) {
  const t = useT();
  const [state, action] = useActionState<ManageState, FormData>(createEvent, {});
  const [from, setFrom] = useState("");
  const fe = (k: string) => (state.fieldErrors?.[k] ? <span data-form-error className="text-[13px] font-normal text-[#B3261E]">{t(state.fieldErrors[k])}</span> : null);
  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? <p role="alert" className={`m-0 ${ui.bad}`}>{t(state.error)}</p> : null}
      <section className={ui.card}>
        <h2 className={ui.h2}>1 · {t("What kind of event?")}</h2>
        <div className="mt-4"><RadioCards name="kind" options={TYPES} defaultValue="conference" /></div>
      </section>

      <section className={ui.card}>
        <h2 className={ui.h2}>2 · {t("Name and dates")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={ui.label}>{t("Full name")}<input name="name" required minLength={3} placeholder={t("Conference on Control and Automation")} className={ui.input} />{fe("name")}</label>
          <label className={ui.label}>{t("Short name")}<input name="short_name" placeholder="CA 2027" maxLength={40} className={ui.input} />{fe("short_name")}</label>
          <label className={ui.label}>{t("Sponsor")}
            <select name="sponsor" className={ui.input} defaultValue={SPONSORS[0]}>{SPONSORS.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={ui.label}>{t("First day")}<input name="starts_on" type="date" className={ui.input} /></label>
            <label className={ui.label}>{t("Last day")}<input name="ends_on" type="date" className={ui.input} />{fe("ends_on")}</label>
          </div>
        </div>
        <p className="mb-2 mt-5 text-[14px] font-medium">{t("Format")}</p>
        <RadioCards name="format" options={FORMATS} defaultValue="in_person" />
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_2fr]">
          <label className={ui.label}>{t("City")}<input name="city" placeholder="[City]" className={ui.input} /></label>
          <label className={ui.label}>{t("Country")}<input name="country" placeholder="[Country]" className={ui.input} /></label>
          <label className={ui.label}>{t("Venue")}<input name="location" placeholder={t("[Convention centre]")} className={ui.input} /></label>
        </div>
      </section>

      <section className={ui.card}>
        <h2 className={ui.h2}>3 · {t("Start from last year?")}</h2>
        <p className="mb-0 mt-1 text-[#4A5263]">{t("Copying settings saves most of the setup work.")}</p>
        <div role="radiogroup" className="mt-4 flex flex-col gap-2">
          {past.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-[#DADDE3] px-3.5 py-3 has-[:checked]:border-[#0E1B3D] has-[:checked]:bg-[#F7F8F6]">
              <input type="radio" name="copy_from" value={p.id} checked={from === p.id} onChange={() => setFrom(p.id)} className="size-4 accent-[#0E1B3D]" />
              <span><strong>{p.label}</strong> <span className="text-[13px] text-[#4A5263]">· {p.detail}</span></span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-[#DADDE3] px-3.5 py-3 has-[:checked]:border-[#0E1B3D] has-[:checked]:bg-[#F7F8F6]">
            <input type="radio" name="copy_from" value="" checked={from === ""} onChange={() => setFrom("")} className="size-4 accent-[#0E1B3D]" />
            <strong>{t("Start empty")}</strong>
          </label>
        </div>
        {from ? (
          <fieldset className="m-0 mt-4 flex flex-col gap-2 rounded-[8px] border border-[#EEF0EC] bg-[#F7F8F6] p-3.5">
            <legend className="sr-only">{t("What to copy")}</legend>
            {COPY.map(([name, label, hint, on]) => (
              <label key={name} className="flex cursor-pointer items-start gap-2.5 text-[14px]">
                <input type="checkbox" name={name} defaultChecked={on} className="mt-0.5 size-4 accent-[#0E1B3D]" />
                <span>{t(label)}{hint ? <span className="block text-[13px] text-[#4A5263]">{t(hint)}</span> : null}</span>
              </label>
            ))}
            <p className="m-0 mt-1 text-[13px] text-[#4A5263]">{t("Papers, reviews and decisions are never copied.")}</p>
          </fieldset>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href="/manage" className={ui.ghost}>{t("Cancel")}</Link>
        <Submit />
      </div>
    </form>
  );
}
