import { asideCard, kicker, noteBlue } from "@/components/submission/shell";
import type { WizardVenue } from "@/lib/submission/data";
import { fmtAoE } from "@/lib/venues/time";
import { getT } from "@/lib/i18n/server";

export async function TypeAside({ venue, type, track }: { venue: WizardVenue; type?: string; track?: string | null }) {
  const t = await getT();
  const ty = venue.details.types?.find((x) => x.name === type) ?? venue.details.types?.[0];
  return (
    <>
      <section className={asideCard}>
        <p className={kicker}>{t("Your choice")}</p>
        <div className="mt-2 text-[17px] font-semibold">{type ?? ty?.name ?? t("Regular paper")}</div>
        <dl className="m-0 mt-2.5 grid grid-cols-[80px_1fr] gap-y-1.5 text-[14px]">
          <dt className="text-[#4A5263]">{t("Pages")}</dt><dd className="m-0">{ty?.length ?? venue.pageLimit ?? "—"}</dd>
          <dt className="text-[#4A5263]">{t("Review")}</dt><dd className="m-0">{t(ty?.review ?? venue.reviewMode ?? "—")}</dd>
          <dt className="text-[#4A5263]">{t("Deadline")}</dt><dd className="m-0">{venue.deadline ? fmtAoE(venue.deadline, t.intl) : t("Rolling")}</dd>
          <dt className="text-[#4A5263]">{t("Track")}</dt><dd className="m-0">{track ? t(track) : t("Not chosen yet")}</dd>
        </dl>
      </section>
      <section className={asideCard}>
        <h3 className="m-0 text-[17px] font-semibold">{t("Have these ready")}</h3>
        <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
          <li>{t("Title and abstract (up to 250 words)")}</li>
          <li>{t("Co-authors' emails or PINs")}</li>
          <li>{t("3–5 keywords")}</li>
          <li>{t("PDF in the venue template")}</li>
        </ul>
      </section>
      {venue.doubleBlind ? <div className={noteBlue}><strong>{t("Double-blind review.")}</strong> {t("Reviewers won't see your name. Keep names and acknowledgements out of the PDF.")}</div> : null}
    </>
  );
}
