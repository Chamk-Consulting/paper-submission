import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/components/submission/frame";
import { WorkspaceShell } from "@/components/workspace/shell";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { asideCard, card, h2, kicker } from "@/components/submission/shell";
import { no4 } from "@/components/submission/followup/flow-frame";
import { LocalDate } from "@/components/submission/followup/due-pill";
import { ConfirmForm } from "@/components/submission/followup/rebuttal-confirm-forms";
import { loadInfo } from "@/lib/submission/followup-data";
import { Reveal } from "@/components/motion/reveal";
import { WorkspaceFormSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Confirm you are a co-author") };
}
type P = { params: Promise<{ id: string }> };

const TAG = {
  confirmed: ["Confirmed", "#E1F3EA", "#14603F"],
  pending: ["Waiting", "#FBEFDD", "#7A4508"],
  declined: ["Declined", "#FDECEA", "#B3261E"],
  mine: ["Your turn", "#E6EDFC", "#1F47A8"],
} as const;

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "status");
  const [ws, info] = await Promise.all([getWorkspaceCtx(), loadInfo(id)]);
  const t = await getT();
  const mine = info?.authors.find((a) => a.isMe);
  const corresponding = ctx.authors.find((a) => a.corresponding);
  const generatedAt = new Date().toISOString();
  const deadline = ctx.sub.submittedAt ? new Date(Date.parse(ctx.sub.submittedAt) + 5 * 864e5).toISOString() : null;
  return (
    <WorkspaceShell ctx={ws} active="submissions">
      <p className="m-0 text-[14px] text-[#4A5263]"><Link href="/workspace/submissions" className="text-[#121826] underline">{t("My submissions")}</Link> / {t("Co-author request")}</p>
      <h1 className="mt-2 font-serif text-[34px] font-normal leading-[1.15]">{t("Confirm you are a co-author")}</h1>
      <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("{name} added you to {no} · {venue}", { name: info?.addedBy ?? corresponding?.name ?? t("A co-author"), no: no4(ctx.sub.number), venue: ctx.venue.acr })}</p>
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-auto flex-col gap-5">
          <section className={card}>
            <p className={kicker}>{t("Paper")}</p>
            <h2 className={`${h2} mt-1.5`}>{ctx.sub.title}</h2>
            <p className="mt-1 text-[14px] text-[#4A5263]">{t(ctx.sub.paperType)}{ctx.sub.submittedAt ? <> · {t("submitted")} <LocalDate at={ctx.sub.submittedAt} generatedAt={generatedAt} /></> : null}{corresponding ? ` · ${t("corresponding author {name}", { name: corresponding.name })}` : ""}</p>
            <p className={`${kicker} mt-5`}>{t("Author list")}</p>
            <ol className="m-0 mt-2 list-none p-0">
              {ctx.authors.map((a, i) => {
                const st = info?.authors.find((x) => x.personId === a.personId);
                const [label, bg, ink] = a.isYou && st?.confirmation === "pending" ? TAG.mine : TAG[st?.confirmation ?? "pending"];
                return (
                  <li key={a.personId} className="flex items-center gap-3 border-b border-[#EEF0EC] py-2.5 last:border-0">
                    <span className="flex size-7 flex-none items-center justify-center rounded-full bg-[#EEF0EC] font-mono text-[13px]">{i + 1}</span>
                    <span className="min-w-0 flex-auto"><span className="block font-semibold">{a.name}{a.isYou ? ` · ${t("you")}` : ""}</span><span className="block text-[14px] text-[#4A5263]">{st?.affiliation ?? a.institution ?? ""}</span></span>
                    <span className="rounded-[3px] px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em]" style={{ background: bg, color: ink }}>{t(label)}</span>
                  </li>
                );
              })}
            </ol>
          </section>
          <section className={card}>
            {mine?.confirmation === "pending" ? (
              <>
                <h2 className={h2}>{t("Your details on this paper")}</h2>
                <ConfirmForm id={id} affiliations={[...new Set([...(info?.myAffiliations ?? []), ...(ctx.authors.find((a) => a.isYou)?.institution ? [ctx.authors.find((a) => a.isYou)!.institution!] : [])])]} current={mine.affiliation} addedBy={info?.addedBy ?? null} />
              </>
            ) : mine?.confirmation === "confirmed" ? (
              <p className="m-0 rounded-[6px] bg-[#E1F3EA] px-4 py-3 text-[15px] text-[#14603F]">✓ {t("You confirmed your authorship.")} <Link href={`/submissions/${id}`} className="text-[#14603F] underline">{t("View paper status")}</Link></p>
            ) : (
              <p className="m-0 rounded-[6px] bg-[#FBEFDD] px-4 py-3 text-[15px] text-[#3B2A07]">{t("You said you are not an author of this paper. If this was a mistake, contact the corresponding author.")}</p>
            )}
          </section>
        </div>
        <aside className="flex w-full flex-col gap-4 lg:w-[300px] lg:flex-none">
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Why we ask")}</h3>
            <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("Every author confirms before review starts. It stops people being added without their knowledge and keeps conflict checks accurate.")}</p>
          </section>
          {deadline && mine?.confirmation === "pending" ? (
            <section className={asideCard}>
              <h3 className="m-0 text-[17px] font-semibold">{t("Deadline")}</h3>
              <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("Please confirm within 5 days")} (<LocalDate at={deadline} generatedAt={generatedAt} />).</p>
            </section>
          ) : null}
        </aside>
      </div>
    </WorkspaceShell>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<WorkspaceShell ctx={null} active="submissions"><WorkspaceFormSkeleton /></WorkspaceShell>}><Inner {...props} /></Reveal>;
}
