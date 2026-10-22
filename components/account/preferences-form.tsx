"use client";

import { useActionState, useMemo, useSyncExternalStore } from "react";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/config";
import { setLanguageCookie } from "@/lib/consent-client";
import { savePreferences, type AccountState } from "@/lib/account/actions";
import { applyUi, parseUi, type UiPrefs } from "@/lib/account/ui-prefs";
import { refreshSummary } from "@/components/chrome/summary";
import { sx } from "@/components/account/styles";
import { AccountSaveBar, FieldErr, useDirty } from "@/components/account/save-bar";

/* Settings › Preferences: language, time, display and workspace. One Save for the page. */

const noopSubscribe = () => () => {};
function offsetLabel(tz: string) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName");
    return part ? part.value.replace("GMT", "UTC") : "";
  } catch { return ""; }
}

function Choice<K extends string>({ name, value, options, legend, help }: { name: string; value: K; options: [K, string, string?][]; legend: string; help?: string }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="p-0 text-[14px] font-medium">{legend}</legend>
      {help ? <p className="m-0 mt-0.5 text-[12px] text-[#4A5263]">{help}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map(([v, label, hint]) => (
          <label key={v} className="flex cursor-pointer items-center gap-2 rounded-[6px] border border-[#DADDE3] bg-white px-3 py-2 text-[14px] has-[:checked]:border-[#2F5FD0] has-[:checked]:bg-[#F3F6FE]">
            <input type="radio" name={name} value={v} defaultChecked={value === v} className="accent-[#2F5FD0]" />
            <span>{label}{hint ? <span className="block text-[12px] text-[#4A5263]">{hint}</span> : null}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PreferencesForm({ locale, timezone, ui }: { locale: string; timezone: string; ui: UiPrefs }) {
  const t = useT();
  const current = useLocale();
  const { dirty, onChange, onSubmit } = useDirty();
  const [state, action] = useActionState<AccountState, FormData>(async (prev, fd) => {
    const r = await savePreferences(prev, fd);
    if (r.ok && r.value) {
      const v = JSON.parse(r.value) as { locale: string; ui: unknown };
      applyUi(parseUi(v.ui));
      void refreshSummary(true); // the tab's cached copy would otherwise put the old choices back
      if (v.locale && v.locale !== current) { setLanguageCookie(v.locale); window.location.reload(); }
    }
    return r;
  }, {});
  // Time-zone names and offsets differ between server and browser, so the full list is built after hydration.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const zones = useMemo(() => {
    if (!mounted) { const z = timezone || "UTC"; return [[z, z.replace(/_/g, " ")]] as const; }
    const list = Intl.supportedValuesOf("timeZone");
    if (timezone && !list.includes(timezone)) list.unshift(timezone);
    return list.map((z) => [z, `${z.replace(/_/g, " ")} (${offsetLabel(z)})`] as const);
  }, [timezone, mounted]);
  const device = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

  return (
    <form action={action} onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-[18px]">
      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Language and time")}</h2>
        <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
          <label className={sx.label}>{t("Language")}
            <select name="locale" defaultValue={locale || current} className={sx.input}>
              {LOCALES.map((l) => <option key={l} value={l} lang={l}>{LOCALE_NAMES[l]}</option>)}
            </select>
            <span className={sx.help}>{t("Used for the interface and for emails from Plenary.")}</span>
          </label>
          <label className={sx.label}>{t("Time zone")}
            <select key={mounted ? "client" : "server"} name="timezone" defaultValue={timezone || device || "UTC"} className={sx.input}>
              {zones.map(([z, l]) => <option key={z} value={z}>{l}</option>)}
            </select>
            <span className={sx.help}>{t("Used for reminder emails and your calendar feed. Pages show each event’s own time and your device’s time.")}</span>
            <FieldErr state={state} name="timezone" />
          </label>
        </div>
        <label className="mt-3.5 flex cursor-pointer items-start gap-2.5 text-[14px]">
          <input type="checkbox" name="followDevice" defaultChecked={ui.followDevice} className="mt-0.5 size-[18px] flex-none accent-[#2F5FD0]" />
          <span>{t("Follow my device when I travel")}
            <span className="block text-[12px] text-[#4A5263]">{device ? t("Updates your time zone automatically — this device is on {zone}.", { zone: device.replace(/_/g, " ") }) : t("Updates your time zone automatically from the device you use.")}</span>
          </span>
        </label>
      </section>

      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Display")}</h2>
        <p className={sx.sub + " text-[13px]"}>{t("Applies to the workspace on every device you sign in on.")}</p>
        <div className="mt-3.5 flex flex-col gap-4">
          <Choice name="textSize" value={ui.textSize} legend={t("Text size")} options={[["normal", t("Standard")], ["large", t("Larger")]]} />
          <Choice name="contrast" value={ui.contrast} legend={t("Contrast")} options={[["normal", t("Standard")], ["high", t("Higher contrast")]]} />
          <Choice name="motion" value={ui.motion} legend={t("Motion")} options={[["auto", t("Follow my device")], ["reduce", t("Reduce motion")]]} />
        </div>
      </section>

      <section className={sx.card}>
        <h2 className={sx.h2}>{t("Workspace")}</h2>
        <div className="mt-3.5 flex flex-col gap-4">
          <Choice name="start" value={ui.start} legend={t("Start page after sign-in")} options={[["home", t("Home")], ["submissions", t("My submissions")], ["reviews", t("Reviews")], ["events", t("Find events")]]} />
          <Choice name="sidebar" value={ui.sidebar} legend={t("Side menu")} help={t("You can still fold or open it any time with the button at its foot.")} options={[["auto", t("Open on wide screens")], ["folded", t("Folded to icons")]]} />
        </div>
      </section>

      <AccountSaveBar state={state} dirty={dirty} />
    </form>
  );
}
