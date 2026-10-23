import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getUnsubInfo } from "@/lib/data/unsub";
import { Reveal } from "@/components/motion/reveal";
import { SiteHeader } from "@/components/site/site-header";
import { UnsubscribeCard } from "@/components/data/unsubscribe-card";
import { UnsubscribeSkeleton } from "@/components/skeletons/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Unsubscribe"), robots: { index: false, follow: false } };
}

type P = { params: Promise<{ token: string }> };

async function Inner({ params }: P) {
  const { token } = await params;
  const [t, info] = await Promise.all([getT(), getUnsubInfo(token)]);
  if (!info) {
    return (
      <section className="rounded-[8px] border border-[#DADDE3] bg-white p-6 sm:p-8">
        <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Email preferences")}</p>
        <h1 className="mb-0 mt-1 font-serif text-[34px] font-normal leading-[1.15]">{t("This link doesn't work any more")}</h1>
        <p className="mb-0 mt-2 text-[#4A5263]">{t("Unsubscribe links expire after a year. Sign in to choose which emails you get.")}</p>
        <Link href="/sign-in?next=/workspace/settings/notifications" className="mt-5 inline-flex h-[42px] items-center rounded-[4px] bg-[#F2A93B] px-[18px] text-[15px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{t("Open notification settings")}</Link>
      </section>
    );
  }
  return <UnsubscribeCard token={token} initial={info} />;
}

/** Canvas UN01 — no sign-in needed. */
export default function Page(props: P) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <SiteHeader />
      <main className="mx-auto box-border w-full max-w-[760px] flex-auto px-5 pb-16 pt-12 sm:px-6">
        <Reveal fallback={<UnsubscribeSkeleton />}><Inner {...props} /></Reveal>
      </main>
    </div>
  );
}
