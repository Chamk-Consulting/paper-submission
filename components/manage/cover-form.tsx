"use client";

import { useActionState, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/browser";
import { saveCover } from "@/lib/manage/cover-actions";
import { ui } from "@/components/manage/ui";
import { VenueCoverImage } from "@/components/venues/cover";
import type { ManageState } from "@/lib/manage/actions-util";
import type { CoverFocus, VenueCover } from "@/lib/venues/types";

const FOCUS: [CoverFocus, string][] = [
  ["top-left", "top left"], ["top", "top"], ["top-right", "top right"], ["left", "left"], ["center", "centre"], ["right", "right"],
  ["bottom-left", "bottom left"], ["bottom", "bottom"], ["bottom-right", "bottom right"],
];
const MAX = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** EM03b: upload, focus point, previews, alt text, credit and rights for the venue cover. */
export function CoverForm({ venueId, slug, acr, field, initial, canEdit }: { venueId: string; slug: string; acr: string; field: string | null; initial: VenueCover | null; canEdit: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<ManageState, FormData>(saveCover, {});
  const [cover, setCover] = useState<VenueCover>(initial ?? { focus: "center" });
  const [alt, setAlt] = useState(initial?.alt ?? "");
  const [credit, setCredit] = useState(initial?.credit ?? "");
  const [creditUrl, setCreditUrl] = useState(initial?.creditUrl ?? "");
  const [rights, setRights] = useState(!!initial);
  const [upload, setUpload] = useState<{ busy: boolean; error?: string; info?: string }>({ busy: false });
  const file = useRef<HTMLInputElement>(null);
  const has = !!(cover.path || cover.url);
  const focus = cover.focus ?? "center";

  async function pick(f: File | undefined) {
    if (!f) return;
    if (!TYPES.includes(f.type)) { setUpload({ busy: false, error: t("Use a JPG, PNG or WebP image.") }); return; }
    if (f.size > MAX) { setUpload({ busy: false, error: t("The image must be under 5 MB.") }); return; }
    const dims = await new Promise<{ w: number; h: number } | null>((res) => { const img = new Image(); img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => res(null); img.src = URL.createObjectURL(f); });
    setUpload({ busy: true });
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
    const path = `${venueId}/cover-${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from("venue-media").upload(path, f, { contentType: f.type, cacheControl: "31536000", upsert: false });
    if (error) { setUpload({ busy: false, error: t("The upload didn't work. Check your connection and try again.") }); return; }
    setCover((c) => ({ ...c, path, url: null }));
    setUpload({ busy: false, info: dims && dims.w < 2400 ? t("Uploaded. It's {w} × {h} px — at least 2400 px wide looks sharper on large screens.", { w: dims.w, h: dims.h }) : t("Uploaded. Save to publish it.") });
    if (file.current) file.current.value = "";
  }

  const payload = JSON.stringify({ path: cover.path ?? null, url: cover.path ? null : cover.url ?? null, alt, credit, creditUrl: creditUrl || null, focus, rights });
  const frame = (label: string, cls: string) => (
    <div className="flex flex-col gap-1.5">
      <span className={ui.kicker}>{label}</span>
      <div className={`relative overflow-hidden rounded-[6px] border border-[#DADDE3] bg-[#EEF0EC] ${cls}`}>
        <VenueCoverImage cover={has ? { ...cover, focus } : null} field={field} alt="" />
        {!has ? <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-white/90">{t("DEFAULT ARTWORK")}</span> : null}
      </div>
    </div>
  );

  return (
    <form action={action} className={`${ui.card} mt-6`} aria-labelledby="cover-h">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="cover" value={payload} />
      <p className={ui.kicker}>{t("Public venue page")}</p>
      <h2 id="cover-h" className={`${ui.h2} mt-1`}>{t("Cover image")}</h2>
      <p className={`${ui.hint} mt-1`}>{t("Shown on the venue directory, the top of your venue page, phones and link previews. Optional — without one, Plenary shows artwork for your field.")}</p>

      <fieldset disabled={!canEdit} className="m-0 mt-4 flex flex-col gap-5 border-0 p-0">
        <input ref={file} type="file" accept={TYPES.join(",")} className="sr-only" id="cover-file" onChange={(e) => pick(e.target.files?.[0])} />
        {has ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[14px]">{cover.path ? t("Uploaded image") : t("Image from a licensed source")} · <span className="text-[#4A5263]">{t("focus {where}", { where: t(FOCUS.find((f) => f[0] === focus)?.[1] ?? "centre") })}</span></p>
            <div className="flex gap-2">
              <label htmlFor="cover-file" className={`${ui.ghost} h-9 cursor-pointer text-[14px]`}>{upload.busy ? t("Uploading…") : t("Replace")}</label>
              <button type="submit" name="intent" value="remove" className={`${ui.ghost} h-9 text-[14px] text-[#B3261E]`}>{t("Remove cover")}</button>
            </div>
          </div>
        ) : (
          <label htmlFor="cover-file" className="flex cursor-pointer flex-col items-center gap-1 rounded-[8px] border-2 border-dashed border-[#9DB1E3] bg-[#FBFCFF] px-5 py-9 text-center"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
            <strong className="text-[16px]">{upload.busy ? t("Uploading…") : t("Drop an image here or choose a file")}</strong>
            <span className={ui.hint}>{t("JPG, PNG or WebP · at least 2400 × 1350 px · up to 5 MB")}</span>
          </label>
        )}
        {upload.error ? <p role="alert" className={`${ui.bad} m-0`}>{upload.error}</p> : null}
        {upload.info ? <p role="status" className={`${ui.ok} m-0`}>{upload.info}</p> : null}

        {has ? (
          <div>
            <p className="m-0 text-[14px] font-medium">{t("Focus point")} <span className={ui.hint}>— {t("this part stays visible in every crop")}</span></p>
            <div role="radiogroup" aria-label={t("Focus point")} className="mt-2 grid w-[210px] grid-cols-3 gap-1">
              {FOCUS.map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={focus === k} aria-label={t("Focus {where}", { where: t(l) })} onClick={() => setCover((c) => ({ ...c, focus: k }))}
                  className={`h-11 rounded-[4px] border ${focus === k ? "border-[#0E1B3D] bg-[#0E1B3D]" : "border-[#DADDE3] bg-[#F5F6F3] hover:bg-[#EEF0EC]"}`} />
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="m-0 text-[14px] font-medium">{t("Preview in every place it appears")}</p>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            {frame(t("Directory card · 16:9"), "aspect-video w-[220px]")}
            {frame(t("Phone · 4:3"), "aspect-[4/3] w-[160px]")}
            {frame(t("Link preview · 1.91:1"), "aspect-[1.91/1] w-[230px]")}
          </div>
          <div className="mt-4">{frame(t("Venue page header · {acr}", { acr }), "aspect-[4.2/1] w-full max-w-[720px]")}</div>
        </div>

        {has ? (
          <div className="flex flex-col gap-4">
            <label className={ui.label}>{t("Describe the image for screen readers (required)")}
              <input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} placeholder={t("e.g. Harbour at dusk with the conference centre lit up")} className={ui.input} />
              {state.fieldErrors?.alt ? <span className="text-[13px] font-normal text-[#B3261E]">{t(state.fieldErrors.alt)}</span> : null}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={ui.label}>{t("Credit shown on the image")}<input value={credit} onChange={(e) => setCredit(e.target.value)} maxLength={200} placeholder={t("© Photographer · licence")} className={ui.input} /></label>
              <label className={ui.label}>{t("Credit link (optional)")}<input value={creditUrl} onChange={(e) => setCreditUrl(e.target.value)} type="url" placeholder="https://" className={ui.input} /></label>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-[6px] border border-[#DADDE3] px-3.5 py-3 text-[14px]">
              <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 size-[18px] accent-[#18744F]" />
              <span>{t("We have the right to publish this image")}<span className={`${ui.hint} block`}>{t("Our own photo, licensed, or used with permission. Plenary removes images on a valid rights complaint.")}</span></span>
            </label>
            {state.fieldErrors?.rights ? <p role="alert" className="m-0 text-[13px] text-[#B3261E]">{t(state.fieldErrors.rights)}</p> : null}
          </div>
        ) : null}

        {state.error ? <p role="alert" className={`${ui.bad} m-0`}>{t(state.error)}</p> : null}
        {state.ok ? <p role="status" className={`${ui.ok} m-0`}>{t("Saved · the cover is live on the directory and your venue page.")}</p> : null}
        {has ? <div><button type="submit" name="intent" value="save" disabled={pending || upload.busy} className={ui.primary}>{pending ? t("Saving…") : t("Save cover")}</button></div> : null}
      </fieldset>
    </form>
  );
}
