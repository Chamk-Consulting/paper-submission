import PublicPage, { generateMetadata } from "@/app/[lang]/(site)/legal/accessibility/page";

/* Workspace version of the public /legal/accessibility page: same content, inside the workspace frame (side
   menu, no public header or footer). Signed-in people are sent here by proxy.ts. */
export { generateMetadata };

export default function Page() {
  return (
    <>
      <span data-bleed hidden />
      <PublicPage />
    </>
  );
}
