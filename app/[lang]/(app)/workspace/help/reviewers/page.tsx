import PublicPage, { generateMetadata } from "@/app/[lang]/(site)/help/reviewers/page";

/* Workspace version of the public /help/reviewers page: same content, inside the workspace frame (side
   menu, no public header or footer). Signed-in people are sent here by proxy.ts. */
export { generateMetadata };

export default function Page() {
  return (
    <>
      <PublicPage />
    </>
  );
}
