import { PasswordPolicyProvider } from "@/components/auth/password-policy";
import { KeepFormValues } from "@/components/site/keep-form-values";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
// Fonts are self-hosted (no request to Google: faster and GDPR-friendly).
import "@fontsource-variable/newsreader";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "../globals.css";
import { site } from "@/lib/config/site";
import { getBrand } from "@/lib/config/brand";
import { LOCALES, isLocale } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getT } from "@/lib/i18n/server";
import { DICTS } from "@/lib/i18n/translate";
import { Suspense } from "react";
import { NavProgress } from "@/components/motion/nav-progress";
import { PwaLayer } from "@/components/pwa/pwa-layer";
import { CookieConsent } from "@/components/consent/cookie-consent";
import { RememberAccount } from "@/components/auth/remember-account";
import { UI_FLAG } from "@/lib/account/ui-prefs";
import { getSiteFlags } from "@/lib/config/site-flags";

const AUTH_FLAG = `try{document.documentElement.dataset.auth=/(?:^|;\\s*)sb-[a-z0-9]+-auth-token(?:\\.0)?=/.test(document.cookie)?"in":"out"}catch(e){}`;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const name = t.brand;
  return {
    metadataBase: new URL(site.url),
    title: { default: `${name} — ${t("paper submission & review")}`, template: `%s · ${name}` },
    description: t("Submit, review and run conferences, workshops and journals."),
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
    applicationName: name,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/icon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0E1B3D",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [locale, brand, flags] = await Promise.all([getLocale(), getBrand(), getSiteFlags()]);
  return (
    <html lang={locale} data-single={flags.singleEvent ? "1" : undefined} data-langs={flags.languages ? "1" : undefined} suppressHydrationWarning>
      <head>
        {/* Before the first paint: signed-in or not, from the session cookie, so the shared header shows the right side at once. */}
        <script dangerouslySetInnerHTML={{ __html: AUTH_FLAG }} />
        {/* Settings › Preferences remembered in this browser (text size, contrast, motion), also before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: UI_FLAG }} />
      </head>
      <body className="min-h-dvh bg-[#F5F6F3] antialiased">
        <Suspense fallback={null}><NavProgress /></Suspense>
        <I18nProvider locale={locale} dict={DICTS[locale]} brand={brand}>
          <PasswordPolicyProvider policy={flags.passwordPolicy}>
          {children}
          </PasswordPolicyProvider>
          <PwaLayer />
          <CookieConsent />
          <RememberAccount />
          <KeepFormValues />
        </I18nProvider>
      </body>
    </html>
  );
}
