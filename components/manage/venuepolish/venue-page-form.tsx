"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { createClient } from "@/lib/supabase/browser";
import { saveVenuePublicInfo, type VenueInfoState } from "@/lib/venues/polish-actions";
import { mediaUrl, type Direction, type GalleryPhoto, type Hotel, type VenuePublicInfo } from "@/lib/venues/polish-types";

/* Setup → Copyright, registration & fees → "Venue page" card: what the public PV02 page shows under
   Attending, Venue & travel and Gallery. Not locked by opening submissions — it can change any time. */

const MODES: [Direction["mode"], string][] = [["train", "Train"], ["plane", "Plane"], ["bus", "Bus"], ["car", "Car"], ["walk", "On foot"], ["other", "Other"]];
const ATTENDING: [keyof NonNullable<VenuePublicInfo["attending"]>, string, string][] = [
  ["registration_note", "Registration note", "When registration opens and how the Plenary paper ID links to it."],
  ["visa", "Visa letters", "How accepted authors request an invitation letter, and the last day."],
  ["grants", "Travel grants", "Who can apply, how many, and by when."],
  ["hotels_note", "Venue and hotels", "One line about the venue and nearby hotels."],
  ["keynotes", "Keynote speakers", "Names and affiliations."],
  ["conduct", "Code of conduct", "Which code applies and how to report concerns."],
  ["accessibility", "Accessibility and family", "Step-free access, captions, quiet room, childcare."],
];
const MAX_PHOTO = 5 * 1024 * 1024;

export function VenuePageForm({ venueId, slug, initial, canEdit }: { venueId: string; slug: string; initial: VenuePublicInfo; canEdit: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<VenueInfoState, FormData>(saveVenuePublicInfo, {});
  const [att, setAtt] = useState(initial.attending ?? {});
  const [travel, setTravel] = useState({ address: "", summary: "", hotel_code: "", hotel_deadline: "", ...(initial.travel ?? {}) });
  const [dirs, setDirs] = useState<Direction[]>(initial.travel?.directions ?? []);
  const [hotels, setHotels] = useState<Hotel[]>(initial.travel?.hotels ?? []);
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initial.gallery ?? []);
  const [upload, setUpload] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const file = useRef<HTMLInputElement>(null);

  const info: VenuePublicInfo = {
    attending: att,
    travel: { ...travel, directions: dirs.filter((d) => d.title.trim()), hotels: hotels.filter((h) => h.name.trim()) },
    gallery: photos,
  };

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUpload({ busy: true });
    const supabase = createClient();
    const added: GalleryPhoto[] = [];
    for (const f of Array.from(files).slice(0, 24 - photos.length)) {
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setUpload({ busy: false, error: "Use JPG, PNG or WebP photos." }); return; }
      if (f.size > MAX_PHOTO) { setUpload({ busy: false, error: "Each photo must be under 5 MB." }); return; }
      const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
      const path = `${venueId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("venue-media").upload(path, f, { contentType: f.type, cacheControl: "31536000", upsert: false });
      if (error) { setUpload({ busy: false, error: "The upload didn't work. Check your connection and try again." }); return; }
      added.push({ path, caption: "", credit: "" });
    }
    setPhotos((p) => [...p, ...added]);
    setUpload({ busy: false });
    if (file.current) file.current.value = "";
  }

  async function removePhoto(i: number) {
    const p = photos[i];
    setPhotos((list) => list.filter((_, k) => k !== i));
    // The file is removed right away; the list change is kept when you save.
    await createClient().storage.from("venue-media").remove([p.path]).catch(() => undefined);
  }

  const dis = !canEdit;
  return (
    <form action={action} className={`${ui.card} mt-6`} aria-labelledby="vp-h">
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="info" value={JSON.stringify(info)} />
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className={ui.kicker}>{t("Public venue page")}</p>
          <h2 id="vp-h" className={`${ui.h2} mt-1`}>{t("Attending, travel and gallery")}</h2>
          <p className={`${ui.hint} mt-1`}>{t("Shown on your venue page next to the fee table above. You can change this at any time, even after submissions open.")}</p>
        </div>
        <Link href={`/venues/${slug}#attending`} className="text-[14px] text-[#2F5FD0] underline">{t("View venue page ↗")}</Link>
      </div>

      <fieldset disabled={dis} className="m-0 mt-5 border-0 p-0">
        <legend className="text-[16px] font-semibold">{t("Attending")}</legend>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {ATTENDING.map(([k, label, hint]) => (
            <label key={k} className={ui.label}>{t(label)}
              <textarea rows={3} maxLength={600} value={att[k] ?? ""} onChange={(e) => setAtt((a) => ({ ...a, [k]: e.target.value }))} className={ui.textarea} />
              <span className={ui.hint}>{t(hint)}</span>
            </label>
          ))}
          <label className={ui.label}>{t("Registration site (optional)")}
            <input type="url" inputMode="url" placeholder="https://" maxLength={300} value={att.registration_url ?? ""} onChange={(e) => setAtt((a) => ({ ...a, registration_url: e.target.value }))} className={ui.input} />
            <span className={ui.hint}>{t("Leave empty if people register in Plenary.")}</span>
          </label>
        </div>
      </fieldset>

      <fieldset disabled={dis} className="m-0 mt-7 border-0 border-t border-[#EEF0EC] p-0 pt-5">
        <legend className="float-left w-full text-[16px] font-semibold">{t("Venue and travel")}</legend>
        <div className="clear-both grid gap-4 pt-3 md:grid-cols-2">
          <label className={ui.label}>{t("Venue address")}
            <input maxLength={300} value={travel.address ?? ""} onChange={(e) => setTravel((s) => ({ ...s, address: e.target.value }))} placeholder={t("Building, street, postcode, city, country")} className={ui.input} />
            <span className={ui.hint}>{t("The map pin uses the coordinates from Basics.")}</span>
          </label>
          <label className={ui.label}>{t("One-line summary")}
            <input maxLength={400} value={travel.summary ?? ""} onChange={(e) => setTravel((s) => ({ ...s, summary: e.target.value }))} placeholder={t("e.g. 25 minutes from the airport by train")} className={ui.input} />
          </label>
        </div>

        <h3 className="m-0 mt-5 text-[15px] font-semibold">{t("Getting there")}</h3>
        <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
          {dirs.map((d, i) => (
            <li key={i} className="grid grid-cols-1 gap-2 rounded-[6px] border border-[#EEF0EC] p-2.5 sm:grid-cols-[120px_minmax(0,1fr)_110px_minmax(0,1fr)_auto]">
              <label className="sr-only" htmlFor={`dm-${i}`}>{t("How")}</label>
              <select id={`dm-${i}`} value={d.mode} onChange={(e) => setDirs((l) => l.map((x, k) => (k === i ? { ...x, mode: e.target.value as Direction["mode"] } : x)))} className={ui.input}>
                {MODES.map(([m, l]) => <option key={m} value={m}>{t(l)}</option>)}
              </select>
              <input aria-label={t("Route")} maxLength={80} value={d.title} placeholder={t("e.g. From the airport")} onChange={(e) => setDirs((l) => l.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} className={ui.input} />
              <input aria-label={t("Time")} maxLength={40} value={d.time ?? ""} placeholder={t("25 min")} onChange={(e) => setDirs((l) => l.map((x, k) => (k === i ? { ...x, time: e.target.value } : x)))} className={ui.input} />
              <input aria-label={t("Note")} maxLength={200} value={d.note ?? ""} placeholder={t("Line, stop, price")} onChange={(e) => setDirs((l) => l.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)))} className={ui.input} />
              <button type="button" onClick={() => setDirs((l) => l.filter((_, k) => k !== i))} className={ui.ghost} aria-label={t("Remove route")}>×</button>
            </li>
          ))}
        </ul>
        {dirs.length < 8 ? <button type="button" onClick={() => setDirs((l) => [...l, { mode: "train", title: "", time: "", note: "" }])} className={`${ui.ghost} mt-2 h-9 text-[14px]`}>{t("+ Add a route")}</button> : null}

        <h3 className="m-0 mt-5 text-[15px] font-semibold">{t("Hotels with group rates")}</h3>
        <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
          {hotels.map((h, i) => (
            <li key={i} className="grid grid-cols-1 gap-2 rounded-[6px] border border-[#EEF0EC] p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_auto]">
              <input aria-label={t("Hotel name")} maxLength={100} value={h.name} placeholder={t("Hotel name")} onChange={(e) => setHotels((l) => l.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className={ui.input} />
              <input aria-label={t("Details")} maxLength={120} value={h.meta ?? ""} placeholder={t("e.g. 5 min walk · breakfast included")} onChange={(e) => setHotels((l) => l.map((x, k) => (k === i ? { ...x, meta: e.target.value } : x)))} className={ui.input} />
              <input aria-label={t("Price")} maxLength={40} value={h.price ?? ""} placeholder={t("per night")} onChange={(e) => setHotels((l) => l.map((x, k) => (k === i ? { ...x, price: e.target.value } : x)))} className={ui.input} />
              <button type="button" onClick={() => setHotels((l) => l.filter((_, k) => k !== i))} className={ui.ghost} aria-label={t("Remove hotel")}>×</button>
            </li>
          ))}
        </ul>
        {hotels.length < 8 ? <button type="button" onClick={() => setHotels((l) => [...l, { name: "", meta: "", price: "" }])} className={`${ui.ghost} mt-2 h-9 text-[14px]`}>{t("+ Add a hotel")}</button> : null}
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label className={ui.label}>{t("Booking code")}<input maxLength={40} value={travel.hotel_code ?? ""} onChange={(e) => setTravel((s) => ({ ...s, hotel_code: e.target.value }))} className={ui.input} /></label>
          <label className={ui.label}>{t("Book before")}<input maxLength={60} value={travel.hotel_deadline ?? ""} placeholder={t("e.g. 1 May")} onChange={(e) => setTravel((s) => ({ ...s, hotel_deadline: e.target.value }))} className={ui.input} /></label>
        </div>
      </fieldset>

      <fieldset disabled={dis} className="m-0 mt-7 border-0 border-t border-[#EEF0EC] p-0 pt-5">
        <legend className="float-left w-full text-[16px] font-semibold">{t("Gallery")}</legend>
        <p className={`${ui.hint} clear-both pt-1`}>{t("Up to 24 photos, JPG, PNG or WebP, 5 MB each. Credit the photographer on each one.")}</p>
        {photos.length ? (
          <ul className="m-0 mt-3 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p, i) => (
              <li key={p.path} className="overflow-hidden rounded-[6px] border border-[#DADDE3]">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded photo */}
                <img src={mediaUrl(p.path)} alt="" className="block aspect-[4/3] w-full object-cover" />
                <div className="flex flex-col gap-1.5 p-2">
                  <input aria-label={t("Caption")} maxLength={160} placeholder={t("Caption")} value={p.caption ?? ""} onChange={(e) => setPhotos((l) => l.map((x, k) => (k === i ? { ...x, caption: e.target.value } : x)))} className={`${ui.input} h-9 text-[14px]`} />
                  <input aria-label={t("Credit")} maxLength={80} placeholder={t("Photo: name")} value={p.credit ?? ""} onChange={(e) => setPhotos((l) => l.map((x, k) => (k === i ? { ...x, credit: e.target.value } : x)))} className={`${ui.input} h-9 text-[14px]`} />
                  <div className="flex justify-between gap-2">
                    <span className="flex gap-1">
                      <button type="button" disabled={i === 0} onClick={() => setPhotos((l) => { const c = [...l]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })} className="h-8 rounded-[4px] border border-[#DADDE3] bg-white px-2 text-[13px] disabled:opacity-40" aria-label={t("Move earlier")}>←</button>
                      <button type="button" disabled={i === photos.length - 1} onClick={() => setPhotos((l) => { const c = [...l]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; return c; })} className="h-8 rounded-[4px] border border-[#DADDE3] bg-white px-2 text-[13px] disabled:opacity-40" aria-label={t("Move later")}>→</button>
                    </span>
                    <button type="button" onClick={() => removePhoto(i)} className="h-8 rounded-[4px] border border-[#F3C3BE] bg-white px-2 text-[13px] text-[#B3261E]">{t("Remove")}</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {photos.length < 24 ? (
          <label className={`${ui.ghost} mt-3 h-10 cursor-pointer text-[14px]`}>
            {upload.busy ? t("Uploading…") : t("Add photos")}
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} disabled={upload.busy || dis} />
          </label>
        ) : null}
        {upload.error ? <p role="alert" className="m-0 mt-2 text-[13px] text-[#B3261E]">{t(upload.error)}</p> : null}
      </fieldset>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF0EC] pt-4">
        <p role="status" className="m-0 text-[13px] text-[#4A5263]">
          {state.error ? <span className="text-[#B3261E]">{t(state.error)}</span> : state.ok ? t("Saved. The venue page shows it now.") : t("Photos upload right away; text is saved when you press Save.")}
        </p>
        {canEdit ? <button type="submit" disabled={pending || upload.busy} className={ui.navy}>{pending ? t("Saving…") : t("Save venue page")}</button> : <span className="text-[13px] text-[#4A5263]">{t("Read-only for your role")}</span>}
      </div>
    </form>
  );
}
