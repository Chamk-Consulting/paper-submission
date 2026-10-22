import Link from "@/components/site/link";
import { fmtDay, fmtTime } from "@/lib/program/time";
import type { ChairListItem, ChairSession } from "@/lib/program/data";
import type { getT } from "@/lib/i18n/server";

type T = Awaited<ReturnType<typeof getT>>;
const box = "rounded-[8px] border border-[#DADDE3] bg-white px-[18px] py-4 text-[14px]";
const kick = "m-0 mb-2 font-mono text-[11px] tracking-[0.06em] text-[#4A5263]";

/** CH01 right column: your sessions, legend, room info. */
export function ChairAside({ t, list, current }: { t: T; list: ChairListItem[]; current?: ChairSession }) {
  return (
    <aside className="flex w-full flex-col gap-4 print:hidden lg:w-[280px] lg:flex-none">
      <section className={box}>
        <p className={kick}>{t("YOUR SESSIONS")}</p>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {list.map((x) => (
            <li key={x.id}>
              <Link href={`/chair/${x.id}`} aria-current={current?.id === x.id ? "page" : undefined} className={`font-semibold no-underline ${current?.id === x.id ? "text-[#1F47A8]" : "text-[#121826]"}`}>{x.code} · {x.title}</Link>
              <div className="text-[12px] text-[#4A5263]">{x.venueShort} · {fmtDay(x.startsAt, x.timezone, t.intl)} {fmtTime(x.startsAt, x.timezone, t.intl)} · {t("{n}/{total} ready", { n: x.ready, total: x.total })}</div>
            </li>
          ))}
          {!list.length ? <li className="text-[#4A5263]">{t("None yet.")}</li> : null}
        </ul>
      </section>
      <section className={box}>
        <p className={kick}>{t("LEGEND")}</p>
        <dl className="m-0 grid grid-cols-[64px_1fr] gap-y-1.5 text-[13px]">
          <dt className="font-mono text-[11px]">REG</dt><dd className="m-0 text-[#4A5263]">{t("presenter registered")}</dd>
          <dt className="font-mono text-[11px]">SLIDES</dt><dd className="m-0 text-[#4A5263]">{t("uploaded")}</dd>
          <dt className="font-mono text-[11px]">BIO</dt><dd className="m-0 text-[#4A5263]">{t("short bio for your introduction")}</dd>
        </dl>
      </section>
      {current ? (
        <section className={box}>
          <p className={kick}>{t("ROOM INFO")}</p>
          <div className="font-semibold">{current.room ?? t("Room to be announced")}</div>
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0 text-[#4A5263]">
            {current.roomLevel ? <li>{current.roomLevel}</li> : null}
            {current.roomSeats ? <li>{t("{n} seats", { n: current.roomSeats })}</li> : null}
            {current.roomEquipment ? <li>{current.roomEquipment}</li> : null}
            {current.roomTechnician ? <li>{t("Technician: {name}", { name: current.roomTechnician })}</li> : null}
            <li>{current.roomStepFree ? t("Step-free access") : t("Not step-free — ask at the desk")}</li>
          </ul>
          <Link href={`/program/${current.venueSlug}/sessions/${encodeURIComponent(current.code)}`} className="mt-2 inline-block">{t("Public session page")}</Link>
        </section>
      ) : null}
    </aside>
  );
}
