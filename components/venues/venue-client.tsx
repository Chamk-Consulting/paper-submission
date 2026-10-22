"use client";

import Link from "@/components/site/link";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useFollows } from "@/components/venues/use-clock";
import { contactOrganizers, type ContactState } from "@/lib/venues/polish-actions";
import { mediaUrl, type GalleryPhoto } from "@/lib/venues/polish-types";

/* Interactive bits of the PV02 venue page: gallery lightbox, copy address, contact-organizers form. */

export function CopyAddress({ text }: { text: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 2000); }); }}
      className="inline-flex h-9 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#121826]">
      <span role="status">{done ? t("Address copied") : t("Copy address")}</span>
    </button>
  );
}

export function Gallery({ photos }: { photos: GalleryPhoto[] }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const show = useCallback((i: number) => { setOpen(i); dialog.current?.showModal(); }, []);
  const close = useCallback(() => { dialog.current?.close(); }, []);
  const step = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + photos.length) % photos.length)), [photos.length]);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); };
    const onClose = () => setOpen(null);
    el.addEventListener("keydown", onKey);
    el.addEventListener("close", onClose);
    return () => { el.removeEventListener("keydown", onKey); el.removeEventListener("close", onClose); };
  }, [step]);
  const cur = open == null ? null : photos[open];
  return (
    <>
      <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3">
        {photos.map((p, i) => (
          <li key={p.path} className={i === 0 && photos.length > 2 ? "col-span-2 row-span-2" : ""}>
            <button type="button" onClick={() => show(i)} className="group relative block h-full w-full overflow-hidden rounded-[8px] border border-[#DADDE3] bg-[#EEF0EC] p-0 text-left"
              aria-label={`${t("Open photo {n} of {total}", { n: i + 1, total: photos.length })}${p.caption ? `: ${p.caption}` : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- organizer photos from public storage, sizes vary */}
              <img src={mediaUrl(p.path)} alt={p.caption ?? ""} loading="lazy" className={`block w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] ${i === 0 && photos.length > 2 ? "aspect-[4/3] h-full" : "aspect-[4/3]"}`} />
              {p.caption ? <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(14,27,61,.75)] to-transparent px-3 pb-2 pt-6 text-[13px] font-medium text-white">{p.caption}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-[#4A5263]">{t("Photos are uploaded by the organizers. Photographers are credited on each image.")}</p>
      <dialog ref={dialog} aria-label={t("Photo viewer")} className="m-auto max-h-[92dvh] w-[min(1100px,94vw)] rounded-[10px] border-0 bg-[#0E1B3D] p-0 text-[#F5F6F3] backdrop:bg-[rgba(14,27,61,.8)]">
        {cur ? (
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="font-mono text-[12px] text-[#B9C3DA]">{(open ?? 0) + 1} / {photos.length}</span>
              <button type="button" onClick={close} aria-label={t("Close")} className="size-9 rounded-[4px] border border-[#2A3C6E] bg-transparent text-[18px] text-[#F5F6F3]">×</button>
            </div>
            <div className="relative flex items-center justify-center bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element -- full-size organizer photo */}
              <img src={mediaUrl(cur.path)} alt={cur.caption ?? ""} className="max-h-[70dvh] w-auto max-w-full object-contain" />
              {photos.length > 1 ? (
                <>
                  <button type="button" onClick={() => step(-1)} aria-label={t("Previous photo")} className="absolute left-2 top-1/2 size-10 -translate-y-1/2 rounded-full border-0 bg-[rgba(14,27,61,.7)] text-[20px] text-white">‹</button>
                  <button type="button" onClick={() => step(1)} aria-label={t("Next photo")} className="absolute right-2 top-1/2 size-10 -translate-y-1/2 rounded-full border-0 bg-[rgba(14,27,61,.7)] text-[20px] text-white">›</button>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3 text-[14px]">
              <span>{cur.caption ?? ""}</span>
              <span className="text-[13px] text-[#B9C3DA]">{cur.credit ? `${cur.credit} · ` : ""}<a href={mediaUrl(cur.path)} download className="text-[#F2A93B]">{t("Download")}</a></span>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

const TOPICS: ["general" | "submissions" | "publication" | "registration", string][] = [
  ["general", "General questions — general chair"],
  ["submissions", "Submissions and reviews — program chair"],
  ["publication", "Final versions and copyright — publication chair"],
  ["registration", "Registration and payments — registration chair"],
];

/** PV02 aside "Questions?" → "Contact organizers". */
export function ContactOrganizers({ venueId, slug, acr }: { venueId: string; slug: string; acr: string }) {
  const t = useT();
  const f = useFollows();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ContactState, FormData>(contactOrganizers, {});
  const field = "box-border w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px] text-[#121826] outline-none focus:border-[#2F5FD0]";
  if (!f.signedIn) {
    return (
      <>
        <Link href={`/sign-in?next=${encodeURIComponent(`/venues/${slug}#contact`)}`} className="mt-3 flex h-10 items-center justify-center rounded-[4px] border border-[#B7BDC9] bg-white text-[14px] font-semibold text-[#121826] no-underline">{t("Sign in to contact organizers")}</Link>
        <p className="mt-2 text-[13px] text-[#4A5263]">{t("No account? Use the")} <Link href="/contact" className="text-[#2F5FD0] underline">{t("contact form")}</Link>.</p>
      </>
    );
  }
  if (state.threadId) {
    return (
      <div role="status" className="mt-3 rounded-[6px] bg-[#E1F3EA] px-3 py-2.5 text-[14px] text-[#14603F]">
        ✓ {t("Sent. Replies arrive in your inbox.")} <Link href={`/inbox/${state.threadId}`} className="font-semibold text-[#14603F] underline">{t("Open the conversation")}</Link>
      </div>
    );
  }
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} aria-expanded={false} aria-controls="contact-form" className="mt-3 flex h-10 w-full items-center justify-center rounded-[4px] border border-[#B7BDC9] bg-white text-[14px] font-semibold text-[#121826]">{t("Contact organizers")}</button>;
  }
  return (
    <form id="contact-form" action={action} className="mt-3 flex flex-col gap-2.5">
      <input type="hidden" name="venueId" value={venueId} />
      <label className="flex flex-col gap-1 text-[13px] font-semibold">{t("About")}
        <select name="topic" defaultValue="general" className={`${field} h-10`}>
          {TOPICS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">{t("Subject")}
        <input name="subject" maxLength={300} defaultValue={t("Question about {acr}", { acr })} className={`${field} h-10`} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">{t("Message")}
        <textarea name="body" required rows={5} maxLength={8000} aria-invalid={!!state.fieldErrors?.body} className={`${field} py-2 font-normal leading-[1.5]`} />
        {state.fieldErrors?.body ? <span className="text-[12px] font-normal text-[#B3261E]">{t(state.fieldErrors.body)}</span> : null}
      </label>
      {state.error ? <p role="alert" className="m-0 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[13px] text-[#5C1A15]">{t(state.error)}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="h-10 flex-auto rounded-[4px] border-0 bg-[#F2A93B] text-[14px] font-semibold text-[#0E1B3D] disabled:opacity-60">{pending ? t("Sending…") : t("Send message")}</button>
        <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px]">{t("Cancel")}</button>
      </div>
    </form>
  );
}
