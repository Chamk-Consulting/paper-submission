import { asideCard, kicker, noteBlue } from "@/components/submission/shell";
import type { WizardVenue } from "@/lib/submission/data";
import { fmtAoE } from "@/lib/venues/time";

export function TypeAside({ venue, type, track }: { venue: WizardVenue; type?: string; track?: string | null }) {
  const t = venue.details.types?.find((x) => x.name === type) ?? venue.details.types?.[0];
  return (
    <>
      <section className={asideCard}>
        <p className={kicker}>Your choice</p>
        <div className="mt-2 text-[17px] font-semibold">{type ?? t?.name ?? "Regular paper"}</div>
        <dl className="m-0 mt-2.5 grid grid-cols-[80px_1fr] gap-y-1.5 text-[14px]">
          <dt className="text-[#4A5263]">Pages</dt><dd className="m-0">{t?.length ?? venue.pageLimit ?? "—"}</dd>
          <dt className="text-[#4A5263]">Review</dt><dd className="m-0">{t?.review ?? venue.reviewMode ?? "—"}</dd>
          <dt className="text-[#4A5263]">Deadline</dt><dd className="m-0">{venue.deadline ? fmtAoE(venue.deadline) : "Rolling"}</dd>
          <dt className="text-[#4A5263]">Track</dt><dd className="m-0">{track ?? "Not chosen yet"}</dd>
        </dl>
      </section>
      <section className={asideCard}>
        <h3 className="m-0 text-[17px] font-semibold">Have these ready</h3>
        <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
          <li>Title and abstract (up to 250 words)</li>
          <li>Co-authors&apos; emails or Plenary IDs</li>
          <li>3–5 keywords</li>
          <li>PDF in the venue template</li>
        </ul>
      </section>
      {venue.doubleBlind ? <div className={noteBlue}><strong>Double-blind review.</strong> Reviewers won&apos;t see your name. Keep names and acknowledgements out of the PDF.</div> : null}
    </>
  );
}
