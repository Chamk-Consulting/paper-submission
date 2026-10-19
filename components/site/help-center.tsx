"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { contact } from "@/lib/config/contact";

/* Canvas HP01 — Help & guides: search, guide groups, FAQ and "Still stuck?". */

type Guide = { id: string; title: string; body: string; href?: string; cta?: string };
const GROUPS: { title: string; icon: string; guides: Guide[] }[] = [
  { title: "Authors", icon: "A", guides: [
    { id: "submit", title: "Submit a paper", body: "Pick a venue with an open call, then follow the seven steps: type, details, authors, keywords, files, conflicts and review. Your draft saves as you go, and you can submit any time before the deadline.", href: "/venues", cta: "Find an open call" },
    { id: "edit", title: "Edit or withdraw", body: "Until the deadline you can change anything from the paper’s page. After it, the venue decides what can change. Withdrawing tells the chairs and every co-author.", href: "/workspace/submissions", cta: "My submissions" },
    { id: "final", title: "Final version and copyright", body: "After acceptance, lock the exact title and author list, sign the copyright form, then upload the final PDF. The page tells you about extra pages and fees before you upload.", href: "/workspace/submissions", cta: "My submissions" },
    { id: "respond", title: "Respond to reviewers", body: "If the venue has a rebuttal or revision round, the paper’s page shows the reviews and a response form with its own deadline. Answer point by point and keep it polite.", href: "/workspace/submissions", cta: "My submissions" },
  ] },
  { title: "Reviewers", icon: "R", guides: [
    { id: "accept", title: "Accept or decline", body: "Invitations open with one click, without signing in. Declining early helps chairs find someone else — you can suggest a colleague.", href: "/reviews", cta: "My reviews" },
    { id: "review", title: "Write a helpful review", body: "Summarise the contribution, then strengths, weaknesses and concrete suggestions. Scores should match your text. Margin notes in the viewer are shared with the authors only if you choose.", href: "/help/reviewers/workflow", cta: "Read the reviewer guide" },
    { id: "conflicts", title: "Conflicts of interest", body: "Declare co-authors from the last years, your institution and close collaborators. Plenary detects most conflicts automatically; tell the chairs about any others.", href: "/help/reviewers/conflicts", cta: "Read the guide" },
    { id: "ai-tools", title: "Using AI tools in reviews", body: "Each venue sets an AI policy: language help only, allowed with a declaration, or not allowed. The paper viewer shows the rule and switches the AI panel off where it isn't allowed.", href: "/help/reviewers/ai-tools", cta: "Read the guide" },
    { id: "more-time", title: "More time, or handing a review back", body: "Three extra days are approved at once; a week or two needs the editor. If you can't review at all, hand it back early and suggest someone.", href: "/help/reviewers/extensions", cta: "Read the guide" },
    { id: "orcid", title: "Get credit on ORCID", body: "Connect ORCID in your account and Plenary can add your completed reviews to your record, without naming the paper.", href: "/settings", cta: "Account settings" },
  ] },
  { title: "Session chairs", icon: "S", guides: [
    { id: "run", title: "Run your session", body: "Sessions I chair lists your rooms and talks. On the day, mark talks as started, report delays and keep time — attendees see changes live.", href: "/chair", cta: "Sessions I chair" },
    { id: "noshow", title: "Report a no-show", body: "Mark the talk as no-show from your session page. The program chairs are told at once and the proceedings rules of the venue apply.", href: "/chair", cta: "Sessions I chair" },
    { id: "presenters", title: "Message presenters", body: "From the session page, write to all presenters at once. Messages land in their Plenary inbox and by email.", href: "/chair", cta: "Sessions I chair" },
  ] },
  { title: "Your account", icon: "Y", guides: [
    { id: "passkeys", title: "Sign-in and passkeys", body: "Sign in with your email and a password or a one-time code. Add a passkey in Settings to sign in with your fingerprint or face. Plenary never uses PINs.", href: "/settings", cta: "Account settings" },
    { id: "scripts", title: "Names in other scripts", body: "Add your name in another script (for example 中文 or Ελληνικά) in your profile. Proceedings use the name you choose for papers.", href: "/settings", cta: "Account settings" },
    { id: "merge", title: "Merge duplicate accounts", body: "If you have two accounts, write to support from the one you want to keep. We move papers and reviews across after checking both emails.", href: "/contact", cta: "Contact support" },
    { id: "data", title: "Download your data", body: "Ask for a copy of everything we hold about you from Settings. We email a download link when it’s ready.", href: "/settings", cta: "Account settings" },
  ] },
];

const FAQ: [string, string][] = [
  ["What does AoE mean?", "Anywhere on Earth (UTC−12). A deadline at 23:59 AoE has passed everywhere in the world. We always show your local time too."],
  ["Can I submit several papers to the same venue?", "Yes. Each paper has its own ID and status, and My submissions groups them by venue."],
  ["How many extra pages can I buy?", "It depends on the venue — usually up to 2 at a fee. The final-version page tells you before you upload."],
  ["Why can’t I sign the copyright form yet?", "Copyright is signed for an exact title and author list, so you lock those first."],
  ["I don’t receive emails from Plenary", "Check spam and add {email} to your contacts. Everything we email is also in your Plenary inbox."],
  ["How do I change co-authors after submitting?", "Before the deadline, edit the author list from the paper’s page; new co-authors confirm by email. After the deadline, ask the venue’s chairs."],
  ["My PDF fails the upload check", "The check names the page and the problem — usually fonts not embedded or the wrong paper size. Export again as PDF with all fonts embedded, or use the venue’s template."],
];

export function HelpCenter({ initialQuery = "", signedIn }: { initialQuery?: string; signedIn: boolean }) {
  const t = useT();
  const [q, setQ] = useState(initialQuery);
  const needle = q.trim().toLowerCase();
  const hit = (...s: string[]) => !needle || s.some((x) => x.toLowerCase().includes(needle));

  const groups = useMemo(() => GROUPS.map((g) => ({ ...g, guides: g.guides.filter((x) => hit(x.title, x.body, t(x.title), t(x.body), g.title, t(g.title))) })).filter((g) => g.guides.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needle, t]);
  const faq = FAQ.filter(([a, b]) => hit(a, b, t(a), t(b)));
  const n = groups.reduce((s, g) => s + g.guides.length, 0) + faq.length;

  return (
    <div>
      <h1 className="m-0 font-serif text-[36px] font-normal leading-[1.1] tracking-[-0.01em] sm:text-[40px]">{t("Help & guides")}</h1>
      <p className="mt-1.5 text-[#4A5263]">{t("Answers for authors, reviewers, editors and organizers.")}</p>
      <div role="search" className="mt-5 flex h-[50px] max-w-[720px] items-center gap-2.5 rounded-[6px] border border-[#B7BDC9] bg-white px-3.5 focus-within:border-[#0E1B3D]">
        <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden fill="none" stroke="#4A5263" strokeWidth="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
        <label htmlFor="help-q" className="sr-only">{t("Search help")}</label>
        <input id="help-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("What do you need help with?")} className="h-full min-w-0 flex-auto border-0 bg-transparent text-[16px] outline-none" />
      </div>
      <p className="mt-2.5 text-[13px] text-[#4A5263]" aria-live="polite">
        {needle ? t(n === 1 ? "{n} result for “{q}”" : "{n} results for “{q}”", { n, q: q.trim() }) : (
          <>{t("Popular:")}{" "}
            {(["copyright", "extra pages", "passkeys", "conflicts"] as const).map((w, i) => (
              <span key={w}>{i ? " · " : ""}<button type="button" onClick={() => setQ(t(w))} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline">{t(w)}</button></span>
            ))}
          </>
        )}
      </p>

      {groups.length ? (
        <div className="mt-5 grid gap-3.5 md:grid-cols-2">
          {groups.map((g) => (
            <section key={g.title} className="rounded-[8px] border border-[#DADDE3] bg-white p-5">
              <h2 className="m-0 flex items-center gap-2.5 font-serif text-[22px] font-normal">
                <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-[#0E1B3D] font-mono text-[12px] text-[#F2A93B]">{g.icon}</span>{t(g.title)}
              </h2>
              <ul className="m-0 mt-2 list-none p-0">
                {g.guides.map((x) => (
                  <li key={x.id} id={x.id} className="border-b border-[#EEF0EC] last:border-b-0">
                    <details open={!!needle && n <= 3} className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2.5 text-[#2F5FD0] [&::-webkit-details-marker]:hidden">
                        <span>{t(x.title)}</span>
                        <span aria-hidden className="text-[#4A5263] transition-transform group-open:rotate-90">›</span>
                      </summary>
                      <p className="mb-3 mt-0 text-[14px] leading-[1.6] text-[#4A5263]">{t(x.body)}</p>
                      {x.href && x.cta && (signedIn || !["/workspace/submissions", "/reviews", "/chair", "/settings"].includes(x.href))
                        ? <Link href={x.href} className="mb-3 inline-block text-[14px] font-semibold text-[#0E1B3D]">{t(x.cta)} →</Link> : null}
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {faq.length ? (
        <section className="mt-6 rounded-[8px] border border-[#DADDE3] bg-white p-5" aria-labelledby="faq-h">
          <h2 id="faq-h" className="m-0 font-serif text-[22px] font-normal">{t("Frequently asked")}</h2>
          <div className="mt-2">
            {faq.map(([qq, a]) => (
              <details key={qq} className="group border-b border-[#EEF0EC] last:border-b-0" open={!!needle}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                  {t(qq)}<span aria-hidden className="font-normal text-[#4A5263] transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mb-3.5 mt-0 max-w-[70ch] text-[14px] leading-[1.6] text-[#4A5263]">{t(a, { email: contact.noReplyEmail })}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {needle && !n ? (
        <p className="mt-6 rounded-[8px] border border-dashed border-[#B7BDC9] bg-white px-5 py-8 text-center text-[#4A5263]">{t("Nothing matches “{q}”. Try another word, or ask us below.", { q: q.trim() })}</p>
      ) : null}

      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[8px] bg-[#0E1B3D] p-6 text-[#F5F6F3]">
        <div className="max-w-[60ch]">
          <h2 className="m-0 font-serif text-[24px] font-normal">{t("Still stuck?")}</h2>
          <p className="mb-0 mt-1 text-[14px] text-[#D6DCEA]">{t("For a question about a paper or decision, message the venue. For problems with Plenary itself, contact support.")}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href={signedIn ? "/inbox" : "/sign-in?next=/inbox"} className="inline-flex h-11 items-center rounded-[4px] border border-[#3A4C7E] px-4 text-[14px] font-medium text-[#F5F6F3] no-underline hover:bg-[#17285A]">{t("Message the venue")}</Link>
          <Link href="/contact" className="inline-flex h-11 items-center rounded-[4px] bg-[#F2A93B] px-4 text-[14px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{t("Contact Plenary support")}</Link>
        </div>
      </section>
      <p className="mt-3 flex items-center gap-2 text-[13px] text-[#4A5263]"><span className="size-2 rounded-full bg-[#18744F]" />{t("All systems working · replies within {time}", { time: t(contact.replyTime) })}</p>
    </div>
  );
}
