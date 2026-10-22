import type { ReactNode } from "react";
import type { WorkspaceCtx } from "@/lib/workspace/data";
import { EventHint } from "@/components/chrome/event-hint";

export { ORGANIZER_NAV } from "@/lib/site/organizer-nav";

/*
 * The header, side menu and page frame now live in the root layout (components/chrome/app-chrome.tsx), so
 * they stay on screen between clicks. Pages still wrap their content in WorkspaceShell; it only passes the
 * organiser event (name and role) to the side menu. `ctx` and `active` are kept for the pages' call sites.
 */
export function WorkspaceShell({ children, event }: { ctx: WorkspaceCtx | null; active: string; children: ReactNode; event?: { slug: string; name: string; roleLabel: string } }) {
  return (
    <>
      {event ? <EventHint value={event} /> : null}
      {children}
    </>
  );
}
