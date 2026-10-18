import { getT } from "@/lib/i18n/server";
import { ui } from "@/components/manage/ui";

/** "Rules on this page" side card of the setup screens. */
export async function RulesCard({ rules }: { rules: [string, string][] }) {
  const t = await getT();
  return (
    <aside aria-label={t("Rules on this page")} className={`${ui.card} w-full xl:w-[280px] xl:flex-none`}>
      <p className={ui.kicker}>{t("Rules on this page")}</p>
      <dl className="m-0 mt-3 flex flex-col gap-2.5">
        {rules.map(([code, text]) => (
          <div key={code} className="flex gap-2.5 text-[13px]">
            <dt className="w-7 flex-none font-mono font-semibold text-[#2F5FD0]">{code}</dt>
            <dd className="m-0 text-[#4A5263]">{t(text)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
