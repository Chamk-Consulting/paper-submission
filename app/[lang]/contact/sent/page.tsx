import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getMe } from "@/lib/auth/me";
import { readSentSummary } from "@/lib/site/actions";
import { contact } from "@/lib/config/contact";
import { Reveal } from "@/components/motion/reveal";
import { SiteHeader } from "@/components/site/site-header";
import { PublicFooter } from "@/components/venues/public-header";
import { Bar, Line, Skeleton } from "@/components/skeletons/parts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Message sent"), robots: { index: false } };
}

const dt = "font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]";

async function Inner({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const t = await getT();
  const [{ ref }, me] = await Promise.all([searchParams, getMe()]);
  const s = await readSentSummary(ref);
  const reference = s?.ref ?? (ref && /^(SUP|SAL)-\d{4}-[A-Z0-9]{5}$/.test(ref) ? ref : null);
  const steps: [string, string][] = [
    [t("Received"), t("Your message and file are with the team.")],
    [t("Reply by email"), t("Answer it directly; the reference keeps the thread together.")],
    [t("Closed when solved"), t("Account access for support ends at the same moment.")],
  ];
  return (
    <main className="mx-auto box-border flex w-full max-w-[1280px] flex-auto flex-wrap items-start gap-7 px-5 pb-[72px] pt-14 sm:px-8">
      <section className="min-w-0 max-w-[720px] flex-[999_1_560px] rounded-[8px] border border-[#DADDE3] bg-white p-6 sm:p-9">
        <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-[#E1F3EA]">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#14603F" strokeWidth="2"><path d="M5 11.5l4 4 8-9" /></svg>
        </span>
        <p className="mb-0 mt-[22px] font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#14603F]">{t("Message sent")}</p>
        <h1 className="mt-2 font-serif text-[36px] font-[350] leading-[1.08] tracking-[-0.015em] sm:text-[42px]">{t("Thanks — we have it.")}</h1>
        <p className="mt-3 max-w-[54ch] text-[17px] text-[#4A5263]">
          {s ? <>{t("A copy is on its way to")} <strong className="text-[#121826]">{s.email}</strong>. </> : null}
          {t("Someone from the team will reply within {time}.", { time: t(contact.replyTime) })}
        </p>
        {reference ? (
          <dl className="mt-[26px] grid overflow-hidden rounded-[8px] border border-[#EEF0EC] [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <div className="border-b border-r border-[#EEF0EC] px-4 py-3.5"><dt className={dt}>{t("Reference")}</dt><dd className="m-0 mt-0.5 font-mono text-[16px] font-medium">{reference}</dd></div>
            {s ? <div className="border-b border-r border-[#EEF0EC] px-4 py-3.5"><dt className={dt}>{t(s.kind === "sales" ? "Event" : "Topic")}</dt><dd className="m-0 mt-0.5 text-[16px] font-medium">{t(s.topic)}</dd></div> : null}
            {s?.about ? <div className="border-b border-[#EEF0EC] px-4 py-3.5"><dt className={dt}>{t("About")}</dt><dd className="m-0 mt-0.5 text-[16px] font-medium">{s.about}</dd></div> : null}
          </dl>
        ) : null}
        {s ? (
          <div className="mt-5 rounded-[8px] bg-[#F7F8F6] px-4 py-3.5 text-[14px] text-[#4A5263]">
            <div className="font-semibold text-[#121826]">“{s.subject}”</div>
            <div className="mt-1 line-clamp-2">{s.excerpt}</div>
          </div>
        ) : null}
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Link href="/help" className="inline-flex h-[46px] items-center rounded-[4px] bg-[#0E1B3D] px-[18px] font-semibold text-white no-underline hover:bg-[#17285A]">{t("Back to Help & guides")}</Link>
          {me ? <Link href="/workspace" className="box-border inline-flex h-[46px] items-center rounded-[4px] border border-[#B7BDC9] bg-white px-[18px] font-medium text-[#121826] no-underline">{t("Go to my workspace")}</Link> : null}
          <Link href="/contact" className="inline-flex h-[46px] items-center px-1.5 font-medium text-[#2F5FD0]">{t("Send another message")}</Link>
        </div>
      </section>

      <aside aria-label={t("While you wait")} className="flex max-w-[380px] flex-[1_1_300px] flex-col gap-3.5">
        <section className="rounded-[8px] border border-[#DADDE3] bg-white p-5">
          <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("What happens now")}</p>
          <ol className="m-0 mt-3.5 flex list-none flex-col gap-3.5 p-0">
            {steps.map(([h, d], i) => (
              <li key={h} className="flex gap-3">
                <span className={`flex size-6 flex-none items-center justify-center rounded-full text-[12px] ${i === 0 ? "bg-[#18744F] text-white" : i === 1 ? "bg-[#F2A93B] font-semibold text-[#0E1B3D]" : "box-border border-[1.5px] border-[#B7BDC9] text-[#4A5263]"}`}>{i === 0 ? "✓" : i + 1}</span>
                <span><strong>{h}</strong> <span className="text-[14px] text-[#4A5263]">{d}</span></span>
              </li>
            ))}
          </ol>
        </section>
        <section className="rounded-[8px] border border-[#F1D29A] bg-[#FFF6E6] p-[18px] text-[14px] text-[#3B2A07]">
          <strong>{t("A deadline today?")}</strong> {t("Submit what you have — you can keep editing until the venue’s deadline, and our reply won’t make you miss it.")}
        </section>
      </aside>
    </main>
  );
}

/** CT02 — Message sent. */
export default function Page(props: { searchParams: Promise<{ ref?: string }> }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <SiteHeader />
      <Reveal fallback={
        <Skeleton className="mx-auto box-border w-full max-w-[1280px] px-5 pt-14 sm:px-8">
          <div className="max-w-[720px] rounded-[8px] border border-[#DADDE3] bg-white p-9"><Bar w={48} h={48} className="rounded-full" /><Line size={42} lh={1.08} w="60%" className="mt-8" /><Line w="80%" className="mt-3" /><Bar h={70} className="mt-6" /></div>
        </Skeleton>
      }><Inner {...props} /></Reveal>
      <PublicFooter />
    </div>
  );
}
