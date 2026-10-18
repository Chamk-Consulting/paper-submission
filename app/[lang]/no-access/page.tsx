import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("No access"), robots: { index: false } };
}

/** ER01 "no access": shown when a role doesn't allow a page (e.g. a chair opening their own paper's reviews, rule B1). */
export default async function NoAccess() {
  const t = await getT();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F5F6F3] px-5 py-12 text-[15px] leading-[1.5] text-[#121826]">
      <div className="w-full max-w-[520px] rounded-[8px] border border-[#DADDE3] bg-white p-7">
        <p className="m-0 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#B3261E]">{t("No access")}</p>
        <h1 className="mt-2 font-serif text-[34px] font-normal leading-[1.1]">{t("This page isn’t open to your role")}</h1>
        <p className="mt-3 text-[#4A5263]">{t("Your role at this event doesn’t include this page. If you think it should, ask the event’s owner or program chair. Organizers never see the reviews of papers they wrote — a deputy chair handles those.")}</p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link href="/workspace" className="inline-flex h-11 items-center rounded-[4px] bg-[#0E1B3D] px-4 font-semibold text-white no-underline">{t("Go to my workspace")}</Link>
          <Link href="/manage/roles" className="inline-flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-4 font-medium text-[#121826] no-underline">{t("My roles & conflicts")}</Link>
        </div>
      </div>
    </main>
  );
}
