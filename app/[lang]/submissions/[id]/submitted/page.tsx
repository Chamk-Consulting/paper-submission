import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { StepMark } from "@/components/motion/step-transition";
import { initialsOf, requireCtx } from "@/components/submission/frame";
import { StepRail, TitleBand, WizardHeader, WizardLayout, asideCard, card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { fmtLocal } from "@/lib/venues/time";
import { Reveal } from "@/components/motion/reveal";
import { StatusSkeleton } from "@/components/skeletons";
import { TestBanner } from "@/components/submission/test-banner";
import { DeleteTestButton } from "@/components/manage/opspolish/test-papers";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Paper submitted") };
}
type P = { params: Promise<{ id: string }> };
const daysUntil = (iso: string | null) => (iso ? Math.ceil((Date.parse(iso) - Date.now()) / 864e5) : null);

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "submitted");
  const { sub, venue, authors } = ctx;
  const t = await getT();
  if (sub.isTest) {
    if (!sub.testSubmittedAt) redirect(`/submissions/${id}/review`);
    const nm = ctx.me.person ? `${ctx.me.person.given_name} ${ctx.me.person.family_name}` : ctx.me.email;
    const checked = [t("Type and track"), t("Title, abstract and declarations"), t("Authors and corresponding author"), t("Keywords"), t("PDF upload and checks"), t("Conflicts"), t("Final confirmations")];
    return (
      <WizardLayout
        header={<><StepMark n={8} /><WizardHeader initials={initialsOf(nm, ctx.me.email)} right={<span className="hidden items-center gap-2 text-[14px] text-[#4A5263] sm:flex"><span className="size-2 rounded-full bg-[#A8600F]" />{t("Test submission")}</span>} /></>}
        band={<TitleBand crumb={t("Test submission")} title={t("Test submission passed")} venue={venue} generatedAt={new Date().toISOString()} />}
        rail={<StepRail rail={{ done: { type: true, details: true, authors: true, keywords: true, files: true, conflicts: true, review: true }, current: null, reachable: 7, base: `/submissions/${id}` }} footer={false} />}
      >
        <TestBanner venueSlug={venue.slug} passed />
        <section className={`${card} border-t-4 border-t-[#18744F]`}>
          <p className="m-0 font-mono text-[12px] uppercase tracking-[0.06em] text-[#14603F]">{t("Test passed")} · {new Date(sub.testSubmittedAt!).toLocaleString(t.intl, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</p>
          <h2 className="mt-3 font-serif text-[24px] font-normal leading-[1.25]">{sub.title}</h2>
          <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("Every check a real author meets passed. No paper ID was taken and nobody was emailed.")}</p>
          <ul className="m-0 mt-4 grid list-none gap-1.5 p-0 sm:grid-cols-2">
            {checked.map((c) => <li key={c} className="flex items-center gap-2 text-[15px]"><span aria-hidden className="text-[#18744F]">✓</span>{c}</li>)}
          </ul>
          <div className="mt-5 flex flex-wrap items-start gap-2.5">
            <Link href={`/manage/${venue.slug}/setup/go-live`} className={primaryBtn}>{t("Back to go-live review")}</Link>
            <DeleteTestButton slug={venue.slug} id={id} after={`/manage/${venue.slug}/setup/go-live`} className={ghostBtn} />
          </div>
        </section>
      </WizardLayout>
    );
  }
  if (sub.stage === "draft" || !sub.number) redirect(`/submissions/${id}/review`);
  const no = `#${String(sub.number).padStart(4, "0")}`;
  const invites = authors.filter((a) => !a.hasAccount);
  const name = ctx.me.person ? `${ctx.me.person.given_name} ${ctx.me.person.family_name}` : ctx.me.email;
  const notif = venue.dates.find((d) => d.kind === "notification");
  const final = venue.dates.find((d) => d.kind === "final");
  const days = daysUntil(venue.deadline);
  const steps = [
    { title: t("Submitted"), d: t("Today. You can still edit until the deadline."), s: "done" },
    { title: t("Deadline and lock"), d: days != null ? t(days === 1 ? "In {n} day. Then the paper goes to an associate editor." : "In {n} days. Then the paper goes to an associate editor.", { n: days }) : t("Rolling — the editor picks it up soon."), s: "next" },
    { title: t("Review"), d: t("You will see the status change in My submissions."), s: "" },
    { title: t("Decision"), d: notif ? t("{date} (target). Emailed to all authors.", { date: fmtLocal(notif.startsAt, "UTC", true, t.intl).split(",")[0] }) : t("Emailed to all authors."), s: "" },
    { title: t("Final version and copyright"), d: final ? t("If accepted: by {date}.", { date: fmtLocal(final.startsAt, "UTC", true, t.intl).split(",")[0] }) : t("If accepted: upload the camera-ready PDF and sign the copyright form."), s: "" },
  ];
  return (
    <WizardLayout
      header={<><StepMark n={8} /><WizardHeader initials={initialsOf(name, ctx.me.email)} right={<span className="hidden items-center gap-2 text-[14px] text-[#4A5263] sm:flex"><span className="size-2 rounded-full bg-[#18744F]" />{t("Submitted")} · {no}</span>} /></>}
      band={<TitleBand crumb={t("Submission {no}", { no })} title={t("Paper submitted")} venue={venue} generatedAt={new Date().toISOString()} />}
      rail={<StepRail rail={{ done: { type: true, details: true, authors: true, keywords: true, files: true, conflicts: true, review: true }, current: null, reachable: 7, base: `/submissions/${id}` }} footer={false} />}
      aside={
        <>
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Help review for this venue?")}</h3>
            <p className="mt-1.5 text-[15px] text-[#4A5263]">{sub.keywords[0] ? t("{venue} needs reviewers in {keyword}.", { venue: venue.acr, keyword: t(sub.keywords[0]) }) : t("{venue} needs reviewers.", { venue: venue.acr })} {t("You'd get up to 3 papers.")}</p>
            {/* TODO(review): reviewer volunteering (RV10). */}
            <span title={t("Coming soon")} className="mt-3 inline-flex h-10 items-center rounded-[4px] border border-[#DADDE3] px-3.5 text-[14px] text-[#9AA3B5]">{t("Yes, I can review · soon")}</span>
          </section>
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Need to change something?")}</h3>
            <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
              <li>{t("Replace the PDF or edit details from the paper's status page.")}</li>
              <li>{t("Withdraw any time — reviewers are told straight away.")}</li>
              <li>{t("Author changes after the deadline go to the program chair.")}</li>
            </ul>
          </section>
        </>
      }
    >
      <section className={`${card} border-t-4 border-t-[#18744F]`}>
        <p className="m-0 font-mono text-[12px] uppercase tracking-[0.06em] text-[#14603F]">{t("Submitted")} · {sub.submittedAt ? `${new Date(sub.submittedAt).toLocaleString(t.intl, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC` : ""}</p>
        <div className="mt-3 flex flex-wrap items-baseline gap-3"><span className="font-mono text-[40px] font-medium leading-none">{no}</span><span className="text-[15px] text-[#4A5263]">{t("Paper ID — quote it in any message to the organisers")}</span></div>
        <h2 className="mt-4 font-serif text-[24px] font-normal leading-[1.25]">{sub.title}</h2>
        <p className="mt-1.5 text-[15px] text-[#4A5263]">{venue.acr} · {t(sub.paperType)} · {t(authors.length === 1 ? "{n} author" : "{n} authors", { n: authors.length })}</p>
        <p className="mt-4 rounded-[6px] border border-[#B9E0CB] bg-[#F3FAF6] px-3.5 py-3 text-[15px]">
          {/* TODO(email): receipts are recorded; emails go out once the Send Email hook is set up. */}
          {invites.length ? t("Your co-authors can see this paper as soon as they sign in; {names} will be invited to confirm on Plenary.", { names: invites.map((i) => i.name).join(", ") }) : t("Your co-authors can see this paper as soon as they sign in.")}
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link href={`/submissions/${id}`} className={primaryBtn}>{t("View paper status")}</Link>
          <a href={`/submissions/${id}/receipt.pdf`} className={ghostBtn}>{t("Download receipt (PDF)")}</a>
          <Link href={`/submit/${venue.slug}`} className={ghostBtn}>{t("Submit another paper")}</Link>
        </div>
      </section>
      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("What happens next")}</h2>
        <ol className="m-0 mt-4 list-none p-0">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3.5">
              <span className="flex flex-col items-center">
                <span className="flex size-[22px] items-center justify-center rounded-full text-[11px]" style={s.s === "done" ? { background: "#18744F", color: "#fff" } : s.s === "next" ? { background: "#F2A93B", color: "#0E1B3D" } : { border: "1.5px solid #B7BDC9", background: "#fff" }}>{s.s === "done" ? "✓" : s.s === "next" ? "•" : ""}</span>
                {i < steps.length - 1 ? <span className="min-h-6 w-0.5 flex-auto bg-[#DADDE3]" /> : null}
              </span>
              <span className="pb-4"><span className="block font-semibold">{s.title}</span><span className="block text-[14px] text-[#4A5263]">{s.d}</span></span>
            </li>
          ))}
        </ol>
      </section>
    </WizardLayout>
  );
}

/** Canvas SB08-Submitted. */
export default function Page(props: P) {
  return <Reveal fallback={<StatusSkeleton />}><Inner {...props} /></Reveal>;
}
