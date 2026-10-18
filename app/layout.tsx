import type { Metadata } from "next";
// Fonts are self-hosted (no request to Google: faster and GDPR-friendly).
import "@fontsource-variable/newsreader";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { site } from "@/lib/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — paper submission & review`, template: `%s · ${site.name}` },
  description: "Submit, review and run conferences, workshops and journals.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
