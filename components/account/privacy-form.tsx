"use client";

import Link from "@/components/site/link";
import { useActionState, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { requestData, savePrivacy, type AccountState } from "@/lib/account/actions";
import type { Consents, DataRequest } from "@/lib/account/data";
import { sx } from "@/components/account/styles";
import { ManualSaveBar, useDirty } from "@/components/account/save-bar";
import { CookieSettingsLink } from "@/components/consent/cookie-consent";

/* Canvas ST04 — Privacy & data. */

const VISIBILITY: ["public" | "signed_in" | "venues_only", string, string][] = [
  ["public", "Anyone", "Name, affiliation, topics and published papers."],
  ["signed_in", "Signed-in researchers", "So co-authors and editors can find you. Recommended."],
  ["venues_only", "Only venues I work with", "Co-authors must use your exact email or Plenary ID."],
];
const small = "inline-flex h-8 items-center whitespace-nowrap rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#F7F8F6] disabled:opacity-60";
const box = "flex cursor-pointer items-start gap-3 rounded-[6px] border border-[#DADDE3] bg-white px-3.5 py-3 text-left";

function Check({ name, defaultChecked, disabled, children }: { name: string; defaultChecked: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label className={`${box} has-[:checked]:border-[#B9E0CB] has-[:checked]:bg-[#F3FAF6] ${disabled ? "cursor-default" : ""}`}>
      <input form="pv" type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="peer sr-only" />
      <span aria-hidden className="mt-px flex size-5 flex-none items-center justify-center rounded-[3px] border-[1.5px] border-[#8A93A6] bg-white text-[13px] font-bold text-white peer-checked:border-0 peer-checked:bg-[#18744F] peer-focus-visible:outline-2 peer-focus-visible:outline-[#2F5FD0] [&>span]:hidden peer-checked:[&>span]:inline"><span>✓</span></span>
      <span className="text-[14px]">{children}</span>
    </label>
  );
}

export function PrivacyForm({ visibility, consents, lastExport, lastDelete }: {
  visibility: "public" | "signed_in" | "venues_only"; consents: Consents; lastExport: DataRequest | null; lastDelete: DataRequest | null;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<AccountState, FormData>(savePrivacy, {});
  const { dirty, onChange, onSubmit } = useDirty();
  const date = (iso: string | null, long = false) => (iso ? new Date(iso).toLocaleDateString(t.intl, long ? { day: "numeric", month: "long", year: "numeric" } : { month: "short", year: "numeric" }) : "—");

  return (
    <div onChange={onChange} className="flex flex-col gap-[18px]">
      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Who can see your profile")}</h2>
        <fieldset className="m-0 mt-3.5 flex flex-col gap-2 border-0 p-0">
          <legend className="sr-only">{t("Profile visibility")}</legend>
          {VISIBILITY.map(([v, title, detail]) => (
            <label key={v} className={`${box} has-[:checked]:border-[#2F5FD0] has-[:checked]:bg-[#FBFCFF]`}>
              <input form="pv" type="radio" name="visibility" value={v} defaultChecked={visibility === v}
                className="m-0 mt-0.5 size-[18px] flex-none cursor-pointer appearance-none rounded-full border-[1.5px] border-solid border-[#8A93A6] checked:border-[6px] checked:border-[#2F5FD0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]" />
              <span className="text-[14px]"><strong>{t(title)}</strong><span className="block text-[13px] text-[#4A5263]">{t(detail)}</span></span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Consents")}</h2>
        <div className="mt-3.5 flex flex-col gap-2">
          <Check name="processing" defaultChecked disabled>
            {t("Process my data to run submissions and reviews")}
            <span className="block text-[13px] text-[#4A5263]">{t("Required to use Plenary. Recorded {date} · GDPR Art. 6(1)(b).", { date: date(consents.processing) })}</span>
          </Check>
          <Check name="share_with_venues" defaultChecked={consents.share_with_venues}>{t("Share my name and affiliation with venues I submit to or review for")}</Check>
          <Check name="product_news" defaultChecked={consents.product_news}>{t("Product news from Plenary")} <span className="font-normal text-[#4A5263]">{t("(about once a month)")}</span></Check>
        </div>
        <p className="mb-0 mt-3 text-[13px] text-[#4A5263]">
          {t("Cookies on this device:")} <CookieSettingsLink className="border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline" />
          {" · "}<Link href="/legal/privacy" className="text-[#2F5FD0]">{t("Privacy policy")}</Link>
        </p>
      </section>

      <YourData lastExport={lastExport} />
      <DeleteAccount lastDelete={lastDelete} date={(iso) => date(iso, true)} />

      <form id="pv" action={action} onSubmit={onSubmit} />
      <ManualSaveBar form="pv" pending={pending} dirty={dirty} savedAt={state.savedAt} error={state.error}
        note="Downloading or deleting your data has its own buttons above." />
    </div>
  );
}

function YourData({ lastExport }: { lastExport: DataRequest | null }) {
  const t = useT();
  const status = lastExport?.status ?? null;
  return (
    <section className={sx.card}>
      <h2 className={sx.h2}>{t("Your data")}</h2>
      <div className="mt-3.5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span><strong className="text-[14px]">{t("Download everything")}</strong><span className="block text-[13px] text-[#4A5263]">{t("Papers, reviews you wrote, messages and profile as a ZIP (JSON + PDFs).")}</span></span>
          <Link href="/workspace/account/privacy/export" className={small}>{status === "ready" ? t("Download ZIP") : status === "preparing" ? t("Preparing…") : t("Request export")}</Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF0EC] pt-3">
          <span><strong className="text-[14px]">{t("Import from PaperCept or another system")}</strong><span className="block text-[13px] text-[#4A5263]">{t("Bring past papers and reviews using your society's export or ORCID.")}</span></span>
          <span aria-disabled title={t("Coming soon")} className={`${small} text-[#6B7385]!`}>{t("Import")} · {t("soon")}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF0EC] pt-3">
          <span><strong className="text-[14px]">{t("Found a duplicate account?")}</strong><span className="block text-[13px] text-[#4A5263]">{t("Merge it into this one — papers and reviews move with it.")}</span></span>
          <Link href="/account-help" className={small}>{t("Merge accounts")}</Link>
        </div>
      </div>
    </section>
  );
}

function DeleteAccount({ lastDelete, date }: { lastDelete: DataRequest | null; date: (iso: string | null) => string }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<AccountState | null>(null);
  const outcome = res?.value ?? (lastDelete?.status === "requested" && lastDelete.scheduled_for ? "scheduled" : null);
  const blocked = res?.value === "blocked";
  return (
    <section className="rounded-[8px] border border-[#F3C3BE] bg-white px-6 py-5">
      <h2 className={`${sx.h2} text-[#B3261E]`}>{t("Delete account")}</h2>
      <p className="mb-0 mt-1.5 text-[14px] text-[#4A5263]">{t("Your profile is removed after 30 days. Papers already published and reviews already used in decisions are kept, anonymised, as venues must keep their records.")}</p>
      {outcome === "scheduled" ? (
        <p role="status" className="mb-0 mt-3 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3 py-2.5 text-[13px] text-[#3B2A07]">
          {lastDelete?.scheduled_for
            ? t("Your account will be deleted on {date}. You can cancel until then.", { date: date(lastDelete.scheduled_for) })
            : t("Your account will be deleted in 30 days. You can cancel until then.")}{" "}
          <Link href="/workspace/account/privacy/export">{t("Cancel deletion")}</Link>
        </p>
      ) : confirming ? (
        <div className="mt-3 rounded-[6px] border border-[#F3C3BE] bg-[#FFFBFA] px-3.5 py-3">
          <p className="m-0 text-[14px]">{t("Delete your Plenary account? You can't undo this after 30 days.")}</p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" disabled={pending} onClick={() => start(async () => { setRes(await requestData("delete")); setConfirming(false); })}
              className="inline-flex h-8 items-center rounded-[4px] border-0 bg-[#B3261E] px-3 text-[13px] font-semibold text-white disabled:opacity-60">{pending ? t("Checking…") : t("Yes, delete my account")}</button>
            <button type="button" onClick={() => setConfirming(false)} className={small}>{t("Cancel")}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setConfirming(true); setRes(null); }} className={`${small} mt-3 border-[#F3C3BE]! text-[#B3261E]!`}>{t("Delete my account…")}</button>
      )}
      {blocked ? <BlockedNote reason={lastDelete?.blocked_reason ?? null} /> : null}
      {res?.error ? <p role="alert" className="mb-0 mt-3 text-[13px] text-[#B3261E]">{t(res.error)}</p> : null}
    </section>
  );
}

function BlockedNote({ reason }: { reason: string | null }) {
  const t = useT();
  const m = reason ? /(\d+) reviews? in progress and (\d+) papers?/.exec(reason) : null;
  return (
    <div role="alert" className="mt-3 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2.5 text-[13px] text-[#5C1A15]">
      {m ? t("You have {r} reviews in progress and {p} papers under review. Finish or hand these over before deleting.", { r: m[1], p: m[2] })
        : t("You have reviews in progress or papers under review. Finish or hand these over before deleting.")}{" "}
      <Link href="/workspace/reviews">{t("See reviews")}</Link>
    </div>
  );
}
