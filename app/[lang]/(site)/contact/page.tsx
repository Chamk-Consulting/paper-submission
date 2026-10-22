import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getMe } from "@/lib/auth/me";
import { Reveal } from "@/components/motion/reveal";
import { SiteHeader } from "@/components/site/site-header";
import { ContactPage } from "@/components/site/contact-form";
import { ContactSkeleton } from "@/components/skeletons/site1";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Contact"), description: t("Write to the people who build Plenary: support for authors, reviewers and chairs, or talk to sales about your event.") };
}

async function Inner({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, me] = await Promise.all([searchParams, getMe()]);
  return <ContactPage initialTab={tab === "sales" ? "sales" : "support"} email={me?.email ?? ""} signedIn={!!me} />;
}

/** CT01 — Contact: Get support / Talk to sales. */
export default function Page(props: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <SiteHeader />
      <Reveal fallback={<ContactSkeleton />}><Inner {...props} /></Reveal>
    </div>
  );
}
