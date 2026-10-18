import type { Metadata } from "next";
import { notFound } from "next/navigation";
// Fonts are self-hosted (no request to Google: faster and GDPR-friendly).
import "@fontsource-variable/newsreader";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "../globals.css";
import { site } from "@/lib/config/site";
import { LOCALES, isLocale } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getT } from "@/lib/i18n/server";
import { Suspense } from "react";
import { NavProgress } from "@/components/motion/nav-progress";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    metadataBase: new URL(site.url),
    title: { default: `${site.name} — ${t("paper submission & review")}`, template: `%s · ${site.name}` },
    description: t("Submit, review and run conferences, workshops and journals."),
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-[#F5F6F3] antialiased">
        <Suspense fallback={null}><NavProgress /></Suspense>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
