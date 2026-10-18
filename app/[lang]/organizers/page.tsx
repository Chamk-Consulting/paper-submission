import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("For organizers"), description: t("Run submissions, reviews and the program in one place.") };
}

const FEATURES: [string, string, string, string][] = [
  ["SETUP", "A checklist, not a manual", "Twelve sections with live checks: dates in order, deputy chair named, email placeholders filled. Open submissions when it all passes.", "/#start"],
  ["ASSIGNMENT", "Match by topic, block conflicts", "AE load bars, topic match, automatic conflict detection with overrides that need a reason and a second approver.", "/#start"],
  ["REVIEW", "Reviewers who say yes", "One-click invitations without sign-in, a blind viewer with margin notes, discussion when reviewers disagree.", "/help#accept"],
  ["DECISIONS", "See the whole picture", "Scores, spread and AE recommendations in one table, with a live acceptance-rate meter. Release when ready.", "/#start"],
  ["PROGRAM", "Clash-free in minutes", "Place papers in rooms and slots; presenter and chair clashes are flagged before you publish.", "/venues"],
  ["TRUST", "A firewall for chairs’ own papers", "Chairs who submit are handled by a deputy. Every sensitive action is in an audit log nobody can edit.", "/help#conflicts"],
];

/** PO01 — For organizers. Figures marked [ ] are illustrative placeholders. */
export default async function Organizers() {
  const t = await getT();
  const stats: [string, string][] = [
    ["[1,310]", t("submissions handled at [CA] 2026 (illustrative)")],
    ["[3,288]", t("reviews, 91% on time")],
    ["0", t("PINs to remember")],
    ["4", t("languages for authors")],
  ];
  const steps = [t("Copy settings from your last event"), t("Invite your committee — they keep their accounts"), t("Run a test submission"), t("Open submissions")];
  const bars = [62, 48, 81, 37, 70, 55, 90];
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <SiteHeader />
      <section className="bg-[#0E1B3D] text-[#F5F6F3]">
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="m-0 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-[#F2A93B]">{t("For conference organizers")}</p>
            <h1 className="mt-3 font-serif text-[40px] font-[350] leading-[1.05] tracking-[-0.015em] sm:text-[54px]">{t("Run submissions, reviews and the program in one place.")}</h1>
            <p className="mt-4 max-w-[52ch] text-[17px] text-[#D6DCEA]">{t("Built for IEEE-style conferences: double-blind review, associate editors, copyright and Xplore export — without the PIN emails.")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/#start" className="inline-flex h-12 items-center rounded-[4px] bg-[#F2A93B] px-5 text-[16px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{t("Start a free trial event")}</Link>
              <Link href="/contact?tab=sales" className="inline-flex h-12 items-center rounded-[4px] border border-[#3A4C7E] px-5 text-[16px] font-medium text-[#F5F6F3] no-underline hover:bg-[#17285A]">{t("Book a demo")}</Link>
            </div>
          </div>
          <div aria-hidden className="rounded-[10px] bg-white p-5 text-[#121826] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <span className="font-serif text-[20px]">{t("Event dashboard")}</span>
              <span className="rounded-[3px] bg-[#FBEFDD] px-1.5 py-px font-mono text-[10px] uppercase text-[#7A4508]">{t("Illustrative")}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {([[t("Reviews in"), "62%", "#18744F"], [t("Overdue"), "141", "#A8600F"], [t("Accept rate"), "37%", "#0E1B3D"]] as const).map(([l, v, c]) => (
                <div key={l} className="rounded-[6px] border border-[#EEF0EC] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#4A5263]">{l}</div>
                  <div className="mt-1 font-serif text-[28px] leading-none" style={{ color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex h-[110px] items-end gap-2 rounded-[6px] bg-[#F7F8F6] p-3">
              {bars.map((h, i) => <span key={i} className="flex-1 rounded-t-[3px]" style={{ height: `${h}%`, background: i === 3 ? "#F2A93B" : "#2F5FD0" }} />)}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto box-border w-full max-w-[1280px] flex-auto px-5 pb-16 sm:px-8">
        <div className="-mt-8 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([v, l]) => (
            <div key={l} className="rounded-[8px] border border-[#DADDE3] bg-white p-5">
              <div className="font-serif text-[36px] leading-none">{v}</div>
              <div className="mt-1.5 text-[14px] text-[#4A5263]">{l}</div>
            </div>
          ))}
        </div>

        <h2 className="mb-0 mt-14 font-serif text-[32px] font-normal">{t("Every phase, one system")}</h2>
        <div className="mt-5 grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([k, ti, d, href]) => (
            <article key={k} className="flex flex-col rounded-[8px] border border-[#DADDE3] bg-white p-[22px]">
              <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#A8600F]">{t(k)}</p>
              <h3 className="mt-2 font-serif text-[22px] font-normal leading-[1.2]">{t(ti)}</h3>
              <p className="mt-2 flex-auto text-[14px] leading-[1.6] text-[#4A5263]">{t(d)}</p>
              <Link href={href} className="mt-3 text-[14px] font-semibold text-[#2F5FD0]">{t("See the screen →")}</Link>
            </article>
          ))}
        </div>

        <section className="mt-14 grid gap-8 rounded-[8px] border border-[#DADDE3] bg-white p-6 sm:p-8 lg:grid-cols-2">
          <div>
            <h2 className="m-0 font-serif text-[30px] font-normal">{t("Moving from PaperCept?")}</h2>
            <p className="mt-2.5 max-w-[52ch] text-[#4A5263]">{t("Import last year’s settings, keyword list, committee and email templates. Authors bring their history through ORCID. We run your first event alongside you.")}</p>
          </div>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className="flex size-7 flex-none items-center justify-center rounded-full bg-[#0E1B3D] font-mono text-[12px] text-[#F2A93B]">{i + 1}</span>
                <span className="font-medium">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 flex flex-wrap items-center justify-between gap-5 rounded-[8px] bg-[#F2A93B] p-7 text-[#0E1B3D] sm:p-9">
          <div>
            <h2 className="m-0 font-serif text-[30px] font-normal">{t("Set up your event in an afternoon")}</h2>
            <p className="mb-0 mt-1.5">{t("Free until you open submissions. No credit card.")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/#start" className="inline-flex h-12 items-center rounded-[4px] bg-[#0E1B3D] px-5 text-[16px] font-semibold text-white no-underline hover:bg-[#17285A]">{t("Create an event")}</Link>
            <Link href="/pricing" className="inline-flex h-12 items-center rounded-[4px] border border-[#0E1B3D] px-5 text-[16px] font-medium text-[#0E1B3D] no-underline">{t("See pricing")}</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
