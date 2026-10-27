import { RIBBON, type Badge } from "@/lib/attend/badge";

/* BD01 badge (A6 proportions): venue band, name, affiliation, PIN, QR, role ribbon. The QR svg is generated
   server-side by the qrcode package from our own token, so injecting it is safe. */
export function BadgeCard({ badge, qr, venue, dates, t, print = false }: {
  badge: Badge; qr: string; venue: string; dates: string; t: (k: string) => string; print?: boolean;
}) {
  const r = RIBBON[badge.role] ?? RIBBON.attendee;
  const name = (badge.full_name ?? "").trim();
  const [first, ...rest] = name.split(" ");
  return (
    <div className={`box-border w-[360px] max-w-full overflow-hidden rounded-[10px] border border-[#DADDE3] bg-white ${print ? "break-inside-avoid" : "shadow-[0_8px_24px_rgba(18,24,38,.10)]"}`}>
      <div className="flex items-center justify-between gap-3 bg-[#0E1B3D] px-[18px] py-3.5 text-[#F5F6F3]">
        <span className="truncate font-serif text-[20px]">{venue}</span>
        <span className="flex-none font-mono text-[11px] uppercase text-[#B9C3DA]">{dates}</span>
      </div>
      <div className="flex items-center gap-4 px-[18px] py-5">
        <div className="min-w-0 flex-auto">
          <p className="m-0 break-words font-serif text-[28px] leading-[1.1]">{first || "—"}{rest.length ? <><br />{rest.join(" ")}</> : null}</p>
          {badge.affiliation ? <p className="mb-0 mt-2 text-[14px] text-[#4A5263]">{badge.affiliation}</p> : null}
          <p className="mb-0 mt-1 font-mono text-[12px] text-[#4A5263]">{badge.plenary_id ?? badge.number}</p>
        </div>
        <div className="size-[150px] flex-none" dangerouslySetInnerHTML={{ __html: qr }} />
      </div>
      <div className="px-[18px] py-2.5 text-center font-mono text-[13px] font-semibold tracking-[0.08em]" style={{ background: r.bg, color: r.ink }}>{t(r.label)}</div>
    </div>
  );
}
