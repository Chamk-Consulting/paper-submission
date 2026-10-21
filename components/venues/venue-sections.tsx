import { getT } from "@/lib/i18n/server";
import type { Direction, Fee, VenuePublic } from "@/lib/venues/polish-types";
import { CopyAddress, Gallery } from "@/components/venues/venue-client";

/* Canvas PV02: Attending, Venue & travel and Gallery sections of the public venue page.
   Content comes from the organizers (setup → Copyright, registration & fees → Venue page). */

const h2 = "m-0 font-serif text-[30px] font-normal leading-[1.15]";
const section = "scroll-mt-20 border-t border-[#DADDE3] py-8";
const card = "rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5";
const kicker = "m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]";

function money(n: number | null, currency: string, intl: string) {
  if (n == null) return "—";
  try { return new Intl.NumberFormat(intl, { style: "currency", currency, maximumFractionDigits: 0 }).format(n); } catch { return `${n} ${currency}`; }
}

const MODE: Record<Direction["mode"], string> = { train: "Train", plane: "Plane", bus: "Bus", car: "Car", walk: "On foot", other: "Other" };

function ModeIcon({ mode }: { mode: Direction["mode"] }) {
  const p: Record<Direction["mode"], string> = {
    train: "M5 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM3 8h12M6 14l-2 3M12 14l2 3",
    plane: "M2 10l14-6-4 12-3-5-7-1zM9 11l3-3",
    bus: "M4 2h10a1 1 0 0 1 1 1v11H3V3a1 1 0 0 1 1-1zM3 9h12M5 14v2M13 14v2",
    car: "M3 11l2-5h8l2 5v4H3zM3 11h12M6 15v1M12 15v1",
    walk: "M9 3a1 1 0 1 0 0-.01M8 6l-2 4 3 1 1 5M8 6l3 2 2 1M7 13l-2 3",
    other: "M9 2a6 6 0 0 1 6 6c0 4-6 9-6 9S3 12 3 8a6 6 0 0 1 6-6zM9 6v3",
  };
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={p[mode]} /></svg>;
}

export async function AttendingSection({ pub, acr }: { pub: VenuePublic; acr: string }) {
  const t = await getT();
  const a = pub.info.attending ?? {};
  const fees = pub.fees.filter((f: Fee) => f.covers !== "-" && (f.early != null || f.late != null));
  const extraPage = pub.fees.find((f) => f.covers === "-" && (f.early != null || f.late != null));
  const covers = (f: Fee) => (f.covers === "0" ? t("No paper") : f.covers === "1" ? t("1 paper") : pub.papersPerRegistration ? t("Up to {n} papers", { n: pub.papersPerRegistration }) : "—");
  const blocks: [string, string | undefined][] = [
    ["Visa letters", a.visa], ["Travel grants", a.grants], ["Venue and hotels", a.hotels_note], ["Keynote speakers", a.keynotes],
    ["Code of conduct", a.conduct], ["Accessibility and family", a.accessibility],
  ];
  const any = fees.length || a.registration_note || blocks.some(([, v]) => v);
  return (
    <section id="attending" aria-labelledby="attending-h" className={section}>
      <h2 id="attending-h" className={h2}>{t("Attending")}</h2>
      {!any ? <p className="mt-3 text-[14px] text-[#4A5263]">{t("Registration, visa and travel information will be published here by the organizers of {acr}.", { acr })}</p> : null}
      {fees.length ? (
        <div className="mt-4">
          <h3 className="m-0 text-[17px] font-semibold">{t("Registration")}</h3>
          <div className="relative mt-2 overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
            <table className="w-full min-w-[520px] border-collapse text-[14px]">
              <thead><tr className="border-b border-[#DADDE3] text-left font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]"><th className="px-4 py-2.5 font-medium">{t("Type")}</th><th className="px-4 py-2.5 text-right font-medium">{t("Early")}</th><th className="px-4 py-2.5 text-right font-medium">{t("Late")}</th><th className="px-4 py-2.5 font-medium">{t("Covers")}</th></tr></thead>
              <tbody>
                {fees.map((f) => (
                  <tr key={f.name} className="border-b border-[#EEF0EC] last:border-b-0">
                    <td className="px-4 py-2.5 font-medium">{f.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{money(f.early, pub.currency, t.intl)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{money(f.late, pub.currency, t.intl)}</td>
                    <td className="px-4 py-2.5 text-[#4A5263]">{covers(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[14px] text-[#4A5263]">
            {extraPage ? `${t("Extra pages: {price} per page.", { price: money(extraPage.early ?? extraPage.late, pub.currency, t.intl) })} ` : ""}
            {a.registration_note ?? ""}
            {a.registration_url ? <> <a href={a.registration_url} target="_blank" rel="noopener noreferrer" className="text-[#2F5FD0] underline">{t("Registration site ↗")}</a></> : null}
          </p>
        </div>
      ) : a.registration_note ? <p className="mt-4 text-[14px]">{a.registration_note}</p> : null}
      {blocks.some(([, v]) => v) ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {blocks.filter(([, v]) => v).map(([title, v]) => (
            <div key={title} className={card}>
              <div className="font-semibold">{t(title)}</div>
              <p className="m-0 mt-1 whitespace-pre-line text-[14px] text-[#4A5263]">{v}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export async function TravelSection({ pub, name, fallbackPlace, hotelsNote = null }: { pub: VenuePublic; name: string; fallbackPlace: string | null; hotelsNote?: string | null }) {
  const t = await getT();
  const tr = pub.info.travel ?? {};
  const address = tr.address || fallbackPlace;
  const q = pub.lat != null && pub.lng != null ? `${pub.lat},${pub.lng}` : address ?? "";
  const directions = tr.directions ?? [];
  const hotels = tr.hotels ?? [];
  if (!address && !directions.length && !hotels.length) {
    return (
      <section id="travel" aria-labelledby="travel-h" className={section}>
        <h2 id="travel-h" className={h2}>{t("Venue and travel")}</h2>
        <p className="mt-3 text-[14px] text-[#4A5263]">{t("The organizers haven't published the venue address yet.")}</p>
      </section>
    );
  }
  return (
    <section id="travel" aria-labelledby="travel-h" className={section}>
      <h2 id="travel-h" className={h2}>{t("Venue and travel")}</h2>
      {tr.summary ? <p className="mt-1 text-[15px] text-[#4A5263]">{tr.summary}</p> : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
          <div aria-hidden className="relative h-[220px] bg-[#EEF3FA] [background-image:linear-gradient(#D5DEEC_1px,transparent_1px),linear-gradient(90deg,#D5DEEC_1px,transparent_1px)] [background-size:36px_36px]">
            <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
              <span className="whitespace-nowrap rounded-[3px] bg-[#0E1B3D] px-2 py-0.5 font-mono text-[11px] font-semibold text-white">{name}</span>
              <span className="h-2.5 w-0.5 bg-[#0E1B3D]" />
              <span className="size-3 rounded-full border-2 border-white bg-[#F2A93B] shadow-[0_0_0_1px_#0E1B3D]" />
            </span>
            {pub.lat != null && pub.lng != null ? <span className="absolute bottom-2 left-2 font-mono text-[11px] text-[#4A5263]">{pub.lat.toFixed(3)}, {pub.lng.toFixed(3)}</span> : null}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <p className={kicker}>{t("Address")}</p>
              <p className="m-0 mt-1 text-[15px] font-medium">{address}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {address ? <CopyAddress text={address} /> : null}
              {q ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#121826] no-underline">{t("Open in Google Maps ↗")}</a> : null}
              {q ? <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-[4px] bg-[#0E1B3D] px-3 text-[13px] font-semibold text-white no-underline">{t("Directions")}</a> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {hotelsNote && !hotels.length ? (
            <div className={card}>
              <h3 className="m-0 text-[16px] font-semibold">{t("Hotels")}</h3>
              <p className="m-0 mt-2 text-[14px]">{hotelsNote}</p>
            </div>
          ) : null}
          {directions.length ? (
            <div className={card}>
              <h3 className="m-0 text-[16px] font-semibold">{t("Getting there")}</h3>
              <ul className="m-0 mt-2 list-none p-0">
                {directions.map((d, i) => (
                  <li key={i} className="flex gap-3 border-b border-[#EEF0EC] py-2.5 last:border-b-0">
                    <span className="mt-0.5 flex size-8 flex-none items-center justify-center rounded-full bg-[#E6EDFC] text-[#1F47A8]" title={t(MODE[d.mode])}><ModeIcon mode={d.mode} /></span>
                    <span className="min-w-0 flex-auto">
                      <span className="flex justify-between gap-2"><span className="font-semibold">{d.title}</span>{d.time ? <span className="flex-none font-mono text-[13px] text-[#4A5263]">{d.time}</span> : null}</span>
                      {d.note ? <span className="block text-[13px] text-[#4A5263]">{d.note}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {hotels.length ? (
            <div className={card}>
              <h3 className="m-0 text-[16px] font-semibold">{t("Hotels with group rates")}</h3>
              <ol className="m-0 mt-2 list-none p-0">
                {hotels.map((h, i) => (
                  <li key={i} className="flex items-baseline gap-3 border-b border-[#EEF0EC] py-2 last:border-b-0">
                    <span className="font-mono text-[12px] text-[#4A5263]">{i + 1}</span>
                    <span className="min-w-0 flex-auto"><span className="block font-medium">{h.name}</span>{h.meta ? <span className="block text-[13px] text-[#4A5263]">{h.meta}</span> : null}</span>
                    {h.price ? <span className="flex-none font-mono text-[13px]">{h.price}</span> : null}
                  </li>
                ))}
              </ol>
              {tr.hotel_code ? <p className="m-0 mt-2 text-[13px] text-[#4A5263]">{t("Book with code")} <strong className="font-mono text-[#121826]">{tr.hotel_code}</strong>{tr.hotel_deadline ? ` ${t("before {date}.", { date: tr.hotel_deadline })}` : "."}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export async function GallerySection({ pub }: { pub: VenuePublic }) {
  const t = await getT();
  const photos = pub.info.gallery ?? [];
  if (!photos.length) return null;
  return (
    <section id="gallery" aria-labelledby="gallery-h" className={section}>
      <h2 id="gallery-h" className={h2}>{t("Gallery")}</h2>
      <p className="mt-1 text-[14px] text-[#4A5263]">{t("The venue, the city and moments from past editions.")}</p>
      <Gallery photos={photos} />
    </section>
  );
}
