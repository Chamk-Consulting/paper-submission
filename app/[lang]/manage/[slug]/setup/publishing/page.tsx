import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireEvent, groupStatus, lastChange } from "@/lib/manage/data";
import { ManagePage, SetupLayout } from "@/components/manage/chrome";
import { PublishingForm, type Fee } from "@/components/manage/setup2/publishing";
import { RulesCard } from "@/components/manage/setup2/rules";
import { Reveal } from "@/components/motion/reveal";
import { SetupFormSkeleton } from "@/components/skeletons/setup2";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Copyright, registration & fees") };
}

const DEFAULT_FEES: Fee[] = [
  { name: "Author (IEEE member)", early: 650, late: 750, covers: "n" },
  { name: "Author (non-member)", early: 800, late: 900, covers: "n" },
  { name: "Student author", early: 400, late: 480, covers: "1" },
  { name: "Attendee", early: 450, late: 550, covers: "0" },
];

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const s = (ctx.settings ?? {}) as Record<string, unknown>;
  const fees = Array.isArray(s.fee_types) && s.fee_types.length ? (s.fee_types as Fee[]) : DEFAULT_FEES.map((f) => ({ ...f, name: t(f.name) }));
  const mode = ["ieee_ecf", "other_form", "none"].includes(String(s.copyright_mode)) ? (s.copyright_mode as "ieee_ecf" | "other_form" | "none") : "ieee_ecf";
  return (
    <ManagePage ctx={ctx} active="setup" crumb={<>{t("Setup")} · {ctx.label}</>} title={t("Copyright, registration & fees")} sub={t("What authors sign, and what they pay.")}>
      <SetupLayout ctx={ctx} current="publishing">
        <div className="flex flex-col items-start gap-6 xl:flex-row">
          <div className="w-full min-w-0 flex-auto">
            <PublishingForm slug={slug} canEdit={ctx.isChair && !ctx.locked} status={groupStatus(ctx, ["copyright", "registration"])} last={lastChange(ctx, ["copyright", "registration"])}
              v={{
                copyright_mode: mode, ieee_record: String(s.ieee_record ?? ""), isbn: String(s.isbn ?? ""), open_access: s.open_access === true,
                papers_per_registration: Math.min(4, Math.max(1, Number(s.papers_per_registration ?? 1))), extra_pages_prepaid: s.extra_pages_prepaid === true,
                fee_types: fees, currency: String(s.currency ?? "USD"),
              }} />
          </div>
          <RulesCard rules={[
            ["G1", "Copyright is signed per paper by one author."], ["G2", "Final files lock after the copyright is confirmed."],
            ["G3", "Authors confirm the final PDF."], ["G4", "One registration covers N papers."], ["G5", "No registration, no place in the program."],
            ["G6", "Fees are shown before authors submit."], ["G7", "Extra pages are charged per page."],
          ]} />
        </div>
      </SetupLayout>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<SetupFormSkeleton cards={2} />}><Inner {...props} /></Reveal>;
}
