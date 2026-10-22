import { SiteHeader } from "@/components/chrome/app-chrome";

/** Public pages, the submission wizard and admin: the shared header above the page. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div id="main-content" className="chrome-body">{children}</div>
    </>
  );
}
