import type { ComponentProps } from "react";
import PublicPage, { generateMetadata } from "@/app/[lang]/(site)/help/reviewers/[guide]/page";

/* Workspace version of the public /help/reviewers/[guide] page: same content, inside the workspace frame (side
   menu, no public header or footer). Signed-in people are sent here by proxy.ts. */
export { generateMetadata };

export default function Page(props: ComponentProps<typeof PublicPage>) {
  return (
    <>
      <PublicPage {...props} />
    </>
  );
}
