import { Suspense } from "react";
import { SiteHeader } from "@/components/chrome/app-chrome";
import { SiteFooterLive } from "@/components/site/site-footer";

/** Public pages, the submission wizard and admin: the shared header above the page, and the one public footer below it
 * (full, compact or minimal by page; none on the wizard and admin — see footerFor). */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="site-shell chrome-body flex min-h-[calc(100dvh-60px)] flex-col">
        <div id="main-content" className="site-main flex flex-auto flex-col">{children}</div>
        <Suspense fallback={null}>
          <SiteFooterLive />
        </Suspense>
      </div>
    </>
  );
}
