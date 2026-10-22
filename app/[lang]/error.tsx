"use client";

import Link from "@/components/site/link";
import { useEffect } from "react";
import { useT } from "@/lib/i18n/client";

/** ER01 — unexpected error inside a page. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F5F6F3] px-5 py-12 text-[15px] leading-[1.5] text-[#121826]">
      <section className="w-full max-w-[640px] rounded-[12px] border border-[#DADDE3] bg-white px-6 py-11 text-center sm:px-10">
        <div aria-hidden className="mx-auto flex size-[72px] items-center justify-center rounded-full bg-[#FDECEA] font-serif text-[32px] text-[#B3261E]">!</div>
        <p className="mb-0 mt-[18px] font-mono text-[12px] tracking-[0.06em] text-[#4A5263]">{t("SOMETHING WENT WRONG")}</p>
        <h1 className="mt-1.5 font-serif text-[30px] font-normal leading-[1.15] sm:text-[36px]">{t("This page hit a problem")}</h1>
        <p className="mx-auto mt-2.5 max-w-[46ch] leading-[1.6] text-[#4A5263]">{t("It’s on our side, not yours. What you saved is safe. Try again, or go back to your workspace.")}</p>
        <div className="mt-[22px] flex flex-wrap justify-center gap-2.5">
          <button type="button" onClick={reset} className="inline-flex h-[46px] cursor-pointer items-center rounded-[4px] border-0 bg-[#F2A93B] px-[18px] text-[15px] font-semibold text-[#0E1B3D] hover:bg-[#E89B26]">{t("Try again")}</button>
          <Link href="/workspace" className="inline-flex h-[46px] items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-medium text-[#121826] no-underline">{t("My workspace")}</Link>
          <Link href="/contact" className="inline-flex h-[46px] items-center px-1.5 text-[14px] font-medium text-[#2F5FD0]">{t("Contact support")}</Link>
        </div>
        {error.digest ? <p className="mb-0 mt-[18px] font-mono text-[12px] text-[#4A5263]">{t("Reference")}: {error.digest}</p> : null}
      </section>
    </main>
  );
}
