import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getMe } from "@/lib/auth/me";
import { Reveal } from "@/components/motion/reveal";
import { ContactPage } from "@/components/site/contact-form";
import { ContactSkeleton } from "@/components/skeletons/site1";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Contact support") };
}

async function Inner({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, me] = await Promise.all([searchParams, getMe()]);
  return <ContactPage tone="white" initialTab={tab === "sales" ? "sales" : "support"} email={me?.email ?? ""} signedIn={!!me} />;
}

/** Contact support inside the workspace: the public contact page's form, with the light banner and your account filled in. */
export default function Page(props: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <>
      <span data-bleed hidden />
      <Reveal fallback={<ContactSkeleton />}><Inner {...props} /></Reveal>
    </>
  );
}
