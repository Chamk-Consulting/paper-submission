import { AppFrame, SiteHeader } from "@/components/chrome/app-chrome";

/** Signed-in areas: the shared header plus the side menu. Both stay mounted between clicks. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader variant="app" />
      <AppFrame>{children}</AppFrame>
    </>
  );
}
