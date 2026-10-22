import Link from "@/components/site/link";
import type { Metadata } from "next";
import { OpenCallsStrip } from "@/components/landing/open-calls-strip";
import { site } from "@/lib/config/site";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";
import { CookieSettingsLink } from "@/components/consent/cookie-consent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: { absolute: `Plenary — ${t("conference submission and review")}` } };
}

const wrap = "mx-auto max-w-[1280px] px-6";
const kicker = "m-0 mb-4 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#4A5263]";
const h2 = "m-0 font-serif text-[36px] font-normal leading-[1.1] tracking-[-0.01em] sm:text-[44px]";
const saffronBtn = "rounded-[4px] bg-[#F2A93B] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]";

const PIPELINE = [
  ["01 · CALL", "Call for papers", "Tracks, page limits, deadlines in your time zone.", "#2F5FD0"],
  ["02 · SUBMIT", "Upload & check", "PDF compliance checked at upload, not after.", "#2F5FD0"],
  ["03 · REVIEW", "Match & review", "Expertise matching, conflict rules, load limits.", "#A8600F"],
  ["04 · DECIDE", "Decide & notify", "Recommendations roll up; letters in one batch.", "#A8600F"],
  ["05 · PROGRAM", "Build the program", "Drag papers into sessions; attendees get My Program.", "#18744F"],
  ["06 · PUBLISH", "Proceedings", "Final versions, copyright, publisher metadata.", "#18744F"],
];

const COMPARE = [
  ["Your account", "A numeric PIN and password, valid only on one subdomain.", "One account linked to your ORCID iD, with passkeys and institutional sign-in."],
  ["Finding your venue", "One long page listing every conference and journal by year.", "Search and filter by field, date and deadline; each venue has its own page."],
  ["Roles", "Log in, then switch roles through a separate “Access” step.", "One home showing everything you owe: papers, reviews, sessions to chair."],
  ["PDF compliance", "A separate test page to try before uploading.", "Checked inline at upload, with the failing page and font named."],
  ["Deadline changes", "Appended as text notes under each listing.", "A versioned timeline with a countdown in your local time zone."],
  ["Email", "Authors are asked to whitelist the sender to avoid spam filters.", "Authenticated mail, plus every message mirrored in an in-app inbox."],
];

const ROLES = [
  { id: "authors", tag: "Authors", bg: "#E6EDFC", ac: "#2F5FD0", title: "Submit in minutes, track to publication.", items: ["Co-authors added by ORCID or email.", "Inline PDF check with the exact failing page.", "Reviews, decision and camera-ready in one thread.", "Copyright form and presenter linked to the paper."] },
  { id: "reviewers", tag: "Reviewers", bg: "#FBEFDD", ac: "#A8600F", title: "Papers you are qualified for, at a load you agreed to.", items: ["Bid on titles, or accept suggested matches.", "Conflicts flagged from co-authorship and affiliation.", "PDF and form side by side; drafts autosave.", "An exportable reviewing record."] },
  { id: "chairs", tag: "Chairs & editors", bg: "#E1F3EA", ac: "#18744F", title: "See the whole conference on one screen.", items: ["Committees, associate editors, invited sessions.", "Live view of missing reviews and borderline papers.", "Session builder with rooms, times and chairs.", "Proceedings export with publisher metadata."] },
];

const DUE = [
  ["REVIEW", "#FBEFDD", "#7A4508", "[Paper title] · [Conference]", "in 3 days", "#A8600F"],
  ["CAMERA-READY", "#E6EDFC", "#1F47A8", "[Paper title] · [Conference]", "in 12 days", "#4A5263"],
  ["SESSION", "#E1F3EA", "#14603F", "Chair: [Session] · [Conference]", "[Date]", "#4A5263"],
];

const PRINCIPLES = [
  ["01", "Full export, any time", "Submissions, reviews and people as CSV, JSON and PDF archives."],
  ["02", "Blind means blind", "Identity fields separated at the data layer, not hidden in the interface."],
  ["03", "GDPR by default", "Consent once per account, regional hosting, a named data processor."],
  ["04", "Every action logged", "An audit trail chairs can show their society after each decision."],
];


/** Canvas PR01-Landing. */
export default async function Landing() {
  const t = await getT();
  return (
    <div className="bg-[#F5F6F3] text-[16px] leading-[1.6] text-[#121826]">
      {/* Hero band */}
      <section id="top" className="bg-[#0E1B3D] text-[#F5F6F3]">
        <div className="border-t border-[#24335C]" />

        <div className={`${wrap} pb-20 pt-[88px]`}>
          <p className="m-0 mb-6 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#F2A93B]">{t("Submission · Review · Program · Proceedings")}</p>
          <h1 className="m-0 max-w-[16ch] font-serif text-[clamp(48px,7vw,82px)] font-[350] leading-[1.02] tracking-[-0.02em]">{t("One account for every paper you will ever submit.")}</h1>
          <p className="mt-7 max-w-[56ch] text-[20px] leading-[1.55] text-[#B9C3DA]">{t("Plenary runs the whole life of a technical conference — call for papers, double-blind review, invited sessions, the program and the proceedings — in one workspace that authors, reviewers and chairs can find their way around.")}</p>
          <div className="mt-9 flex flex-wrap items-center gap-6">
            <a href="#start" className={`px-5 py-3 text-[15px] ${saffronBtn}`}>{t("Host your next conference")}</a>
            <Link href="/venues" className="text-[15px] font-medium text-[#F5F6F3] underline">{t("Find a call for papers →")}</Link>
          </div>

          <figure className="m-0 mt-16 rounded-[8px] bg-[#17285A] p-7">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
              {PIPELINE.map(([k, ti, d, c]) => (
                <div key={k} className="overflow-hidden rounded-[8px] bg-white text-[#121826]">
                  <div className="h-1" style={{ background: c }} />
                  <div className="px-4 pb-4 pt-3.5">
                    <div className="font-mono text-[12px] font-medium" style={{ color: c }}>{k.split(" · ")[0]} · {t(k.split(" · ")[1])}</div>
                    <div className="mt-1.5 font-semibold">{t(ti)}</div>
                    <div className="mt-1 text-[13px] leading-[1.45] text-[#4A5263]">{t(d)}</div>
                  </div>
                </div>
              ))}
            </div>
            <figcaption className="mt-[18px] font-mono text-[13px] text-[#B9C3DA]">{t("Fig. 1 — The full conference pipeline in one workspace. Nobody re-enters a title, an author list or a PIN.")}</figcaption>
          </figure>
        </div>
      </section>

      {/* Open calls strip */}
      <section id="open-calls" className="scroll-mt-4 border-b border-[#DADDE3] bg-white">
        <div className={`${wrap} flex flex-wrap items-start gap-8 py-10`}>
          <div className="flex-[1_1_260px]">
            <p className="m-0 mb-2 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("Open calls now")}</p>
            <h2 className="m-0 font-serif text-[32px] font-normal leading-[1.15]">{t("Deadlines in your time zone, not the organizer's.")}</h2>
          </div>
          <Reveal fallback={
            <div aria-busy="true" className="min-w-0 flex-[2_1_560px] overflow-hidden rounded-[8px] border border-[#DADDE3]">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-3 border-b border-[#EEF0EC] px-5 py-3 last:border-0">
                  <span className="col-span-12 flex h-6 items-center sm:col-span-6"><span className="sk block h-3 w-[70%]" /></span>
                  <span className="col-span-6 flex h-6 items-center sm:col-span-3"><span className="sk block h-3 w-[60%]" /></span>
                  <span className="col-span-6 flex h-6 items-center justify-end sm:col-span-3"><span className="sk block h-3 w-[50%]" /></span>
                </div>
              ))}
            </div>
          }>
            <OpenCallsStrip />
          </Reveal>
        </div>
      </section>

      {/* Compare */}
      <section id="compare">
        <div className={`${wrap} py-24`}>
          <p className={kicker}>{t("§ 1 · Why switch")}</p>
          <h2 className={`${h2} max-w-[22ch]`}>{t("The legacy portal, re-read with fresh eyes.")}</h2>
          <p className="mt-5 max-w-[64ch] text-[18px] text-[#4A5263]">{t("Most control, robotics and engineering conferences still run on systems designed two decades ago. Here is what authors and chairs run into, and what Plenary does instead.")}</p>
          <div className="mt-12 overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
            <table className="w-full min-w-[720px] border-collapse text-[15px]">
              <thead>
                <tr className="bg-[#0E1B3D] text-left text-[#F5F6F3]">
                  <th scope="col" className="px-5 py-3.5 font-mono text-[12px] font-medium uppercase tracking-[0.06em]">{t("Moment")}</th>
                  <th scope="col" className="px-5 py-3.5 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#B9C3DA]">{t("Legacy portal")}</th>
                  <th scope="col" className="px-5 py-3.5 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#F2A93B]">Plenary</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([m, a, b], i) => {
                  const bd = i < COMPARE.length - 1 ? "border-b border-[#DADDE3]" : "";
                  return (
                    <tr key={m}>
                      <th scope="row" className={`px-5 py-4 text-left font-semibold ${bd}`}>{t(m)}</th>
                      <td className={`px-5 py-4 text-[#4A5263] ${bd}`}>{t(a)}</td>
                      <td className={`px-5 py-4 ${bd}`}>{t(b)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 font-mono text-[13px] text-[#4A5263]">{t("Table 1 — Based on the public start page of a widely used control-systems portal, reviewed October 2026.")}</p>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="border-t border-[#DADDE3] bg-white">
        <div className={`${wrap} py-24`}>
          <p className={kicker}>{t("§ 2 · Built for each role")}</p>
          <h2 className={`${h2} max-w-[24ch]`}>{t("Three people, one paper, no lost emails.")}</h2>
          <div className="mt-[52px] grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
            {ROLES.map((r) => (
              <article key={r.id} id={r.id === "chairs" ? "chairs" : undefined} className="rounded-[8px] p-7" style={{ background: r.bg, borderTop: `3px solid ${r.ac}` }}>
                <span className="inline-block rounded-[2px] px-2 py-0.5 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-white" style={{ background: r.ac }}>{t(r.tag)}</span>
                <h3 className="mt-4 text-[20px] font-semibold leading-[1.35]">{t(r.title)}</h3>
                <ul className="mt-3.5 flex flex-col gap-1.5 pl-[18px] text-[#4A5263]">{r.items.map((x) => <li key={x}>{t(x)}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Home preview */}
      <section className="border-t border-[#DADDE3]">
        <div className={`${wrap} flex flex-wrap items-start gap-14 py-24`}>
          <div className="min-w-0 flex-[1_1_340px]">
            <p className={kicker}>{t("§ 3 · Your home")}</p>
            <h2 className={h2}>{t("Everything you owe, across every venue.")}</h2>
            <p className="mt-5 max-w-[48ch] text-[18px] text-[#4A5263]">{t("Sign in once and see papers under review, reviews due and sessions to chair — sorted by deadline.")}</p>
          </div>
          <figure className="m-0 min-w-0 flex-[1_1_520px]">
            <div className="overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
              <div className="flex items-center justify-between gap-3 bg-[#0E1B3D] px-5 py-3 text-[#F5F6F3]">
                <span className="text-[15px] font-semibold">{t("Due next")}</span>
                <span className="font-mono text-[12px] text-[#B9C3DA]">{t("Times in your time zone")}</span>
              </div>
              {DUE.map(([tag, bg, ink, text, when, whenInk], i) => (
                <div key={tag} className={`flex flex-wrap items-baseline gap-3.5 px-5 py-3.5 ${i < DUE.length - 1 ? "border-b border-[#EEF0EC]" : ""}`}>
                  <span className="rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium" style={{ background: bg, color: ink }}>{t(tag)}</span>
                  <span className="flex-[1_1_220px]">{t(text)}</span>
                  <span className="font-mono text-[13px]" style={{ color: whenInk }}>{t(when)}</span>
                </div>
              ))}
            </div>
            <figcaption className="mt-4 font-mono text-[13px] text-[#4A5263]">{t("Fig. 2 — The personal home replaces role switching. Illustrative.")}</figcaption>
          </figure>
        </div>
      </section>

      {/* Principles */}
      <section className="border-t border-[#DADDE3] bg-white">
        <div className={`${wrap} py-24`}>
          <p className={kicker}>{t("§ 4 · Principles")}</p>
          <h2 className={h2}>{t("Your society owns the data.")}</h2>
          <ol className="m-0 mt-12 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-8 p-0">
            {PRINCIPLES.map(([n, ti, d]) => (
              <li key={n} className="border-t-2 border-[#0E1B3D] pt-4">
                <div className="font-mono text-[13px] text-[#A8600F]">{n}</div>
                <div className="mt-2 font-semibold">{t(ti)}</div>
                <div className="mt-1.5 text-[15px] text-[#4A5263]">{t(d)}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-[#DADDE3]">
        <div className={`${wrap} py-24`}>
          <p className={kicker}>{t("§ 5 · Pricing")}</p>
          <h2 className={h2}>{t("Free for authors and reviewers. Always.")}</h2>
          {/* TODO(pricing): real prices (PO02). The canvas shows [PRICE] placeholders. */}
          <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
            <div className="rounded-[8px] border border-[#DADDE3] bg-white p-7">
              <div className="text-[18px] font-semibold">{t("Workshop")}</div>
              <div className="mt-2 font-mono text-[15px]">{t("Price on request")}</div>
              <p className="mt-3 text-[15px] text-[#4A5263]">{t("Small submission volume, one track, standard review forms.")}</p>
            </div>
            <div className="rounded-[8px] border-2 border-[#F2A93B] bg-white p-[27px]">
              <div className="flex items-baseline justify-between"><span className="text-[18px] font-semibold">{t("Conference")}</span><span className="rounded-[2px] bg-[#FBEFDD] px-2 py-0.5 font-mono text-[11px] font-medium text-[#7A4508]">{t("MOST CHOSEN")}</span></div>
              <div className="mt-2 font-mono text-[15px]">{t("Per submission")}</div>
              <p className="mt-3 text-[15px] text-[#4A5263]">{t("Unlimited tracks, invited sessions, program builder, proceedings export.")}</p>
            </div>
            <div className="rounded-[8px] border border-[#DADDE3] bg-white p-7">
              <div className="text-[18px] font-semibold">{t("Society")}</div>
              <div className="mt-2 font-mono text-[15px]">{t("Annual agreement")}</div>
              <p className="mt-3 text-[15px] text-[#4A5263]">{t("All your conferences and journals, your own domain, SSO and data residency.")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section id="start" className="bg-[#0E1B3D] text-[#F5F6F3]">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-8 py-[88px]`}>
          <h2 className={`${h2} max-w-[22ch]`}>{t("Running a call for papers next year? Start it here.")}</h2>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/contact?tab=sales" className={`px-5 py-3 text-[15px] ${saffronBtn}`}>{t("Talk to us about migration")}</Link>
            <Link href="/sign-in" className="text-[15px] font-medium text-[#F5F6F3] underline">{t("Sign in →")}</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#DADDE3] bg-white">
        <div className={`${wrap} grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-8 pb-10 pt-14 text-[14px]`}>
          <div><div className="font-serif text-[22px]">Plenary</div><p className="mt-2 text-[#4A5263]">{t("Conference submission and review for the research community.")}</p></div>
          <div className="flex flex-col gap-2">
            <div className="font-mono text-[12px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Product")}</div>
            <Link href="/venues" className="text-[#121826] no-underline">{t("Venues")}</Link>
            <a href="#roles" className="text-[#121826] no-underline">{t("For authors & reviewers")}</a>
            <Link href="/organizers" className="text-[#121826] no-underline">{t("For organizers")}</Link>
            <Link href="/pricing" className="text-[#121826] no-underline">{t("Pricing")}</Link>
          </div>
          <div className="flex flex-col gap-2">
            <div className="font-mono text-[12px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Resources")}</div>
            <Link href="/help" className="text-[#121826] no-underline">{t("Help centre")}</Link>
            <Link href="/contact" className="text-[#121826] no-underline">{t("Contact")}</Link>
            <Link href="/maintenance" className="text-[#121826] no-underline">{t("System status")}</Link>
          </div>
          <div className="flex flex-col gap-2">
            <div className="font-mono text-[12px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Legal")}</div>
            <Link href="/legal/privacy" className="text-[#121826] no-underline">{t("Privacy & GDPR")}</Link>
            <Link href="/legal/terms" className="text-[#121826] no-underline">{t("Terms")}</Link>
            <Link href="/legal/security" className="text-[#121826] no-underline">{t("Security")}</Link>
            <Link href="/legal/cookies" className="text-[#121826] no-underline">{t("Cookies")}</Link>
            <CookieSettingsLink className="self-start text-left text-[#121826]" />
          </div>
        </div>
        <div className={`${wrap} pb-8 font-mono text-[12px] text-[#4A5263]`}>© 2026 {site.legalName}</div>
      </footer>
    </div>
  );
}
