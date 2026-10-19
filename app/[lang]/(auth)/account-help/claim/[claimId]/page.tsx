import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getMe } from "@/lib/auth/me";
import { createClient } from "@/lib/supabase/server";
import { Reveal } from "@/components/motion/reveal";
import { AccountHelpSkeleton } from "@/components/skeletons/admin";
import { HelpBody, HelpPage, helpCard, helpKicker } from "@/components/account-help/frame";
import { ClaimDecision } from "@/components/account-help/forms";
import { ui } from "@/components/manage/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Co-author claim") };
}

type Claim = {
  id: string; status: "pending" | "accepted" | "declined"; can_decide: boolean; is_claimant: boolean; submission_id: string;
  paper: { number: number | null; title: string }; claimant: { name: string; plenary_id: string | null; affiliation: string | null };
  placeholder: { name: string; email: string | null };
};

async function Inner({ params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  const me = await getMe();
  if (!me) redirect(`/sign-in?next=${encodeURIComponent(`/account-help/claim/${claimId}`)}`);
  const t = await getT();
  const supabase = await createClient();
  const { data, error } = /^[0-9a-f-]{36}$/i.test(claimId) ? await supabase.rpc("paper_claim", { p_claim: claimId }) : { data: null, error: true };
  const c = (error ? null : data) as Claim | null;
  const no = (n: number | null) => `#${String(n ?? 0).padStart(4, "0")}`;
  return (
    <HelpBody t={t} tab="claim">
      {!c ? (
        <section className={helpCard}><h2 className="m-0 text-[17px] font-semibold">{t("Request not found")}</h2><p className="mt-1.5 text-[14px] text-[#4A5263]">{t("It may have been answered already, or it isn’t addressed to you.")}</p></section>
      ) : (
        <section className={helpCard}>
          <p className={helpKicker}>{t("Co-author claim")} · {no(c.paper.number)}</p>
          <h2 className="m-0 mt-1.5 text-[20px] font-semibold">{c.paper.title}</h2>
          <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
            <div className="rounded-[6px] border border-[#DADDE3] p-3.5">
              <p className={helpKicker}>{t("On the paper today")}</p>
              <p className="m-0 mt-1.5 font-semibold">{c.placeholder.name}</p>
              <p className="m-0 text-[13px] text-[#4A5263]">{c.placeholder.email ?? "—"} · {t("not linked to an account")}</p>
            </div>
            <div className="rounded-[6px] border border-[#2F5FD0] bg-[#FBFCFF] p-3.5">
              <p className={helpKicker}>{t("Asks to be linked")}</p>
              <p className="m-0 mt-1.5 font-semibold">{c.claimant.name}</p>
              <p className="m-0 text-[13px] text-[#4A5263]">{[c.claimant.plenary_id, c.claimant.affiliation].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          {c.status === "pending" && c.can_decide ? (
            <>
              <p className="mt-4 text-[14px]">{t("Is this the same person as your co-author? If yes, the paper moves to their account and they can follow it in My submissions.")}</p>
              <ClaimDecision id={c.id} />
            </>
          ) : c.status === "pending" ? (
            <p role="status" className={`${ui.warn} mt-4`}>{t("Waiting for the corresponding author to confirm.")}</p>
          ) : c.status === "accepted" ? (
            <p role="status" className={`${ui.ok} mt-4`}>{t("Confirmed — the paper is linked.")} {c.is_claimant ? <Link href={`/submissions/${c.submission_id}`}>{t("Open paper")}</Link> : null}</p>
          ) : (
            <p role="status" className={`${ui.bad} mt-4`}>{t("Declined. The paper was not linked.")}</p>
          )}
        </section>
      )}
    </HelpBody>
  );
}

/** AH02 — the corresponding author confirms or declines a paper claim. */
export default function Page(props: { params: Promise<{ claimId: string }> }) {
  return <HelpPage><Reveal fallback={<AccountHelpSkeleton />}><Inner {...props} /></Reveal></HelpPage>;
}
