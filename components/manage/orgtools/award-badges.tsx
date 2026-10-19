import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

/* EM34 → public pages: announced award winners among the given papers (anon-readable RPC). */

export type PublicAward = { award_id: string; award: string; submission_id: string; number: number; title: string };

export async function loadPublicAwards(venueId: string): Promise<PublicAward[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_award_winners", { p_venue: venueId });
  return (data ?? []) as PublicAward[];
}

/** Aside card on a session page listing the awards won by its talks; renders nothing when there are none. */
export async function SessionAwards({ venueId, submissionIds }: { venueId: string; submissionIds: string[] }) {
  if (!submissionIds.length) return null;
  const won = (await loadPublicAwards(venueId)).filter((a) => submissionIds.includes(a.submission_id));
  if (!won.length) return null;
  const t = await getT();
  return (
    <section className="rounded-[8px] border border-[#F1D29A] bg-[#FFF8EC] px-[18px] py-4 text-[14px]">
      <p className="m-0 mb-2 font-mono text-[11px] tracking-[0.06em] text-[#7A4508]">{t("AWARDS")}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {won.map((a) => (
          <li key={a.award_id}>
            <span className="inline-flex rounded-[3px] bg-[#F2A93B] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-[#0E1B3D]">★ {a.award}</span>
            <div className="mt-1 font-semibold text-[#121826]">#{String(a.number).padStart(4, "0")} · {a.title}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
