"use client";

import Link from "@/components/site/link";
import { useActionState } from "react";
import { useT } from "@/lib/i18n/client";
import { saveBasics } from "@/lib/manage/setup-actions";
import { FieldError, SaveBar } from "@/components/manage/save-bar";
import { ui } from "@/components/manage/ui";
import type { ManageState } from "@/lib/manage/actions-util";

const ACCENTS: [string, string, string][] = [["navy", "Navy", "#0E1B3D"], ["saffron", "Saffron", "#F2A93B"], ["teal", "Teal", "#0F7C7A"], ["forest", "Forest", "#18744F"], ["crimson", "Crimson", "#9B1C31"], ["royal", "Royal", "#2F5FD0"]];

export type BasicsValues = { slug: string; name: string; short_name: string; tagline: string; website: string; accent: string; public_text: string; venue_address: string; hotels: string; contact_email: string; submit_url: string };

export function BasicsForm({ v, status, last, canEdit }: { v: BasicsValues; status: "not_started" | "in_progress" | "ready"; last: { at: string | null; by: string | null }; canEdit: boolean }) {
  const t = useT();
  const [state, action] = useActionState<ManageState, FormData>(saveBasics, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={v.slug} />
      <fieldset disabled={!canEdit} className="m-0 flex flex-col gap-5 border-0 p-0">
        <section className={ui.card}>
          <h2 className={ui.h2}>{t("Name")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr]">
            <label className={ui.label}>{t("Full name")}<input name="name" defaultValue={v.name} required className={ui.input} /><FieldError state={state} name="name" /></label>
            <label className={ui.label}>{t("Short name")}<input name="short_name" defaultValue={v.short_name} placeholder="CA 2027" className={ui.input} /></label>
            <label className={ui.label}>{t("Tagline")}<input name="tagline" defaultValue={v.tagline} placeholder={t("Control for a changing world")} className={ui.input} /></label>
            <label className={ui.label}>{t("Website")}<input name="website" defaultValue={v.website} placeholder="https://ca2027.org" className={ui.input} /><FieldError state={state} name="website" /></label>
          </div>
          <label className={`${ui.label} mt-4`}>{t("Submissions on another site")} <span className={ui.hint}>{t("Optional. If papers are submitted elsewhere (e.g. PaperCept), paste that link: every Submit button for this event opens it instead.")}</span>
            <input name="submit_url" defaultValue={v.submit_url} placeholder="https://controls.papercept.net/…" className={ui.input} /><FieldError state={state} name="submit_url" /></label>
        </section>

        <section className={ui.card}>
          <h2 className={ui.h2}>{t("Branding")}</h2>
          <fieldset className="m-0 mt-4 border-0 p-0">
            <legend className="p-0 text-[14px] font-medium">{t("Accent colour")} <span className={ui.hint}>· {t("Used on the public page only.")}</span></legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {ACCENTS.map(([k, label, hex]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 rounded-full border border-[#B7BDC9] bg-white py-1.5 pl-1.5 pr-3 text-[14px] has-[:checked]:border-[#0E1B3D] has-[:checked]:ring-2 has-[:checked]:ring-[#0E1B3D]">
                  <input type="radio" name="accent" value={k} defaultChecked={v.accent === k} className="sr-only" />
                  <span aria-hidden className="size-6 rounded-full" style={{ background: hex }} />{t(label)} <span className="font-mono text-[11px] text-[#4A5263]">{hex}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className={`${ui.label} mt-5`}>{t("Call for papers")} <span className={ui.hint}>{t("Shown at the top of the public venue page. Plain text with bold and links.")}</span>
            <textarea name="public_text" defaultValue={v.public_text} rows={8} className={ui.textarea} />
          </label>
        </section>

        <section className={ui.card}>
          <h2 className={ui.h2}>{t("Venue & contact")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={ui.label}>{t("Venue address")}<input name="venue_address" defaultValue={v.venue_address} placeholder={t("[Convention centre], [Street], [City]")} className={ui.input} /></label>
            <label className={ui.label}>{t("Hotels block")}<input name="hotels" defaultValue={v.hotels} placeholder={t("[Hotel A], [Hotel B] · code CA27")} className={ui.input} /></label>
            <label className={ui.label}>{t("Contact email")} <span className={ui.hint}>{t("Used as [venue.contact] in emails. Needed to go live.")}</span>
              <input name="contact_email" type="email" defaultValue={v.contact_email} placeholder="pc@ca2027.org" className={ui.input} /><FieldError state={state} name="contact_email" />
            </label>
          </div>
        </section>
      </fieldset>
      <p className="m-0 text-[14px]"><Link href={`/events/${v.slug}`} target="_blank">{t("Preview venue page")} ↗</Link></p>
      <SaveBar state={state} status={status} last={last} readOnly={!canEdit} />
    </form>
  );
}
