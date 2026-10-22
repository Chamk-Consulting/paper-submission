"use client";

import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { saveType, type ActionState } from "@/lib/submission/actions";
import { card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { useT } from "@/lib/i18n/client";

export type TypeOption = { name: string; note?: string; tags: string[]; when: string; whenVars?: Record<string, string | number>; closed?: boolean };

/** SB01 main column: venue card, type radio cards, track. */
export function TypeForm({ venue, types, tracks, initialType, initialTrack, submissionId, closed = false }: {
  venue: { id: string; acr: string; name: string; meta: string; slug: string; badge: string };
  types: TypeOption[]; tracks: string[]; initialType?: string; initialTrack?: string | null; submissionId?: string; closed?: boolean;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveType, {});
  const [pick, setPick] = useState(initialType ?? types.find((x) => !x.closed)?.name ?? "");
  const [track, setTrack] = useState(initialTrack ?? "");
  const fe = state.fieldErrors ?? {};
  const chosen = types.find((x) => x.name === pick);

  return (
    <form action={action}>
      <input type="hidden" name="venueId" value={venue.id} />
      {submissionId ? <input type="hidden" name="submissionId" value={submissionId} /> : null}
      <input type="hidden" name="paperType" value={pick} />
      <section className={card}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={h2}>{t("Venue")}</h2>
          {submissionId ? null : <Link href="/venues" className="text-[15px] text-[#2F5FD0] underline">{t("Change venue")}</Link>}
        </div>
        <div className="mt-4 flex items-center gap-3.5">
          <span aria-hidden className="flex size-11 flex-none items-center justify-center rounded-[6px] bg-[#E6EDFC] font-mono text-[12px] font-semibold text-[#1F47A8]">{venue.badge}</span>
          <div className="min-w-0">
            <div className="font-semibold">{venue.acr}</div>
            <div className="text-[14px] text-[#4A5263]">{venue.meta} · <Link href={`/venues/${venue.slug}`} className="text-[#2F5FD0] underline">{t("Call for papers")}</Link></div>
          </div>
        </div>
      </section>

      <h2 className="mb-0 mt-7 font-serif text-[24px] font-normal">{t("What are you submitting?")}</h2>
      <p className="mt-1 text-[#4A5263]">{t("Each type has its own page limit, deadline and review. You can change this until you submit.")}</p>
      <div role="radiogroup" aria-label={t("Submission type")} className="mt-4 flex flex-col gap-3">
        {types.map((ty) => {
          const on = pick === ty.name;
          return (
            <button key={ty.name} type="button" role="radio" aria-checked={on} disabled={ty.closed || closed} onClick={() => setPick(ty.name)}
              className="flex w-full items-start gap-3.5 rounded-[8px] bg-white px-4 py-4 text-left disabled:opacity-55"
              style={{ border: on ? "2px solid #F2A93B" : "1px solid #DADDE3", background: on ? "#FFFBF3" : "#FFFFFF", padding: on ? "15px" : undefined }}>
              <span aria-hidden className="mt-0.5 box-border size-[18px] flex-none rounded-full bg-white" style={{ border: on ? "5px solid #0E1B3D" : "1.5px solid #B7BDC9" }} />
              <span className="min-w-0 flex-auto">
                <span className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-semibold">{ty.name}</span><span className="font-mono text-[12px] text-[#7A4508]">{t(ty.when, ty.whenVars)}</span></span>
                {ty.note ? <span className="mt-0.5 block text-[14px] text-[#4A5263]">{ty.note}</span> : null}
                <span className="mt-2 flex flex-wrap gap-1.5">{ty.tags.map((g) => <span key={g} className="rounded-[2px] bg-[#EEF0EC] px-2 py-0.5 font-mono text-[11px] uppercase text-[#4A5263]">{t(g)}</span>)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {fe.paperType ? <p className="mt-2 text-[13px] text-[#B3261E]">{t(fe.paperType)}</p> : null}

      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("Track")}</h2>
        <label htmlFor="sb1-track" className="mt-1 block text-[#4A5263]">{t("Pick the track closest to your paper. The program chair may move it.")}</label>
        <select id="sb1-track" name="track" value={track} onChange={(e) => setTrack(e.target.value)} aria-invalid={!!fe.track || undefined}
          className="mt-3 h-12 w-full rounded-[4px] bg-white px-3 text-[16px]" style={{ border: fe.track ? "2px solid #B3261E" : "1px solid #B7BDC9" }}>
          <option value="">{t("Choose a track…")}</option>
          {tracks.map((tr) => <option key={tr} value={tr}>{t(tr)}</option>)}
        </select>
        {fe.track ? <p className="mt-1.5 text-[13px] text-[#B3261E]">{t(fe.track)}</p> : null}
      </section>

      {state.error ? <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{t(state.error)}</p> : null}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] pt-6">
        {submissionId ? <button type="submit" name="intent" value="exit" className={ghostBtn}>{t("Save and exit")}</button> : <Link href={`/venues/${venue.slug}`} className={ghostBtn}>{t("Cancel")}</Link>}
        <button type="submit" name="intent" value="next" disabled={pending || closed} className={primaryBtn}>{pending ? t("Saving…") : t("Continue to details →")}</button>
      </div>
      <p className="sr-only" aria-live="polite">{chosen ? t("Selected {name}", { name: chosen.name }) : ""}</p>
    </form>
  );
}
